import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { debugLog } from "../../utils/debug/debug";
import { getFileUrl } from "../../services/storage/r2";
import { exportSchema } from "./schemas";
import { runExportJob } from "./export-worker";
import { editorProjectIdParamSchema } from "../../domain/editor/editor.schemas";
import { AppError, Errors } from "../../utils/errors/app-error";
import { assetsRepository, editorRepository } from "../../domain/singletons";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";

const exportRouter = new Hono<HonoEnv>();

// ─── POST /api/editor/:id/export ─────────────────────────────────────────────

exportRouter.post(
  "/:id/export",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  zValidator("json", exportSchema),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const parsed = c.req.valid("json");

    const project = await editorRepository.findByIdAndUserId(id, auth.user.id);
    if (!project) throw Errors.notFound("Edit project");

    if (!project.generatedContentId) {
      const newContentId =
        await editorRepository.createDraftContentAndLinkBlankProject(
          auth.user.id,
          id,
        );
      project.generatedContentId = newContentId;
    }

    const activeJobs = await editorRepository.countRenderingExportJobsByUser(
      auth.user.id,
    );

    if (activeJobs >= 2) {
      throw new AppError(
        "Too many active export jobs. Please wait for a current export to finish.",
        "EXPORT_LIMIT_REACHED",
        429,
      );
    }

    const job = await editorRepository.insertQueuedExportJob(id, auth.user.id);

    runExportJob(job.id, project, auth.user.id, parsed).catch(
      (err: unknown) => {
        debugLog.error("Export job failed", {
          service: "editor-route",
          operation: "runExportJob",
          jobId: job.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      },
    );

    return c.json({ exportJobId: job.id }, 202);
  },
);

// ─── GET /api/editor/:id/export/status ───────────────────────────────────────

exportRouter.get(
  "/:id/export/status",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", editorProjectIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");

    const project = await editorRepository.findByIdAndUserId(id, auth.user.id);
    if (!project) throw Errors.notFound("Edit project");

    const job = await editorRepository.findLatestExportJobForProject(
      id,
      auth.user.id,
    );

    if (!job) {
      return c.json({ status: "idle", progress: 0 });
    }

    let r2Url: string | undefined;
    if (job.status === "done" && job.outputAssetId) {
      const outputAsset = await assetsRepository.findR2FieldsByIdForUser(
        auth.user.id,
        job.outputAssetId,
      );
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
