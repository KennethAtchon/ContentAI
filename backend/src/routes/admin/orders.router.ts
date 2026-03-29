import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { debugLog } from "../../utils/debug/debug";
import { adminService } from "../../domain/singletons";
import {
  adminCreateOrderBodySchema,
  adminDeleteOrderBodySchema,
  adminOrderIdParamSchema,
  adminOrdersQuerySchema,
  adminUpdateOrderBodySchema,
} from "../../domain/admin/admin.schemas";

const ordersRouter = new Hono<HonoEnv>();
type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const validationErrorHook = (result: ValidationResult, c: Context) => {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "INVALID_INPUT",
        details: result.error?.issues ?? [],
      },
      422,
    );
  }
};

ordersRouter.get(
  "/orders",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminOrdersQuerySchema, validationErrorHook),
  async (c) => {
    try {
      const { page, limit, search, customerId } = c.req.valid("query");

      const payload = await adminService.listOrders({
        page,
        limit,
        search,
        customerId,
      });
      return c.json(payload);
    } catch (error) {
      debugLog.error("Failed to fetch orders", {
        service: "admin-route",
        operation: "getOrders",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch orders" }, 500);
    }
  },
);

ordersRouter.post(
  "/orders",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", adminCreateOrderBodySchema, validationErrorHook),
  async (c) => {
    try {
      const { userId, totalAmount, status } = c.req.valid("json");

      const order = await adminService.createOrder({
        userId,
        totalAmount,
        status,
      });
      return c.json({ order }, 201);
    } catch (error) {
      debugLog.error("Failed to create order", {
        service: "admin-route",
        operation: "createOrder",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create order" }, 500);
    }
  },
);

ordersRouter.put(
  "/orders",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", adminUpdateOrderBodySchema, validationErrorHook),
  async (c) => {
    try {
      const { id, userId, totalAmount, status } = c.req.valid("json");

      const order = await adminService.updateOrder({
        id,
        userId,
        totalAmount,
        status,
      });
      if (!order) return c.json({ error: "Order not found" }, 404);

      return c.json({ order });
    } catch (error) {
      debugLog.error("Failed to update order", {
        service: "admin-route",
        operation: "updateOrder",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update order" }, 500);
    }
  },
);

ordersRouter.delete(
  "/orders",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator("json", adminDeleteOrderBodySchema, validationErrorHook),
  async (c) => {
    try {
      const { id, deletedBy } = c.req.valid("json");

      const result = await adminService.deleteOrder({ id, deletedBy });
      if (!result) return c.json({ error: "Order not found" }, 404);

      return c.json({ order: result.order, deleted: result.deleted });
    } catch (error) {
      debugLog.error("Failed to delete order", {
        service: "admin-route",
        operation: "deleteOrder",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete order" }, 500);
    }
  },
);

ordersRouter.get(
  "/orders/:id",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("param", adminOrderIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const order = await adminService.getOrderById(id);
      if (!order) return c.json({ error: "Order not found" }, 404);

      return c.json({ order });
    } catch (error) {
      debugLog.error("Failed to fetch order", {
        service: "admin-route",
        operation: "getOrderById",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch order" }, 500);
    }
  },
);

export default ordersRouter;
