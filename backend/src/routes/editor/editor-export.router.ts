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
  assets,
  generatedContent,
  queueItems,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc, count, isNull } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { getFileUrl } from "../../services/storage/r2";
import { exportSchema } from "./schemas";
import { runExportJob } from "./export-worker";
import { editorProjectIdParamSchema } from "../../domain/editor/editor.schemas";
import { AppError, Errors } from "../../utils/errors/app-error";

const exportRouter = new Hono<HonoEnv>();
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

// ─── POST /api/editor/:id/export ─────────────────────────────────────────────

exportRouter.post(
  "/:id/export",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, validationErrorHook),
  zValidator("json", exportSchema),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const parsed = c.req.valid("json");

    const [project] = await db
      .select()
      .from(editProjects)
      .where(
        and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
      )
      .limit(1);

    if (!project) {
      throw Errors.notFound("Edit project");
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
        throw Errors.internal("Failed to initialise pipeline for this project");
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
      throw new AppError(
        "Too many active export jobs. Please wait for a current export to finish.",
        "EXPORT_LIMIT_REACHED",
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
  },
);

// ─── GET /api/editor/:id/export/status ───────────────────────────────────────

exportRouter.get(
  "/:id/export/status",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");

    // Verify project exists and is owned by user before exposing any export data.
    const [project] = await db
      .select({ id: editProjects.id })
      .from(editProjects)
      .where(
        and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)),
      )
      .limit(1);

    if (!project) {
      throw Errors.notFound("Edit project");
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
  },
);

export default exportRouter;
