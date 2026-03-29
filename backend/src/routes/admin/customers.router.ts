import { Hono } from "hono";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { debugLog } from "../../utils/debug/debug";
import { adminService } from "../../domain/singletons";

const customersRouter = new Hono<HonoEnv>();

customersRouter.get(
  "/customers",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const page = parseInt(c.req.query("page") || "1", 10);
      const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);
      const search = c.req.query("search");

      const payload = await adminService.listCustomers({ page, limit, search });
      return c.json(payload);
    } catch (error) {
      debugLog.error("Failed to fetch customers", {
        service: "admin-route",
        operation: "getCustomers",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch customers" }, 500);
    }
  },
);

export default customersRouter;
