import { Hono } from "hono";
import { z } from "zod";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  editProjects,
  exportJobs,
  assets,
  contentAssets,
  generatedContent,
  queueItems,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc, count, inArray, isNull, notInArray } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { getFileUrl, uploadFile } from "../../services/storage/r2";
import { tmpdir } from "os";
import { join } from "path";
import { unlinkSync, existsSync, writeFileSync } from "fs";
import { generateASS } from "./export/ass-generator";
import { buildInitialTimeline } from "./services/build-initial-timeline";
import {
  resolveContentChainIds,
  refreshEditorTimeline,
} from "./services/refresh-editor-timeline";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ANTHROPIC_API_KEY } from "../../utils/config/envUtil";
import { buildAIAssemblyPrompt } from "./services/ai-assembly-prompt";

const app = new Hono<HonoEnv>();

const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY ?? "" });

/** Chain ffmpeg `atempo` filters (each accepts 0.5–2.0) to match clip playback speed. */
function buildFfmpegAtempoChain(speed: number): string {
  if (!speed || Math.abs(speed - 1) < 1e-6) return "";
  let s = speed;
  const parts: string[] = [];
  while (s > 2 + 1e-6) {
    parts.push("atempo=2");
    s /= 2;
  }
  while (s < 0.5 - 1e-6) {
    parts.push("atempo=0.5");
    s /= 0.5;
  }
  if (Math.abs(s - 1) > 1e-6) {
    parts.push(`atempo=${s.toFixed(4)}`);
  }
  return parts.join(",");
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const resolutionEnum = z.enum([
  "1080x1920",
  "720x1280",
  "2160x3840",
  "1920x1080",
  "1080x1080",
]);

const clipDataSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().nullable(),
  label: z.string().max(200),
  startMs: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  trimStartMs: z.number().int().min(0),
  trimEndMs: z.number().int().min(0),
  speed: z.number().min(0.1).max(10),
  // Look
  opacity: z.number().min(0).max(1),
  warmth: z.number().min(-1).max(1),
  contrast: z.number().min(-1).max(1),
  // Transform
  positionX: z.number(),
  positionY: z.number(),
  scale: z.number().min(0.01).max(10),
  rotation: z.number().min(-360).max(360),
  // Sound
  volume: z.number().min(0).max(2),
  muted: z.boolean(),
  // Text-only
  textContent: z.string().max(2000).optional(),
  textStyle: z
    .object({
      fontSize: z.number(),
      fontWeight: z.enum(["normal", "bold"]),
      color: z.string(),
      align: z.enum(["left", "center", "right"]),
    })
    .optional(),
  // ── Caption fields ────────────────────────────────────────────────
  captionId: z.string().optional(),
  captionWords: z
    .array(
      z.object({
        word: z.string(),
        startMs: z.number().int().min(0),
        endMs: z.number().int().min(0),
      }),
    )
    .optional(),
  captionPresetId: z.string().max(50).optional(),
  captionGroupSize: z.number().int().min(1).max(10).optional(),
  captionPositionY: z.number().min(0).max(100).optional(),
  captionFontSizeOverride: z.number().int().min(8).max(200).optional(),
});

const transitionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "fade",
    "slide-left",
    "slide-up",
    "dissolve",
    "wipe-right",
    "none",
  ]),
  durationMs: z.number().int().min(200).max(2000),
  clipAId: z.string().min(1),
  clipBId: z.string().min(1),
});

const trackDataSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["video", "audio", "music", "text"]),
  name: z.string().min(1),
  muted: z.boolean(),
  locked: z.boolean(),
  clips: z.array(clipDataSchema),
  transitions: z.array(transitionSchema).optional(),
});

const patchProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  tracks: z.array(trackDataSchema).optional(),
  durationMs: z.number().int().min(0).optional(),
  fps: z.number().int().min(1).max(120).optional(),
  resolution: resolutionEnum.optional(),
});

const createProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  generatedContentId: z.number().int().optional(),
});

const exportSchema = z.object({
  resolution: resolutionEnum.optional(),
  fps: z.union([z.literal(24), z.literal(30), z.literal(60)]).optional(),
});

const aiAssemblyResponseSchema = z.object({
  shotOrder: z.array(z.number().int().min(0)),
  cuts: z.array(
    z.object({
      shotIndex: z.number().int().min(0),
      trimStartMs: z.number().int().min(0),
      trimEndMs: z.number().int().min(0),
      transition: z.enum(["cut", "fade", "slide-left", "dissolve"]),
    }),
  ),
  captionStyle: z.enum(["bold-outline", "clean-white", "highlight"]).optional(),
  captionGroupSize: z.number().int().min(1).max(6).optional(),
  musicVolume: z.number().min(0).max(1),
  totalDuration: z.number().int().min(1000).max(120000),
});

const aiAssembleRequestSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "youtube-shorts"]),
});

// ─── GET /api/editor/assets ──────────────────────────────────────────────────
// Must be registered before /:id routes to avoid param capture.

app.get(
  "/assets",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const contentIdParam = c.req.query("contentId");
      const roles = c.req.queries("role") ?? [];

      // Sub-select: only content owned by this user
      const userContentIds = db
        .select({ id: generatedContent.id })
        .from(generatedContent)
        .where(eq(generatedContent.userId, auth.user.id));

      const conditions: ReturnType<typeof eq>[] = [
        inArray(contentAssets.generatedContentId, userContentIds) as ReturnType<
          typeof eq
        >,
      ];

      if (contentIdParam) {
        conditions.push(
          eq(contentAssets.generatedContentId, Number(contentIdParam)),
        );
      }
      if (roles.length > 0) {
        conditions.push(
          inArray(contentAssets.role, roles) as ReturnType<typeof eq>,
        );
      } else {
        conditions.push(
          notInArray(contentAssets.role, [
            "assembled_video",
            "final_video",
          ]) as ReturnType<typeof eq>,
        );
      }

      const result = await db
        .select({
          id: contentAssets.id,
          generatedContentId: contentAssets.generatedContentId,
          role: contentAssets.role,
          r2Url: assets.r2Url,
          durationMs: assets.durationMs,
          sourceHook: generatedContent.generatedHook,
        })
        .from(contentAssets)
        .innerJoin(assets, eq(contentAssets.assetId, assets.id))
        .innerJoin(
          generatedContent,
          eq(contentAssets.generatedContentId, generatedContent.id),
        )
        .where(and(...conditions))
        .orderBy(desc(assets.createdAt))
        .limit(100);

      return c.json({ assets: result });
    } catch (error) {
      debugLog.error("Failed to list editor assets", {
        service: "editor-route",
        operation: "listAssets",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to list editor assets" }, 500);
    }
  },
);

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
        return c.json({ error: "Invalid request body" }, 400);
      }

      const { generatedContentId, title } = parsed.data;

      // ── Upsert: if generatedContentId provided, find or update existing project ──
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
          .select()
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
          const [contentRow] = await db
            .select({ generatedHook: generatedContent.generatedHook })
            .from(generatedContent)
            .where(
              and(
                eq(generatedContent.id, generatedContentId),
                eq(generatedContent.userId, auth.user.id),
              ),
            )
            .limit(1);
          const titleUpdate =
            existing.autoTitle && contentRow?.generatedHook
              ? { title: contentRow.generatedHook.slice(0, 60) }
              : {};

          // Only rebuild the timeline if the user has never actively edited
          // this project (i.e. never triggered an auto-save PATCH).
          if (!existing.userHasEdited) {
            const { tracks, durationMs } = await buildInitialTimeline(
              generatedContentId,
              auth.user.id,
            );
            const [updated] = await db
              .update(editProjects)
              .set({ generatedContentId, tracks, durationMs, ...titleUpdate })
              .where(eq(editProjects.id, existing.id))
              .returning();
            return c.json({ project: updated }, 200);
          }

          // Update metadata first, then merge any new/resolved assets into
          // the existing user-edited tracks without touching clip positions.
          await db
            .update(editProjects)
            .set({ generatedContentId, ...titleUpdate })
            .where(eq(editProjects.id, existing.id));
          await refreshEditorTimeline(generatedContentId, auth.user.id);
          const [refreshed] = await db
            .select()
            .from(editProjects)
            .where(eq(editProjects.id, existing.id))
            .limit(1);
          return c.json({ project: refreshed }, 200);
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
          insertTitle = hookRow.generatedHook.slice(0, 60);
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
            .select()
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
            return c.json({ project: existing }, 200);
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
        return c.json({ error: "Invalid request body" }, 400);
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
      if (parsed.data.tracks !== undefined)
        updateData.tracks = parsed.data.tracks;
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
        return c.json({ error: "Invalid request body" }, 400);
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

// ─── ffmpeg render worker ────────────────────────────────────────────────────

interface ClipData {
  id?: string;
  assetId: string | null;
  r2Key?: string;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  speed: number;
  volume: number;
  muted: boolean;
  textContent?: string;
  positionX?: number;
  positionY?: number;
  scale?: number;
  captionWords?: Array<{ word: string; startMs: number; endMs: number }>;
  captionPresetId?: string;
  captionGroupSize?: number;
  captionPositionY?: number;
  captionFontSizeOverride?: number;
  contrast?: number;
  warmth?: number;
  opacity?: number;
}

interface TransitionData {
  id: string;
  type: "fade" | "slide-left" | "slide-up" | "dissolve" | "wipe-right" | "none";
  durationMs: number;
  clipAId: string;
  clipBId: string;
}

interface TrackData {
  id?: string;
  type: "video" | "audio" | "music" | "text";
  muted: boolean;
  clips: ClipData[];
  transitions?: TransitionData[];
}

async function setJobProgress(
  jobId: string,
  progress: number,
  status = "rendering",
) {
  await db
    .update(exportJobs)
    .set({ progress, status })
    .where(eq(exportJobs.id, jobId));
}

async function runExportJob(
  jobId: string,
  project: {
    id: string;
    tracks: unknown;
    durationMs: number;
    fps: number;
    resolution: string;
  },
  userId: string,
  opts: { resolution?: string; fps?: number },
) {
  const tmpFiles: string[] = [];

  try {
    await db
      .update(exportJobs)
      .set({ status: "rendering", progress: 5 })
      .where(eq(exportJobs.id, jobId));

    const tracks = (project.tracks as TrackData[]) ?? [];
    const fps = opts.fps ?? project.fps ?? 30;
    const resolution = opts.resolution ?? project.resolution ?? "1080x1920";
    const resolutionMap: Record<string, [number, number]> = {
      "1080x1920": [1080, 1920],
      "720x1280": [720, 1280],
      "2160x3840": [2160, 3840],
      "1920x1080": [1920, 1080],
      "1080x1080": [1080, 1080],
    };
    const [outW, outH] = resolutionMap[resolution] ?? [1080, 1920];

    // Collect all asset IDs to resolve R2 keys
    const assetIds = tracks
      .flatMap((t) => t.clips)
      .map((c) => c.assetId)
      .filter((id): id is string => !!id);

    let assetsMap: Record<string, { r2Key: string; type: string }> = {};
    if (assetIds.length > 0) {
      const assetRows = await db
        .select({
          id: assets.id,
          r2Key: assets.r2Key,
          type: assets.type,
        })
        .from(assets)
        .where(and(inArray(assets.id, assetIds), eq(assets.userId, userId)));
      assetsMap = Object.fromEntries(
        assetRows.map((a) => [a.id, { r2Key: a.r2Key!, type: a.type }]),
      );
    }

    await setJobProgress(jobId, 20);

    // Build ffmpeg inputs and filtergraph
    const videoTrack = tracks.find((t) => t.type === "video");
    const audioTrack = tracks.find((t) => t.type === "audio" && !t.muted);
    const musicTrack = tracks.find((t) => t.type === "music" && !t.muted);
    const textTrack = tracks.find((t) => t.type === "text");

    const videoClips = (videoTrack?.clips ?? []).filter(
      (c) => c.assetId && assetsMap[c.assetId],
    );
    const audioClips = (audioTrack?.clips ?? []).filter(
      (c) => c.assetId && assetsMap[c.assetId],
    );
    const musicClips = (musicTrack?.clips ?? []).filter(
      (c) => c.assetId && assetsMap[c.assetId],
    );

    if (videoClips.length === 0) {
      await db
        .update(exportJobs)
        .set({ status: "failed", error: "No video clips on timeline" })
        .where(eq(exportJobs.id, jobId));
      return;
    }

    // Download all needed files to temp
    const downloadToTmp = async (
      r2Key: string,
      ext: string,
    ): Promise<string> => {
      const signedUrl = await getFileUrl(r2Key, 3600);
      const res = await fetch(signedUrl);
      if (!res.ok)
        throw new Error(`Failed to download ${r2Key}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const path = join(
        tmpdir(),
        `export-${jobId}-${crypto.randomUUID()}.${ext}`,
      );
      writeFileSync(path, buf);
      tmpFiles.push(path);
      return path;
    };

    // Build input list
    const ffmpegInputs: string[] = [];
    const clipPaths: string[] = [];

    for (const clip of videoClips) {
      const asset = assetsMap[clip.assetId!];
      const ext = asset.r2Key.split(".").pop() ?? "mp4";
      const path = await downloadToTmp(asset.r2Key, ext);
      clipPaths.push(path);
      ffmpegInputs.push("-i", path);
    }

    await setJobProgress(jobId, 40);

    const audioInputPaths: string[] = [];
    for (const clip of [...audioClips, ...musicClips]) {
      const asset = assetsMap[clip.assetId!];
      const ext = asset.r2Key.split(".").pop() ?? "mp3";
      const path = await downloadToTmp(asset.r2Key, ext);
      audioInputPaths.push(path);
      ffmpegInputs.push("-i", path);
    }

    // Build filtergraph
    const filterParts: string[] = [];
    const videoInputCount = videoClips.length;

    // Trim and scale each video clip
    videoClips.forEach((clip, i) => {
      const trimStart = (clip.trimStartMs ?? 0) / 1000;
      const pts =
        clip.speed && clip.speed !== 1
          ? `setpts=${(1 / clip.speed).toFixed(4)}*PTS,`
          : "";

      const colorFilters: string[] = [];
      if (clip.contrast && clip.contrast !== 0) {
        colorFilters.push(`eq=contrast=${1 + clip.contrast / 100}`);
      }
      if (clip.warmth && clip.warmth !== 0) {
        const warmShift = clip.warmth / 200;
        colorFilters.push(`colorbalance=rs=${warmShift}:bs=${-warmShift}`);
      }
      if (clip.opacity !== undefined && clip.opacity !== 1) {
        colorFilters.push(
          `format=yuva420p,colorchannelmixer=aa=${clip.opacity}`,
        );
      }
      const colorStr =
        colorFilters.length > 0 ? colorFilters.join(",") + "," : "";

      filterParts.push(
        `[${i}:v]trim=start=${trimStart}:duration=${clip.durationMs / 1000},` +
          `${pts}scale=${outW}:${outH}:force_original_aspect_ratio=decrease,` +
          `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:black,${colorStr}setpts=PTS-STARTPTS[v${i}]`,
      );
    });

    // Add text overlays via drawtext
    const textClips = textTrack?.clips ?? [];
    let latestVideoLabel = "";

    // Join clips with xfade (or hard cut if no transition)
    const videoTransitions = videoTrack?.transitions ?? [];

    if (videoInputCount === 1) {
      latestVideoLabel = "v0";
    } else {
      const xfadeTypeMap: Record<string, string> = {
        fade: "fade",
        "slide-left": "slideleft",
        "slide-up": "slideup",
        dissolve: "dissolve",
        "wipe-right": "wiperight",
      };

      let currentLabel = "[v0]";
      let accumulatedDuration = videoClips[0].durationMs / 1000;

      for (let i = 1; i < videoClips.length; i++) {
        const clipA = videoClips[i - 1];
        const clipB = videoClips[i];
        const trans = videoTransitions.find(
          (t) => t.clipAId === clipA.id && t.clipBId === clipB.id,
        );

        const isLast = i === videoClips.length - 1;
        const outLabel = isLast ? "[vjoined]" : `[vx${i}]`;

        if (trans && trans.type !== "none" && xfadeTypeMap[trans.type]) {
          const xfadeType = xfadeTypeMap[trans.type];
          const transDurSec = trans.durationMs / 1000;
          const offset = accumulatedDuration - transDurSec;

          filterParts.push(
            `${currentLabel}[v${i}]xfade=transition=${xfadeType}:duration=${transDurSec}:offset=${offset.toFixed(4)}${outLabel}`,
          );
          accumulatedDuration += clipB.durationMs / 1000 - transDurSec;
        } else {
          const offset = accumulatedDuration;
          filterParts.push(
            `${currentLabel}[v${i}]xfade=transition=fade:duration=0.001:offset=${offset.toFixed(4)}${outLabel}`,
          );
          accumulatedDuration += clipB.durationMs / 1000;
        }
        currentLabel = outLabel;
      }
      latestVideoLabel = "vjoined";
    }

    // Apply text overlays
    textClips.forEach((clip, i) => {
      if (!clip.textContent) return;
      const startSec = clip.startMs / 1000;
      const endSec = (clip.startMs + clip.durationMs) / 1000;
      const x = clip.positionX ?? 0;
      const y = clip.positionY ?? 0;
      const label = `vtxt${i}`;
      const prevLabel = i === 0 ? latestVideoLabel : `vtxt${i - 1}`;
      // Write text to a temp file to avoid ffmpeg drawtext injection via special characters.
      const textFilePath = join(tmpdir(), `export-${jobId}-text-${i}.txt`);
      writeFileSync(textFilePath, clip.textContent);
      tmpFiles.push(textFilePath);
      filterParts.push(
        `[${prevLabel}]drawtext=textfile='${textFilePath}':fontsize=48:fontcolor=white:` +
          `x=${x}:y=${y}:enable='between(t,${startSec},${endSec})'[${label}]`,
      );
      latestVideoLabel = label;
    });

    // ── Burn captions via ASS subtitle file ──────────────────────────────
    const captionClips = textClips.filter(
      (c: any) => c.captionWords?.length && c.captionPresetId,
    );

    if (captionClips.length > 0) {
      for (const captionClip of captionClips) {
        const assContent = generateASS(
          captionClip.captionWords ?? [],
          captionClip.captionPresetId!,
          [outW, outH],
          captionClip.captionGroupSize ?? 3,
          captionClip.startMs ?? 0,
        );

        const assPath = join(
          tmpdir(),
          `export-${jobId}-captions-${crypto.randomUUID()}.ass`,
        );
        writeFileSync(assPath, assContent, "utf-8");
        tmpFiles.push(assPath);

        const assLabel = `vcap${captionClips.indexOf(captionClip)}`;
        filterParts.push(
          `[${latestVideoLabel}]ass='${assPath.replace(/'/g, "'\\''")}'[${assLabel}]`,
        );
        latestVideoLabel = assLabel;
      }
    }

    // Mix audio
    const allAudioClips = [...audioClips, ...musicClips];
    let finalAudioLabel = "";
    if (allAudioClips.length > 0) {
      allAudioClips.forEach((clip, i) => {
        const inputIdx = videoInputCount + i;
        const vol = (clip.muted ? 0 : (clip.volume ?? 1)).toFixed(2);
        const trimStart = (clip.trimStartMs ?? 0) / 1000;
        const durSec = clip.durationMs / 1000;
        const atempo = buildFfmpegAtempoChain(clip.speed ?? 1);
        const tempoPart = atempo ? `,${atempo}` : "";
        filterParts.push(
          `[${inputIdx}:a]atrim=start=${trimStart}:duration=${durSec},asetpts=PTS-STARTPTS${tempoPart},volume=${vol}[a${i}]`,
        );
      });
      if (allAudioClips.length > 1) {
        const amixInputs = allAudioClips.map((_, i) => `[a${i}]`).join("");
        filterParts.push(
          `${amixInputs}amix=inputs=${allAudioClips.length}[amix]`,
        );
        finalAudioLabel = "amix";
      } else {
        finalAudioLabel = "a0";
      }
    }

    const tmpOut = join(tmpdir(), `export-${jobId}-out.mp4`);
    tmpFiles.push(tmpOut);

    const ffmpegArgs = [
      ...ffmpegInputs,
      "-filter_complex",
      filterParts.join(";"),
      "-map",
      `[${latestVideoLabel}]`,
    ];

    if (finalAudioLabel) {
      ffmpegArgs.push("-map", `[${finalAudioLabel}]`);
    }

    ffmpegArgs.push(
      "-c:v",
      "libx264",
      "-crf",
      "18",
      "-preset",
      "fast",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(fps),
    );

    if (finalAudioLabel) {
      ffmpegArgs.push("-c:a", "aac", "-b:a", "192k");
    }

    ffmpegArgs.push("-y", tmpOut);

    await setJobProgress(jobId, 55);

    const proc = Bun.spawn(["ffmpeg", ...ffmpegArgs], {
      stderr: "pipe",
      stdout: "ignore",
    });

    await proc.exited;

    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(
        `FFmpeg failed (exit ${proc.exitCode}): ${stderr.slice(-800)}`,
      );
    }

    await setJobProgress(jobId, 85);

    // Upload to R2 and create asset row
    const outBuffer = Buffer.from(await Bun.file(tmpOut).arrayBuffer());
    const r2Key = `exports/${userId}/${project.id}/${jobId}.mp4`;
    const r2Url = await uploadFile(outBuffer, r2Key, "video/mp4");

    const [outputAsset] = await db
      .insert(assets)
      .values({
        userId,
        type: "assembled_video",
        source: "export",
        r2Key,
        r2Url,
        sizeBytes: outBuffer.length,
        metadata: { editProjectId: project.id, jobId, resolution, fps },
      })
      .returning({ id: assets.id });

    await db
      .update(exportJobs)
      .set({ status: "done", progress: 100, outputAssetId: outputAsset.id })
      .where(eq(exportJobs.id, jobId));

    debugLog.info("Export job completed", {
      service: "editor-route",
      operation: "runExportJob",
      jobId,
      r2Key,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(exportJobs)
      .set({ status: "failed", error: message.slice(0, 500) })
      .where(eq(exportJobs.id, jobId))
      .catch(() => {});

    debugLog.error("Export job failed", {
      service: "editor-route",
      operation: "runExportJob",
      jobId,
      error: message,
    });
  } finally {
    // Cleanup temp files
    for (const f of tmpFiles) {
      try {
        if (existsSync(f)) unlinkSync(f);
      } catch {
        // ignore
      }
    }
  }
}

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
  if (style === "clean-white") return "clean-white";
  if (style === "highlight") return "highlight";
  return "bold-outline";
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
    const clipDuration = cut.trimEndMs - cut.trimStartMs;
    const clip = {
      id: `ai-clip-${i}`,
      assetId: asset.id,
      label: `Shot ${cut.shotIndex + 1}`,
      startMs: cursor,
      durationMs: clipDuration,
      trimStartMs: cut.trimStartMs,
      trimEndMs: cut.trimEndMs,
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
    };
    cursor += clipDuration;
    return clip;
  });

  const totalVideoMs = cursor;
  const spanMs = Math.max(totalVideoMs, aux.totalVideoMs, 1000);

  const voiceDur = aux.voiceover?.durationMs ?? spanMs;
  const audioClips = aux.voiceover
    ? [
        {
          id: `voiceover-${aux.voiceover.id}`,
          assetId: aux.voiceover.id,
          label: "Voiceover",
          startMs: 0,
          durationMs: voiceDur,
          trimStartMs: 0,
          trimEndMs: voiceDur,
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
        },
      ]
    : [];

  const musicDur = aux.music?.durationMs ?? spanMs;
  const musicClips = aux.music
    ? [
        {
          id: `music-${aux.music.id}`,
          assetId: aux.music.id,
          label: "Music",
          startMs: 0,
          durationMs: musicDur,
          trimStartMs: 0,
          trimEndMs: musicDur,
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
        },
      ]
    : [];

  const captionPresetId = aiResponse.captionStyle
    ? mapCaptionStyleToPresetId(aiResponse.captionStyle)
    : "bold-outline";
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
            trimEndMs: totalVideoMs,
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
    const clip = {
      id: `std-clip-${i}`,
      assetId: asset.id,
      label: `Shot ${i + 1}`,
      startMs: cursor,
      durationMs,
      trimStartMs: 0,
      trimEndMs: durationMs,
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
    };
    cursor += durationMs;
    return clip;
  });

  const totalVideoMs = cursor;
  const spanMs = Math.max(totalVideoMs, 1000);
  const musicVol = aux?.musicVolume ?? 0.22;

  const voiceDur = aux?.voiceover?.durationMs ?? spanMs;
  const audioClips = aux?.voiceover
    ? [
        {
          id: `voiceover-${aux.voiceover.id}`,
          assetId: aux.voiceover.id,
          label: "Voiceover",
          startMs: 0,
          durationMs: voiceDur,
          trimStartMs: 0,
          trimEndMs: voiceDur,
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
        },
      ]
    : [];

  const musicDur = aux?.music?.durationMs ?? spanMs;
  const musicClips = aux?.music
    ? [
        {
          id: `music-${aux.music.id}`,
          assetId: aux.music.id,
          label: "Music",
          startMs: 0,
          durationMs: musicDur,
          trimStartMs: 0,
          trimEndMs: musicDur,
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
        },
      ]
    : [];

  const capPreset = aux?.captionPresetId ?? "bold-outline";
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
            trimEndMs: totalVideoMs,
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
        return c.json({ error: "Invalid request body" }, 400);
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
          captionPresetId: "bold-outline",
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
