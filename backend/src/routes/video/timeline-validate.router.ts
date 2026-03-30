import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { validateTimelineBodySchema } from "../../domain/video/video.schemas";
import { validateTimeline } from "../../domain/video/timeline-validation";

const timelineValidateRouter = new Hono<HonoEnv>();

// POST /api/video/timeline/validate
timelineValidateRouter.post(
  "/timeline/validate",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", validateTimelineBodySchema),
  async (c) => {
    const auth = c.get("auth");
    const { generatedContentId, timeline } = c.req.valid("json");

    const issues = await validateTimeline({
      userId: auth.user.id,
      generatedContentId,
      timeline,
    });

    return c.json({ issues });
  },
);

export default timelineValidateRouter;
