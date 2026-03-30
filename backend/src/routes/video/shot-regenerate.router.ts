import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { videoJobService } from "../../services/video-generation/job.service";
import { Errors } from "../../utils/errors/app-error";
import { regenerateShotSchema } from "./schemas";
import { fetchOwnedContent } from "./phase4-metadata";
import {
  enqueue,
  runShotRegenerate,
} from "../../domain/video/reel-job-runner";

const shotRegenerateRouter = new Hono<HonoEnv>();

// POST /api/video/shots/regenerate
shotRegenerateRouter.post(
  "/shots/regenerate",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", regenerateShotSchema),
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

    const job = await videoJobService.createJob({
      userId: auth.user.id,
      generatedContentId: payload.generatedContentId,
      kind: "shot_regenerate",
      request: payload,
    });

    enqueue("shot_regenerate", () =>
      runShotRegenerate({
        job,
        shotIndex: payload.shotIndex,
        prompt: payload.prompt,
        durationSeconds: payload.durationSeconds,
        aspectRatio: payload.aspectRatio,
        provider: payload.provider,
      }),
    );

    return c.json({ jobId: job.id, status: job.status }, 202);
  },
);

export default shotRegenerateRouter;
