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
  queueItemIdParamSchema,
  updateQueueItemBodySchema,
} from "../../domain/queue/queue.schemas";

const itemsRouter = new Hono<HonoEnv>();

itemsRouter.get(
  "/:id/detail",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", queueItemIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const detail = await queueService.getQueueItemDetail(auth.user.id, id);
    return c.json(detail);
  },
);

/**
 * POST /api/queue/:id/duplicate
 * Clone a queue item as a new draft (version + 1).
 */
itemsRouter.post(
  "/:id/duplicate",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", queueItemIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const result = await queueService.duplicateQueueItem(auth.user.id, id);
    return c.json(result, 201);
  },
);

/**
 * PATCH /api/queue/:id
 * Update status (with transition validation), schedule time, or Instagram page.
 */
itemsRouter.patch(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", queueItemIdParamSchema, zodValidationErrorHook),
  zValidator("json", updateQueueItemBodySchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await queueService.updateQueueItem(auth.user.id, id, body);
    return c.json(result);
  },
);

/**
 * DELETE /api/queue/:id
 * Remove a queue item.
 */
itemsRouter.delete(
  "/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", queueItemIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id } = c.req.valid("param");
    const result = await queueService.deleteQueueItem(auth.user.id, id);
    return c.json(result);
  },
);

export default itemsRouter;
