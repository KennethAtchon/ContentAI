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
import { regenerateShotSchema } from "./schemas";
import { fetchOwnedContent } from "./phase4-metadata";
import { enqueue, runShotRegenerate } from "./reel-job-runner";

const shotRegenerateRouter = new Hono<HonoEnv>();

// POST /api/video/shots/regenerate
shotRegenerateRouter.post(
  "/shots/regenerate",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", regenerateShotSchema),
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
    } catch (error) {
      debugLog.error("Failed to regenerate shot", {
        service: "video-route",
        operation: "regenerateShot",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to queue shot regeneration" }, 500);
    }
  },
);

export default shotRegenerateRouter;
