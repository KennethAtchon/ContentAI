import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { adminService } from "../../domain/singletons";
import {
  adminCreateOrderBodySchema,
  adminDeleteOrderBodySchema,
  adminOrderIdParamSchema,
  adminOrdersQuerySchema,
  adminUpdateOrderBodySchema,
} from "../../domain/admin/admin.schemas";

const ordersRouter = new Hono<HonoEnv>();

ordersRouter.get(
  "/orders",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminOrdersQuerySchema, zodValidationErrorHook),
  async (c) => {
    const { page, limit, search, customerId } = c.req.valid("query");

    const payload = await adminService.listOrders({
      page,
      limit,
      search,
      customerId,
    });
    return c.json(payload);
  },
);

ordersRouter.post(
  "/orders",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", adminCreateOrderBodySchema, zodValidationErrorHook),
  async (c) => {
    const { userId, totalAmount, status } = c.req.valid("json");

    const order = await adminService.createOrder({
      userId,
      totalAmount,
      status,
    });
    return c.json({ order }, 201);
  },
);

ordersRouter.put(
  "/orders",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", adminUpdateOrderBodySchema, zodValidationErrorHook),
  async (c) => {
    const { id, userId, totalAmount, status } = c.req.valid("json");

    const order = await adminService.updateOrder({
      id,
      userId,
      totalAmount,
      status,
    });

    return c.json({ order });
  },
);

ordersRouter.delete(
  "/orders",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", adminDeleteOrderBodySchema, zodValidationErrorHook),
  async (c) => {
    const { id, deletedBy } = c.req.valid("json");

    const result = await adminService.deleteOrder({ id, deletedBy });

    return c.json({ order: result.order, deleted: result.deleted });
  },
);

ordersRouter.get(
  "/orders/:id",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("param", adminOrderIdParamSchema, zodValidationErrorHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const order = await adminService.getOrderById(id);

    return c.json({ order });
  },
);

export default ordersRouter;
