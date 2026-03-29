import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { videoJobService } from "../../services/video/job.service";
import { debugLog } from "../../utils/debug/debug";
import { createReelSchema } from "./schemas";
import {
  fetchOwnedContent,
  getPhase4AssemblyFromMetadata,
  updatePhase4Metadata,
} from "./phase4-metadata";
import { enqueue, runReelGeneration } from "./reel-job-runner";

const reelGenerateRouter = new Hono<HonoEnv>();

// POST /api/video/reel
reelGenerateRouter.post(
  "/reel",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createReelSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const payload = c.req.valid("json");

      const content = await fetchOwnedContent(
        auth.user.id,
        payload.generatedContentId,
      );
      if (!content) {
        return c.json({ error: "Content not found" }, 404);
      }

      // Require at least a hook or a script before generating video — prevents
      // silent single-shot fallbacks on content that hasn't been written yet.
      if (
        !content.generatedHook &&
        !content.generatedScript &&
        !payload.prompt
      ) {
        return c.json(
          {
            error:
              "Content must have a generated hook or script before video generation",
            code: "PHASE4_CONTENT_NOT_READY",
          },
          422,
        );
      }

      const resolvedPrompt =
        payload.prompt?.trim() ||
        content.generatedHook?.trim() ||
        content.prompt?.trim();
      if (!resolvedPrompt) {
        return c.json(
          {
            error: "No prompt available for video generation",
            code: "PHASE4_PROMPT_REQUIRED",
          },
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
          return c.json(
            {
              error: "Another video task is already running for this content",
              code: "VIDEO_JOB_IN_PROGRESS",
              jobId: existing.id,
              kind: existing.kind,
            },
            409,
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
    } catch (error) {
      debugLog.error("Failed to create reel job", {
        service: "video-route",
        operation: "createReel",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to queue reel generation" }, 500);
    }
  },
);

export default reelGenerateRouter;
