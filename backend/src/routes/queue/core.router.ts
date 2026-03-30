import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { queueService } from "../../domain/singletons";
import {
  createQueueItemBodySchema,
  queueListQuerySchema,
} from "../../domain/queue/queue.schemas";

const coreRouter = new Hono<HonoEnv>();

coreRouter.get(
  "/",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", queueListQuerySchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const query = c.req.valid("query");
    const result = await queueService.listQueueItemsPage(auth.user.id, query);
    return c.json(result);
  },
);

/**
 * POST /api/queue
 * Create a queue item from a generatedContentId.
 */
coreRouter.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createQueueItemBodySchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { generatedContentId } = c.req.valid("json");
    const { queueItem } = await queueService.createDraftQueueItem(
      auth.user.id,
      generatedContentId,
    );
    return c.json({ queueItem }, 201);
  },
);

export default coreRouter;
