import { systemLogger } from "@/utils/system/system-logger";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { getFileUrl } from "../../services/storage/r2";
import {
  exportSchema,
  editorProjectIdParamSchema,
} from "../../domain/editor/editor.schemas";
import { runExportJob } from "./export-worker";
import { AppError, Errors } from "../../utils/errors/app-error";
import { assetsRepository, editorRepository } from "../../domain/singletons";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import {
  computeDocumentHash,
  type PersistedProjectFile,
} from "../../domain/editor/project-document";

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

    const doc = project.projectDocument as PersistedProjectFile | null;
    if (!doc) throw Errors.badRequest("Project has no document yet");

    const revision = await editorRepository.insertExportRevision({
      projectId: id,
      userId: auth.user.id,
      projectDocument: doc,
      documentHash: computeDocumentHash(doc),
    });

    const job = await editorRepository.insertQueuedExportJob(
      id,
      auth.user.id,
      revision.id,
      { resolution: parsed.resolution, fps: parsed.fps },
    );

    runExportJob(job.id, revision.id, auth.user.id, parsed).catch(
      (err: unknown) => {
        systemLogger.error("Export job failed", {
          service: "editor-route",
          operation: "runExportJob",
          jobId: job.id,
          revisionId: revision.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      },
    );

    return c.json({ exportJobId: job.id, projectRevisionId: revision.id }, 202);
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
      progressPhase: job.progressPhase ?? undefined,
      projectRevisionId: job.projectRevisionId ?? undefined,
      r2Url,
      error: job.error ?? undefined,
    });
  },
);

export default exportRouter;
