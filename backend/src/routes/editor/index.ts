import { Hono } from "hono";
import { z } from "zod";
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
  assets,
  contentAssets,
  generatedContent,
  queueItems,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc, count, inArray, isNull } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { getFileUrl, uploadFile } from "../../services/storage/r2";
import { buildInitialTimeline } from "./services/build-initial-timeline";
import {
  resolveContentChainIds,
  normalizeMediaClipTrimFields,
} from "./services/refresh-editor-timeline";
import { mergeNewAssetsIntoProject } from "./services/merge-new-assets";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ANTHROPIC_API_KEY } from "../../utils/config/envUtil";
import { buildAIAssemblyPrompt } from "./services/ai-assembly-prompt";
import {
  patchProjectSchema,
  createProjectSchema,
  exportSchema,
  aiAssemblyResponseSchema,
  aiAssembleRequestSchema,
} from "./schemas";
import { runExportJob } from "./export-worker";
import editorAssetsRouter from "./assets.router";

const app = new Hono<HonoEnv>();

app.route("/assets", editorAssetsRouter);

const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY ?? "" });

// ─── GET /api/editor ─────────────────────────────────────────────────────────

app.get("/", rateLimiter("customer"), authMiddleware("user"), async (c) => {
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

app.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const body = await c.req.json().catch(() => ({}));
      const parsed = createProjectSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: "Invalid request body", issues: parsed.error.issues }, 400);
      }

      const { generatedContentId, title } = parsed.data;

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
        const body = await c.req.json().catch(() => ({}));
        const parsed = createProjectSchema.safeParse(body);
        if (parsed.success && parsed.data.generatedContentId) {
          const chainIds = await resolveContentChainIds(
            parsed.data.generatedContentId,
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

app.get("/:id", rateLimiter("customer"), authMiddleware("user"), async (c) => {
  try {
    const auth = c.get("auth");
    const { id } = c.req.param();

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

    return c.json({ project });
  } catch (error) {
    debugLog.error("Failed to fetch edit project", {
      service: "editor-route",
      operation: "getProject",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to fetch edit project" }, 500);
  }
});

// ─── PATCH /api/editor/:id (auto-save) ───────────────────────────────────────

app.patch(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();
      const body = await c.req.json().catch(() => null);
      const parsed = patchProjectSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: "Invalid request body", issues: parsed.error.issues }, 400);
      }

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
      if (parsed.data.title !== undefined) {
        updateData.title = parsed.data.title;
        if (parsed.data.title !== existing.title) {
          updateData.autoTitle = false;
        }
      }
      if (parsed.data.tracks !== undefined) {
        updateData.tracks = parsed.data.tracks;
        updateData.mergedAssetIds = [
          ...new Set(
            parsed.data.tracks
              .flatMap((t) => t.clips.map((c) => c.assetId))
              .filter((id): id is string => typeof id === "string" && id.length > 0),
          ),
        ];
      }
      if (parsed.data.durationMs !== undefined)
        updateData.durationMs = parsed.data.durationMs;
      if (parsed.data.fps !== undefined) updateData.fps = parsed.data.fps;
      if (parsed.data.resolution !== undefined)
        updateData.resolution = parsed.data.resolution;

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

app.post(
  "/:id/thumbnail",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();

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

app.delete(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();

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

app.post(
  "/:id/sync-assets",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();
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

app.post(
  "/:id/publish",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();

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

app.post(
  "/:id/new-draft",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();

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

// ─── POST /api/editor/:id/export ─────────────────────────────────────────────

app.post(
  "/:id/export",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();
      const body = await c.req.json().catch(() => ({}));
      const parsed = exportSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: "Invalid request body", issues: parsed.error.issues }, 400);
      }

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

      // Auto-create generated_content for blank projects on first export.
      // All three writes are in a transaction — partial failure leaves no orphaned rows.
      if (!project.generatedContentId) {
        const newContentId = await db
          .transaction(async (tx) => {
            const [newContent] = await tx
              .insert(generatedContent)
              .values({
                userId: auth.user.id,
                prompt: null,
                status: "draft",
                version: 1,
                outputType: "full",
              })
              .returning({ id: generatedContent.id });

            // Link atomically — 0 rows updated means a concurrent request raced us
            const updated = await tx
              .update(editProjects)
              .set({ generatedContentId: newContent.id })
              .where(
                and(
                  eq(editProjects.id, id),
                  isNull(editProjects.generatedContentId),
                ),
              )
              .returning({
                generatedContentId: editProjects.generatedContentId,
              });

            if (!updated[0]) {
              throw new Error("RACE_LOST");
            }

            await tx.insert(queueItems).values({
              userId: auth.user.id,
              generatedContentId: newContent.id,
              status: "draft",
            });

            return newContent.id;
          })
          .catch(async (err: unknown) => {
            if (err instanceof Error && err.message === "RACE_LOST") {
              const [refetched] = await db
                .select({ generatedContentId: editProjects.generatedContentId })
                .from(editProjects)
                .where(eq(editProjects.id, id));
              return refetched?.generatedContentId ?? null;
            }
            throw err;
          });

        if (!newContentId) {
          return c.json(
            { error: "Failed to initialise pipeline for this project" },
            500,
          );
        }

        project.generatedContentId = newContentId;
      }

      // Enforce per-user concurrency limit — prevent unbounded background ffmpeg processes.
      const [{ activeJobs }] = await db
        .select({ activeJobs: count() })
        .from(exportJobs)
        .where(
          and(
            eq(exportJobs.userId, auth.user.id),
            eq(exportJobs.status, "rendering"),
          ),
        );

      if (activeJobs >= 2) {
        return c.json(
          {
            error:
              "Too many active export jobs. Please wait for a current export to finish.",
          },
          429,
        );
      }

      const [job] = await db
        .insert(exportJobs)
        .values({
          editProjectId: id,
          userId: auth.user.id,
          status: "queued",
          progress: 0,
        })
        .returning();

      // Run ffmpeg render in the background (non-blocking)
      runExportJob(job.id, project, auth.user.id, parsed.data).catch((err) => {
        debugLog.error("Export job failed", {
          service: "editor-route",
          operation: "runExportJob",
          jobId: job.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      });

      return c.json({ exportJobId: job.id }, 202);
    } catch (error) {
      debugLog.error("Failed to enqueue export", {
        service: "editor-route",
        operation: "enqueueExport",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to enqueue export" }, 500);
    }
  },
);

// ─── GET /api/editor/:id/export/status ───────────────────────────────────────

app.get(
  "/:id/export/status",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();

      // Verify project exists and is owned by user before exposing any export data.
      const [project] = await db
        .select({ id: editProjects.id })
        .from(editProjects)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .limit(1);

      if (!project) {
        return c.json({ error: "Edit project not found" }, 404);
      }

      // Return most recent export job for this project
      const [job] = await db
        .select()
        .from(exportJobs)
        .where(
          and(
            eq(exportJobs.editProjectId, id),
            eq(exportJobs.userId, auth.user.id),
          ),
        )
        .orderBy(desc(exportJobs.createdAt))
        .limit(1);

      if (!job) {
        return c.json({ status: "idle", progress: 0 });
      }

      let r2Url: string | undefined;
      if (job.status === "done" && job.outputAssetId) {
        const [outputAsset] = await db
          .select({ r2Key: assets.r2Key, r2Url: assets.r2Url })
          .from(assets)
          .where(eq(assets.id, job.outputAssetId))
          .limit(1);
        if (outputAsset?.r2Key) {
          r2Url = await getFileUrl(outputAsset.r2Key, 3600 * 6).catch(
            () => outputAsset.r2Url ?? undefined,
          );
        }
      }

      return c.json({
        status: job.status,
        progress: job.progress,
        r2Url,
        error: job.error ?? undefined,
      });
    } catch (error) {
      debugLog.error("Failed to get export status", {
        service: "editor-route",
        operation: "exportStatus",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to get export status" }, 500);
    }
  },
);

// ─── Helper functions for AI assembly ────────────────────────────────────────

async function loadProjectShotAssets(
  userId: string,
  generatedContentId: number,
) {
  const rows = await db
    .select({
      id: assets.id,
      durationMs: assets.durationMs,
      metadata: assets.metadata,
    })
    .from(contentAssets)
    .innerJoin(assets, eq(contentAssets.assetId, assets.id))
    .where(
      and(
        eq(contentAssets.generatedContentId, generatedContentId),
        eq(assets.userId, userId),
        eq(contentAssets.role, "video_clip"),
      ),
    );

  return rows.sort((a, b) => {
    const ai = Number((a.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    const bi = Number((b.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    return ai - bi;
  });
}

function mapCaptionStyleToPresetId(
  style: z.infer<typeof aiAssemblyResponseSchema>["captionStyle"],
): string {
  return style ?? "hormozi";
}

function convertAIResponseToTracks(
  aiResponse: z.infer<typeof aiAssemblyResponseSchema>,
  shotAssets: Array<{
    id: string;
    durationMs: number | null;
    metadata: unknown;
  }>,
  aux: {
    voiceover?: { id: string; durationMs: number | null };
    music?: { id: string; durationMs: number | null };
    totalVideoMs: number;
  },
) {
  let cursor = 0;
  const videoClips = aiResponse.cuts.map((cut, i) => {
    const asset = shotAssets[cut.shotIndex];
    const shotDuration = Math.max(1, asset.durationMs ?? 5000);
    let t0 = Math.max(0, Math.floor(cut.trimStartMs));
    let t1 = Math.floor(cut.trimEndMs);
    if (t0 >= shotDuration) t0 = 0;
    t1 = Math.min(Math.max(t1, t0 + 1), shotDuration);
    if (t0 >= t1) t1 = Math.min(t0 + 1, shotDuration);
    const clipDuration = t1 - t0;
    const clip = normalizeMediaClipTrimFields(shotDuration, {
      id: `ai-clip-${i}`,
      assetId: asset.id,
      label: `Shot ${cut.shotIndex + 1}`,
      startMs: cursor,
      trimStartMs: t0,
      durationMs: clipDuration,
      speed: 1,
      opacity: 1,
      warmth: 0,
      contrast: 0,
      positionX: 0,
      positionY: 0,
      scale: 1,
      rotation: 0,
      volume: 1,
      muted: false,
    });
    cursor += clipDuration;
    return clip;
  });

  const totalVideoMs = cursor;
  const spanMs = Math.max(totalVideoMs, aux.totalVideoMs, 1000);

  const voiceDur = Math.max(1, aux.voiceover?.durationMs ?? spanMs);
  const audioClips = aux.voiceover
    ? [
        normalizeMediaClipTrimFields(voiceDur, {
          id: `voiceover-${aux.voiceover.id}`,
          assetId: aux.voiceover.id,
          label: "Voiceover",
          startMs: 0,
          speed: 1,
          opacity: 1,
          warmth: 0,
          contrast: 0,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0,
          volume: 1,
          muted: false,
        }),
      ]
    : [];

  const musicDur = Math.max(1, aux.music?.durationMs ?? spanMs);
  const musicClips = aux.music
    ? [
        normalizeMediaClipTrimFields(musicDur, {
          id: `music-${aux.music.id}`,
          assetId: aux.music.id,
          label: "Music",
          startMs: 0,
          speed: 1,
          opacity: 1,
          warmth: 0,
          contrast: 0,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0,
          volume: aiResponse.musicVolume,
          muted: false,
        }),
      ]
    : [];

  const captionPresetId = aiResponse.captionStyle
    ? mapCaptionStyleToPresetId(aiResponse.captionStyle)
    : "hormozi";
  const captionGroupSize = aiResponse.captionGroupSize ?? 3;
  const textClips =
    totalVideoMs > 0
      ? [
          {
            id: `ai-caption-${crypto.randomUUID()}`,
            assetId: aux.voiceover?.id ?? null,
            label: "Captions",
            startMs: 0,
            durationMs: totalVideoMs,
            trimStartMs: 0,
            trimEndMs: 0,
            sourceMaxDurationMs: totalVideoMs,
            speed: 1,
            opacity: 1,
            warmth: 0,
            contrast: 0,
            positionX: 0,
            positionY: 0,
            scale: 1,
            rotation: 0,
            volume: 0,
            muted: true,
            captionPresetId,
            captionGroupSize,
            captionPositionY: 80,
            captionWords: [] as {
              word: string;
              startMs: number;
              endMs: number;
            }[],
          },
        ]
      : [];

  return [
    {
      id: "video",
      type: "video" as const,
      name: "Video",
      muted: false,
      locked: false,
      clips: videoClips,
      transitions: [],
    },
    {
      id: "audio",
      type: "audio" as const,
      name: "Audio",
      muted: false,
      locked: false,
      clips: audioClips,
      transitions: [],
    },
    {
      id: "music",
      type: "music" as const,
      name: "Music",
      muted: false,
      locked: false,
      clips: musicClips,
      transitions: [],
    },
    {
      id: "text",
      type: "text" as const,
      name: "Caption",
      muted: false,
      locked: false,
      clips: textClips,
      transitions: [],
    },
  ];
}

function buildStandardPresetTracks(
  shotAssets: Array<{
    id: string;
    durationMs: number | null;
    metadata: unknown;
  }>,
  aux?: {
    voiceover?: { id: string; durationMs: number | null };
    music?: { id: string; durationMs: number | null };
    musicVolume?: number;
    captionPresetId?: string;
    captionGroupSize?: number;
  },
) {
  let cursor = 0;
  const videoClips = shotAssets.map((asset, i) => {
    const durationMs = Math.max(1, asset.durationMs ?? 5000);
    const clip = normalizeMediaClipTrimFields(durationMs, {
      id: `std-clip-${i}`,
      assetId: asset.id,
      label: `Shot ${i + 1}`,
      startMs: cursor,
      speed: 1,
      opacity: 1,
      warmth: 0,
      contrast: 0,
      positionX: 0,
      positionY: 0,
      scale: 1,
      rotation: 0,
      volume: 1,
      muted: false,
    });
    cursor += durationMs;
    return clip;
  });

  const totalVideoMs = cursor;
  const spanMs = Math.max(totalVideoMs, 1000);
  const musicVol = aux?.musicVolume ?? 0.22;

  const voiceDur = Math.max(1, aux?.voiceover?.durationMs ?? spanMs);
  const audioClips = aux?.voiceover
    ? [
        normalizeMediaClipTrimFields(voiceDur, {
          id: `voiceover-${aux.voiceover.id}`,
          assetId: aux.voiceover.id,
          label: "Voiceover",
          startMs: 0,
          speed: 1,
          opacity: 1,
          warmth: 0,
          contrast: 0,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0,
          volume: 1,
          muted: false,
        }),
      ]
    : [];

  const musicDur = Math.max(1, aux?.music?.durationMs ?? spanMs);
  const musicClips = aux?.music
    ? [
        normalizeMediaClipTrimFields(musicDur, {
          id: `music-${aux.music.id}`,
          assetId: aux.music.id,
          label: "Music",
          startMs: 0,
          speed: 1,
          opacity: 1,
          warmth: 0,
          contrast: 0,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0,
          volume: musicVol,
          muted: false,
        }),
      ]
    : [];

  const capPreset = aux?.captionPresetId ?? "hormozi";
  const capGroup = aux?.captionGroupSize ?? 3;
  const textClips =
    totalVideoMs > 0
      ? [
          {
            id: `std-caption-${crypto.randomUUID()}`,
            assetId: aux?.voiceover?.id ?? null,
            label: "Captions",
            startMs: 0,
            durationMs: totalVideoMs,
            trimStartMs: 0,
            trimEndMs: 0,
            sourceMaxDurationMs: totalVideoMs,
            speed: 1,
            opacity: 1,
            warmth: 0,
            contrast: 0,
            positionX: 0,
            positionY: 0,
            scale: 1,
            rotation: 0,
            volume: 0,
            muted: true,
            captionPresetId: capPreset,
            captionGroupSize: capGroup,
            captionPositionY: 80,
            captionWords: [] as {
              word: string;
              startMs: number;
              endMs: number;
            }[],
          },
        ]
      : [];

  return [
    {
      id: "video",
      type: "video" as const,
      name: "Video",
      muted: false,
      locked: false,
      clips: videoClips,
      transitions: [],
    },
    {
      id: "audio",
      type: "audio" as const,
      name: "Audio",
      muted: false,
      locked: false,
      clips: audioClips,
      transitions: [],
    },
    {
      id: "music",
      type: "music" as const,
      name: "Music",
      muted: false,
      locked: false,
      clips: musicClips,
      transitions: [],
    },
    {
      id: "text",
      type: "text" as const,
      name: "Caption",
      muted: false,
      locked: false,
      clips: textClips,
      transitions: [],
    },
  ];
}

// ─── POST /api/editor/:id/ai-assemble ────────────────────────────────────────

app.post(
  "/:id/ai-assemble",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();
      const body = await c.req.json().catch(() => null);
      const parsed = aiAssembleRequestSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: "Invalid request body", issues: parsed.error.issues }, 400);
      }
      const { platform } = parsed.data;

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
      if (!project.generatedContentId) {
        return c.json(
          {
            error:
              "Project has no generated content — AI assembly requires generated shots",
          },
          404,
        );
      }

      const shotAssets = await loadProjectShotAssets(
        auth.user.id,
        project.generatedContentId,
      );

      if (shotAssets.length === 0) {
        return c.json({ error: "No shot clips available" }, 400);
      }

      const auxRows = await db
        .select({
          role: contentAssets.role,
          id: assets.id,
          durationMs: assets.durationMs,
        })
        .from(contentAssets)
        .innerJoin(assets, eq(contentAssets.assetId, assets.id))
        .where(
          and(
            eq(contentAssets.generatedContentId, project.generatedContentId),
            eq(assets.userId, auth.user.id),
          ),
        );
      const voiceR = auxRows.find((r) => r.role === "voiceover");
      const musicR = auxRows.find((r) => r.role === "background_music");
      const shotSpan = shotAssets.reduce(
        (s, a) => s + (a.durationMs ?? 5000),
        0,
      );
      const auxPack = {
        voiceover: voiceR
          ? { id: voiceR.id, durationMs: voiceR.durationMs }
          : undefined,
        music: musicR
          ? { id: musicR.id, durationMs: musicR.durationMs }
          : undefined,
        totalVideoMs: shotSpan,
      };

      const shotsContext = shotAssets.map((asset, i) => ({
        index: i,
        description:
          ((asset.metadata as Record<string, unknown>)
            ?.generationPrompt as string) ?? `Shot ${i + 1}`,
        durationMs: asset.durationMs ?? 5000,
      }));

      const targetDurationMs =
        platform === "tiktok"
          ? 15000
          : platform === "youtube-shorts"
            ? 60000
            : 30000;

      const prompt = buildAIAssemblyPrompt({
        shots: shotsContext,
        platform,
        targetDurationMs,
      });

      let aiResponse: z.infer<typeof aiAssemblyResponseSchema> | null = null;
      try {
        const result = await generateText({
          model: anthropic("claude-sonnet-4-6"),
          prompt,
          maxOutputTokens: 1024,
        });

        const text = result.text;
        const jsonMatch = text.match(/```json\n?([\s\S]+?)\n?```/);
        const raw = JSON.parse(jsonMatch ? jsonMatch[1] : text);
        aiResponse = aiAssemblyResponseSchema.parse(raw);

        const maxIndex = shotsContext.length - 1;
        for (const cut of aiResponse.cuts) {
          if (cut.shotIndex > maxIndex) {
            throw new Error(
              `Shot index ${cut.shotIndex} out of range (max ${maxIndex})`,
            );
          }
          const shotDuration = shotsContext[cut.shotIndex].durationMs;
          if (cut.trimEndMs > shotDuration) {
            throw new Error(
              `trimEndMs ${cut.trimEndMs} exceeds shot ${cut.shotIndex} duration ${shotDuration}`,
            );
          }
        }
      } catch (err) {
        debugLog.error(
          "AI assembly parse failed — returning Standard preset fallback",
          {
            service: "editor-route",
            operation: "aiAssemble",
            projectId: id,
            error: err instanceof Error ? err.message : "Unknown error",
          },
        );

        const standardTimeline = buildStandardPresetTracks(shotAssets, {
          voiceover: auxPack.voiceover,
          music: auxPack.music,
          musicVolume: 0.22,
          captionPresetId: "hormozi",
          captionGroupSize: 3,
        });
        return c.json({
          timeline: standardTimeline,
          assembledBy: "ai" as const,
          fallback: true,
        });
      }

      const timeline = convertAIResponseToTracks(
        aiResponse,
        shotAssets,
        auxPack,
      );

      return c.json({
        timeline,
        assembledBy: "ai" as const,
        fallback: false,
      });
    } catch (error) {
      debugLog.error("AI assembly failed", {
        service: "editor-route",
        operation: "aiAssemble",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to run AI assembly" }, 500);
    }
  },
);

// ─── POST /api/editor/:id/link-content ───────────────────────────────────────

app.post(
  "/:id/link-content",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const { id } = c.req.param();
      const auth = c.get("auth");

      const [project] = await db
        .select({
          id: editProjects.id,
          generatedContentId: editProjects.generatedContentId,
        })
        .from(editProjects)
        .where(
          and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
        )
        .limit(1);

      if (!project) return c.json({ error: "Not found" }, 404);

      // Already linked — idempotent return
      if (project.generatedContentId) {
        return c.json({ generatedContentId: project.generatedContentId });
      }

      // All three writes are in a transaction — partial failure leaves no orphaned rows.
      const linkedContentId = await db
        .transaction(async (tx) => {
          const [newContent] = await tx
            .insert(generatedContent)
            .values({
              userId: auth.user.id,
              prompt: null,
              status: "draft",
              version: 1,
              outputType: "full",
            })
            .returning({ id: generatedContent.id });

          // Link atomically — 0 rows updated means a concurrent request raced us
          const updated = await tx
            .update(editProjects)
            .set({ generatedContentId: newContent.id })
            .where(
              and(
                eq(editProjects.id, id),
                isNull(editProjects.generatedContentId),
              ),
            )
            .returning({ generatedContentId: editProjects.generatedContentId });

          if (!updated[0]) {
            throw new Error("RACE_LOST");
          }

          await tx.insert(queueItems).values({
            userId: auth.user.id,
            generatedContentId: newContent.id,
            status: "draft",
          });

          return newContent.id;
        })
        .catch(async (err: unknown) => {
          if (err instanceof Error && err.message === "RACE_LOST") {
            const [refetched] = await db
              .select({ generatedContentId: editProjects.generatedContentId })
              .from(editProjects)
              .where(eq(editProjects.id, id));
            return refetched?.generatedContentId ?? null;
          }
          throw err;
        });

      if (!linkedContentId) {
        return c.json({ error: "Failed to link content" }, 500);
      }

      return c.json({ generatedContentId: linkedContentId });
    } catch (error) {
      debugLog.error("Failed to link content", {
        service: "editor-route",
        operation: "linkContent",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to link content" }, 500);
    }
  },
);

// ─── POST /api/editor/:id/fork ───────────────────────────────────────────────

app.post(
  "/:id/fork",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const { id } = c.req.param();
      const auth = c.get("auth");
      const body = (await c.req.json().catch(() => ({}))) as {
        resetToAI?: boolean;
      };

      const [root] = await db
        .select()
        .from(editProjects)
        .where(
          and(
            eq(editProjects.id, id),
            eq(editProjects.userId, auth.user.id),
            isNull(editProjects.parentProjectId),
          ),
        )
        .limit(1);

      if (!root) return c.json({ error: "Not found" }, 404);

      // Build AI timeline outside the transaction (I/O-heavy, non-DB work)
      let aiTimeline: { tracks: unknown; durationMs: number } | null = null;
      if (body.resetToAI && root.generatedContentId) {
        aiTimeline = await buildInitialTimeline(
          root.generatedContentId,
          auth.user.id,
        );
      }

      // Snapshot + optional root reset must be atomic: a crash between the two
      // would leave a duplicate snapshot without the corresponding root update.
      const [snapshot] = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(editProjects)
          .values({
            userId: root.userId,
            generatedContentId: root.generatedContentId,
            tracks: root.tracks,
            durationMs: root.durationMs,
            fps: root.fps,
            resolution: root.resolution,
            status: "draft",
            title: root.title,
            parentProjectId: root.id,
          })
          .returning({ id: editProjects.id });

        if (aiTimeline) {
          await tx
            .update(editProjects)
            .set({
              tracks: aiTimeline.tracks,
              durationMs: aiTimeline.durationMs,
              status: "draft",
            })
            .where(eq(editProjects.id, root.id));
        }

        return inserted;
      });

      return c.json({ snapshotId: snapshot.id });
    } catch (error) {
      debugLog.error("Failed to fork project", {
        service: "editor-route",
        operation: "forkProject",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fork project" }, 500);
    }
  },
);

// ─── GET /api/editor/:id/versions ────────────────────────────────────────────

app.get(
  "/:id/versions",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const { id } = c.req.param();
      const auth = c.get("auth");

      const versions = await db
        .select({
          id: editProjects.id,
          createdAt: editProjects.createdAt,
          status: editProjects.status,
        })
        .from(editProjects)
        .where(
          and(
            eq(editProjects.parentProjectId, id),
            eq(editProjects.userId, auth.user.id),
          ),
        )
        .orderBy(desc(editProjects.createdAt));

      return c.json({ versions });
    } catch (error) {
      debugLog.error("Failed to list versions", {
        service: "editor-route",
        operation: "listVersions",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to list versions" }, 500);
    }
  },
);

// ─── PUT /api/editor/:id/restore-from/:snapshotId ────────────────────────────

app.put(
  "/:id/restore-from/:snapshotId",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const { id, snapshotId } = c.req.param();
      const auth = c.get("auth");

      const [rootResult, snapshotResult] = await Promise.all([
        db
          .select()
          .from(editProjects)
          .where(
            and(
              eq(editProjects.id, id),
              eq(editProjects.userId, auth.user.id),
              isNull(editProjects.parentProjectId),
            ),
          )
          .limit(1),
        db
          .select()
          .from(editProjects)
          .where(
            and(
              eq(editProjects.id, snapshotId),
              eq(editProjects.userId, auth.user.id),
              eq(editProjects.parentProjectId, id),
            ),
          )
          .limit(1),
      ]);

      const root = rootResult[0];
      const snapshot = snapshotResult[0];

      if (!root) return c.json({ error: "Root project not found" }, 404);
      if (!snapshot) return c.json({ error: "Snapshot not found" }, 404);

      await db.transaction(async (tx) => {
        // Preserve current root state as a new snapshot before overwriting
        await tx.insert(editProjects).values({
          userId: root.userId,
          generatedContentId: root.generatedContentId,
          tracks: root.tracks,
          durationMs: root.durationMs,
          fps: root.fps,
          resolution: root.resolution,
          status: "draft",
          title: root.title,
          parentProjectId: root.id,
        });

        // Overwrite root with the target snapshot's tracks
        await tx
          .update(editProjects)
          .set({
            tracks: snapshot.tracks,
            durationMs: snapshot.durationMs,
            status: "draft",
          })
          .where(eq(editProjects.id, root.id));
      });

      return c.json({ ok: true });
    } catch (error) {
      debugLog.error("Failed to restore from snapshot", {
        service: "editor-route",
        operation: "restoreFromSnapshot",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to restore from snapshot" }, 500);
    }
  },
);

export default app;
