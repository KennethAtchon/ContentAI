import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { videoJobService } from "../../services/video-generation/job.service";
import { AppError, Errors } from "../../utils/errors/app-error";
import {
  fetchOwnedContent,
  getPhase4AssemblyFromMetadata,
  updatePhase4Metadata,
} from "./phase4-metadata";
import { enqueue, runReelGeneration } from "../../domain/video/reel-job-runner";
import { createReelSchema } from "../../domain/video/video.schemas";

const reelGenerateRouter = new Hono<HonoEnv>();

// POST /api/video/reel
reelGenerateRouter.post(
  "/reel",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createReelSchema),
  async (c) => {
    const auth = c.get("auth");
    const payload = c.req.valid("json");

    const content = await fetchOwnedContent(
      auth.user.id,
      payload.generatedContentId,
    );
    if (!content) {
      throw Errors.notFound("Content");
    }

    // Require at least a hook or a script before generating video — prevents
    // silent single-shot fallbacks on content that hasn't been written yet.
    if (!content.generatedHook && !content.generatedScript && !payload.prompt) {
      throw new AppError(
        "Content must have a generated hook or script before video generation",
        "PHASE4_CONTENT_NOT_READY",
        422,
      );
    }

    const resolvedPrompt =
      payload.prompt?.trim() ||
      content.generatedHook?.trim() ||
      content.prompt?.trim();
    if (!resolvedPrompt) {
      throw new AppError(
        "No prompt available for video generation",
        "PHASE4_PROMPT_REQUIRED",
        400,
      );
    }

    const assembly = getPhase4AssemblyFromMetadata(content.generatedMetadata);
    if (
      assembly &&
      (assembly.status === "queued" || assembly.status === "running")
    ) {
      const existing = await videoJobService.getJob(assembly.jobId);
      if (
        existing &&
        (existing.status === "queued" || existing.status === "running")
      ) {
        if (
          existing.kind === "reel_generate" &&
          existing.generatedContentId === payload.generatedContentId
        ) {
          return c.json(
            {
              jobId: existing.id,
              status: existing.status,
              generatedContentId: payload.generatedContentId,
            },
            202,
          );
        }
        throw new AppError(
          "Another video task is already running for this content",
          "VIDEO_JOB_IN_PROGRESS",
          409,
          { jobId: existing.id, kind: existing.kind },
        );
      }
    }

    const job = await videoJobService.createJob({
      userId: auth.user.id,
      generatedContentId: payload.generatedContentId,
      kind: "reel_generate",
      request: {
        ...payload,
        prompt: resolvedPrompt,
      },
    });

    await updatePhase4Metadata({
      generatedContentId: payload.generatedContentId,
      existingGeneratedMetadata: content.generatedMetadata,
      jobId: job.id,
      status: "queued",
    });

    enqueue("reel_generate", () =>
      runReelGeneration({
        job,
        prompt: resolvedPrompt,
        durationSeconds: payload.durationSeconds,
        aspectRatio: payload.aspectRatio,
        provider: payload.provider,
      }),
    );

    return c.json(
      {
        jobId: job.id,
        status: job.status,
        generatedContentId: payload.generatedContentId,
      },
      202,
    );
  },
);

export default reelGenerateRouter;
