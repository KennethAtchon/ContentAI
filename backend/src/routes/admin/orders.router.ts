import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { debugLog } from "../../utils/debug/debug";
import { adminService } from "../../domain/singletons";

const ordersRouter = new Hono<HonoEnv>();

ordersRouter.get(
  "/orders",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const page = parseInt(c.req.query("page") || "1", 10);
      const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
      const search = c.req.query("search");
      const customerId = c.req.query("customerId");

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
  async (c) => {
    try {
      const body = await c.req.json();
      const { userId, totalAmount, status } = body;

      if (!userId || totalAmount === undefined) {
        return c.json({ error: "userId and totalAmount are required" }, 400);
      }

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
  async (c) => {
    try {
      const body = await c.req.json();
      const { id, userId, totalAmount, status } = body;

      if (!id) return c.json({ error: "id is required" }, 400);

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
  async (c) => {
    try {
      const body = await c.req.json();
      const { id, deletedBy } = body;

      if (!id) return c.json({ error: "id is required" }, 400);

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
  async (c) => {
    try {
      const id = c.req.param("id");
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
