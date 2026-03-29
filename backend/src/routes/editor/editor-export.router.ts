import { Hono } from "hono";
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
  assets,
  generatedContent,
  queueItems,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc, count, isNull } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { getFileUrl } from "../../services/storage/r2";
import { exportSchema } from "./schemas";
import { runExportJob } from "./export-worker";

const exportRouter = new Hono<HonoEnv>();

// ─── POST /api/editor/:id/export ─────────────────────────────────────────────

exportRouter.post(
  "/:id/export",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", exportSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { id } = c.req.param();
      const parsed = c.req.valid("json");

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
      runExportJob(job.id, project, auth.user.id, parsed).catch((err: unknown) => {
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

exportRouter.get(
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

export default exportRouter;
