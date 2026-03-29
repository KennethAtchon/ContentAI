import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { db } from "../../services/db/db";
import {
  editProjects,
  exportJobs,
  generatedContent,
  queueItems,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc, inArray, isNull } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { uploadFile } from "../../services/storage/r2";
import { buildInitialTimeline } from "./services/build-initial-timeline";
import { resolveContentChainIds } from "./services/refresh-editor-timeline";
import { mergeNewAssetsIntoProject } from "./services/merge-new-assets";
import { patchProjectSchema, createProjectSchema } from "./schemas";
import { parseStoredEditorTracks } from "../../domain/editor/validate-stored-tracks";
import { editorProjectIdParamSchema } from "../../domain/editor/editor.schemas";

const projectsRouter = new Hono<HonoEnv>();
type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const validationErrorHook = (result: ValidationResult, c: Context) => {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "INVALID_INPUT",
        details: result.error?.issues ?? [],
      },
      422,
    );
  }
};

// ─── GET /api/editor ─────────────────────────────────────────────────────────

projectsRouter.get("/", rateLimiter("customer"), authMiddleware("user"), async (c) => {
  try {
    const auth = c.get("auth");

    // tracks JSONB is excluded from the list response — fetch it via GET /:id
    const projects = await db
      .select({
        id: editProjects.id,
        userId: editProjects.userId,
        title: editProjects.title,
        generatedContentId: editProjects.generatedContentId,
        durationMs: editProjects.durationMs,
        fps: editProjects.fps,
        resolution: editProjects.resolution,
        status: editProjects.status,
        publishedAt: editProjects.publishedAt,
        parentProjectId: editProjects.parentProjectId,
        createdAt: editProjects.createdAt,
        updatedAt: editProjects.updatedAt,
        autoTitle: editProjects.autoTitle,
        thumbnailUrl: editProjects.thumbnailUrl,
        // From linked generated_content — null for blank projects
        generatedHook: generatedContent.generatedHook,
        postCaption: generatedContent.postCaption,
      })
      .from(editProjects)
      .leftJoin(
        generatedContent,
        eq(editProjects.generatedContentId, generatedContent.id),
      )
      .where(eq(editProjects.userId, auth.user.id))
      .orderBy(desc(editProjects.updatedAt));

    return c.json({ projects });
  } catch (error) {
    debugLog.error("Failed to list edit projects", {
      service: "editor-route",
      operation: "listProjects",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to list edit projects" }, 500);
  }
});

// ─── POST /api/editor ────────────────────────────────────────────────────────

projectsRouter.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createProjectSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { generatedContentId, title } = c.req.valid("json");

      // ── If project already exists, return 409 with the existing project id ──
      if (generatedContentId) {
        const [ownedContent] = await db
          .select({
            id: generatedContent.id,
            parentId: generatedContent.parentId,
          })
          .from(generatedContent)
          .where(
            and(
              eq(generatedContent.id, generatedContentId),
              eq(generatedContent.userId, auth.user.id),
            ),
          )
          .limit(1);

        if (!ownedContent) {
          return c.json({ error: "Content not found" }, 403);
        }

        const chainIds = await resolveContentChainIds(
          generatedContentId,
          auth.user.id,
        );

        const [existing] = await db
          .select({ id: editProjects.id })
          .from(editProjects)
          .where(
            and(
              eq(editProjects.userId, auth.user.id),
              inArray(editProjects.generatedContentId, chainIds),
              isNull(editProjects.parentProjectId),
            ),
          )
          .limit(1);

        if (existing) {
          return c.json({ error: "project_exists", existingProjectId: existing.id }, 409);
        }
      }

      // ── Build initial timeline if generatedContentId is provided ──
      let tracks: unknown[] = [];
      let durationMs = 0;
      if (generatedContentId) {
        const result = await buildInitialTimeline(
          generatedContentId,
          auth.user.id,
        );
        tracks = result.tracks;
        durationMs = result.durationMs;
      }

      let insertTitle = title ?? "Untitled Edit";
      let insertAutoTitle = !title;
      if (generatedContentId && !title) {
        const [hookRow] = await db
          .select({ generatedHook: generatedContent.generatedHook })
          .from(generatedContent)
          .where(
            and(
              eq(generatedContent.id, generatedContentId),
              eq(generatedContent.userId, auth.user.id),
            ),
          )
          .limit(1);
        if (hookRow?.generatedHook) {
          insertTitle = [...hookRow.generatedHook].slice(0, 60).join("");
          insertAutoTitle = true;
        }
      }

      const [project] = await db
        .insert(editProjects)
        .values({
          userId: auth.user.id,
          title: insertTitle,
          autoTitle: insertAutoTitle,
          generatedContentId: generatedContentId ?? null,
          tracks,
          durationMs,
          fps: 30,
          resolution: "1080x1920",
          status: "draft",
        })
        .returning();

      return c.json({ project }, 201);
    } catch (error) {
      // Race condition: two concurrent requests for the same generatedContentId
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        const auth = c.get("auth");
        const payload = c.req.valid("json");
        if (payload.generatedContentId) {
          const chainIds = await resolveContentChainIds(
            payload.generatedContentId,
            auth.user.id,
          );
          const [existing] = await db
            .select({ id: editProjects.id })
            .from(editProjects)
            .where(
              and(
                eq(editProjects.userId, auth.user.id),
                inArray(editProjects.generatedContentId, chainIds),
                isNull(editProjects.parentProjectId),
              ),
            )
            .limit(1);
          if (existing) {
            return c.json({ error: "project_exists", existingProjectId: existing.id }, 409);
          }
        }
      }

      debugLog.error("Failed to create edit project", {
        service: "editor-route",
        operation: "createProject",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create edit project" }, 500);
    }
  },
);

// ─── GET /api/editor/:id ─────────────────────────────────────────────────────

projectsRouter.get(
  "/:id",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, validationErrorHook),
  async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [project] = await db
    .select()
    .from(editProjects)
    .where(
      and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
    )
    .limit(1);

  if (!project) {
    return c.json({ error: "Edit project not found" }, 404);
  }

  const tracks = parseStoredEditorTracks(project.tracks);
  return c.json({ project: { ...project, tracks } });
});

// ─── PATCH /api/editor/:id (auto-save) ───────────────────────────────────────

projectsRouter.patch(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, validationErrorHook),
  zValidator("json", patchProjectSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.valid("param");
      const parsed = c.req.valid("json");

      const [existing] = await db
        .select({
          id: editProjects.id,
          status: editProjects.status,
          title: editProjects.title,
          autoTitle: editProjects.autoTitle,
        })
        .from(editProjects)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .limit(1);

      if (!existing) {
        return c.json({ error: "Edit project not found" }, 404);
      }

      if (existing.status === "published") {
        return c.json({ error: "Published projects are read-only" }, 403);
      }

      const updateData: Record<string, unknown> = {};
      updateData.userHasEdited = true;
      if (parsed.title !== undefined) {
        updateData.title = parsed.title;
        if (parsed.title !== existing.title) {
          updateData.autoTitle = false;
        }
      }
      if (parsed.tracks !== undefined) {
        updateData.tracks = parsed.tracks;
        updateData.mergedAssetIds = [
          ...new Set(
            parsed.tracks
              .flatMap((t) => t.clips.map((c) => c.assetId))
              .filter((id): id is string => typeof id === "string" && id.length > 0),
          ),
        ];
      }
      if (parsed.durationMs !== undefined)
        updateData.durationMs = parsed.durationMs;
      if (parsed.fps !== undefined) updateData.fps = parsed.fps;
      if (parsed.resolution !== undefined)
        updateData.resolution = parsed.resolution;

      const [updated] = await db
        .update(editProjects)
        .set(updateData)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .returning({ id: editProjects.id, updatedAt: editProjects.updatedAt });

      return c.json({ id: updated.id, updatedAt: updated.updatedAt });
    } catch (error) {
      debugLog.error("Failed to update edit project", {
        service: "editor-route",
        operation: "updateProject",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update edit project" }, 500);
    }
  },
);

// ─── POST /api/editor/:id/thumbnail ─────────────────────────────────────────

projectsRouter.post(
  "/:id/thumbnail",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.valid("param");

      const [existing] = await db
        .select({ id: editProjects.id })
        .from(editProjects)
        .where(and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)))
        .limit(1);

      if (!existing) {
        return c.json({ error: "Edit project not found" }, 404);
      }

      const formData = await c.req.formData().catch(() => null);
      const file = formData?.get("file");
      if (!file || !(file instanceof File)) {
        return c.json({ error: "Missing file field" }, 400);
      }
      if (!file.type.startsWith("image/")) {
        return c.json({ error: "File must be an image" }, 400);
      }
      if (file.size > 5 * 1024 * 1024) {
        return c.json({ error: "Image must be under 5 MB" }, 400);
      }

      const ext = file.type === "image/png" ? "png" : "jpg";
      const r2Key = `thumbnails/editor/${auth.user.id}/${id}.${ext}`;
      const thumbnailUrl = await uploadFile(file, r2Key, file.type);

      await db
        .update(editProjects)
        .set({ thumbnailUrl })
        .where(and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)));

      return c.json({ thumbnailUrl });
    } catch (error) {
      debugLog.error("Failed to upload project thumbnail", {
        service: "editor-route",
        operation: "uploadThumbnail",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to upload thumbnail" }, 500);
    }
  },
);

// ─── DELETE /api/editor/:id ──────────────────────────────────────────────────

projectsRouter.delete(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.valid("param");

      const [existing] = await db
        .select({ id: editProjects.id })
        .from(editProjects)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .limit(1);

      if (!existing) {
        return c.json({ error: "Edit project not found" }, 404);
      }

      await db
        .delete(editProjects)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        );

      return c.body(null, 204);
    } catch (error) {
      debugLog.error("Failed to delete edit project", {
        service: "editor-route",
        operation: "deleteProject",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete edit project" }, 500);
    }
  },
);

// ─── POST /api/editor/:id/sync-assets ────────────────────────────────────────

projectsRouter.post(
  "/:id/sync-assets",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.valid("param");
      const result = await mergeNewAssetsIntoProject(id, auth.user.id);
      return c.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Project not found") {
        return c.json({ error: "Edit project not found" }, 404);
      }
      debugLog.error("Failed to sync assets", {
        service: "editor-route",
        operation: "syncAssets",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to sync assets" }, 500);
    }
  },
);

// ─── POST /api/editor/:id/publish ────────────────────────────────────────────

projectsRouter.post(
  "/:id/publish",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.valid("param");

      const [project] = await db
        .select()
        .from(editProjects)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .limit(1);

      if (!project) {
        return c.json({ error: "Edit project not found" }, 404);
      }

      if (project.status === "published") {
        return c.json({ error: "Already published" }, 409);
      }

      const [completedExport] = await db
        .select({ id: exportJobs.id })
        .from(exportJobs)
        .where(
          and(eq(exportJobs.editProjectId, id), eq(exportJobs.status, "done")),
        )
        .limit(1);

      if (!completedExport) {
        return c.json({ error: "Export your reel before publishing" }, 422);
      }

      const [updated] = await db
        .update(editProjects)
        .set({ status: "published", publishedAt: new Date() })
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .returning({
          id: editProjects.id,
          status: editProjects.status,
          publishedAt: editProjects.publishedAt,
          generatedContentId: editProjects.generatedContentId,
        });

      // Mark the linked queue item as ready for scheduling
      if (updated.generatedContentId) {
        await db
          .update(queueItems)
          .set({ status: "ready" })
          .where(
            and(
              eq(queueItems.generatedContentId, updated.generatedContentId),
              eq(queueItems.userId, auth.user.id),
              inArray(queueItems.status, ["draft", "scheduled"]),
            ),
          );
      }

      return c.json({
        id: updated.id,
        status: updated.status,
        publishedAt: updated.publishedAt,
      });
    } catch (error) {
      debugLog.error("Failed to publish edit project", {
        service: "editor-route",
        operation: "publishProject",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to publish edit project" }, 500);
    }
  },
);

// ─── POST /api/editor/:id/new-draft ──────────────────────────────────────────

projectsRouter.post(
  "/:id/new-draft",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.valid("param");

      const [source] = await db
        .select()
        .from(editProjects)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .limit(1);

      if (!source) {
        return c.json({ error: "Edit project not found" }, 404);
      }

      if (source.status !== "published") {
        return c.json({ error: "Source must be published" }, 403);
      }

      const [newDraft] = await db
        .insert(editProjects)
        .values({
          userId: auth.user.id,
          title: `${source.title} (v2)`,
          generatedContentId: null,
          tracks: source.tracks,
          durationMs: source.durationMs,
          fps: source.fps,
          resolution: source.resolution,
          status: "draft",
          parentProjectId: source.id,
        })
        .returning();

      return c.json({ project: newDraft }, 201);
    } catch (error) {
      debugLog.error("Failed to create new draft", {
        service: "editor-route",
        operation: "newDraft",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create new draft" }, 500);
    }
  },
);


export default projectsRouter;
