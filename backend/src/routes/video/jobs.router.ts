import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { videoJobService } from "../../services/video/job.service";
import { debugLog } from "../../utils/debug/debug";
import { enqueue, getRetryRunner } from "./reel-job-runner";

const jobsRouter = new Hono<HonoEnv>();

// GET /api/video/jobs/:jobId
jobsRouter.get(
  "/jobs/:jobId",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { jobId } = c.req.param();

      const job = await videoJobService.getJob(jobId);
      if (!job) {
        return c.json(
          { error: "Job not found", code: "PHASE4_JOB_NOT_FOUND" },
          404,
        );
      }

      if (job.userId !== auth.user.id) {
        return c.json({ error: "Forbidden", code: "PHASE4_FORBIDDEN" }, 403);
      }

      return c.json({ job });
    } catch (error) {
      debugLog.error("Failed to fetch video job", {
        service: "video-route",
        operation: "getJob",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch job status" }, 500);
    }
  },
);

// POST /api/video/jobs/:jobId/retry
jobsRouter.post(
  "/jobs/:jobId/retry",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { jobId } = c.req.param();
      const job = await videoJobService.getJob(jobId);

      if (!job) {
        return c.json(
          { error: "Job not found", code: "PHASE4_JOB_NOT_FOUND" },
          404,
        );
      }

      if (job.userId !== auth.user.id) {
        return c.json({ error: "Forbidden", code: "PHASE4_FORBIDDEN" }, 403);
      }

      const retryJob = await videoJobService.createJob({
        userId: job.userId,
        generatedContentId: job.generatedContentId,
        kind: job.kind,
        request: job.request,
      });

      enqueue(job.kind, getRetryRunner(job, retryJob));

      return c.json({ jobId: retryJob.id, status: retryJob.status }, 202);
    } catch (error) {
      debugLog.error("Failed to retry video job", {
        service: "video-route",
        operation: "retryJob",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to retry job" }, 500);
    }
  },
);

export default jobsRouter;
