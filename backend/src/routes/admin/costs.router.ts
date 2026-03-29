import { Hono } from "hono";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { debugLog } from "../../utils/debug/debug";
import { adminService } from "../../domain/singletons";

const costsRouter = new Hono<HonoEnv>();

costsRouter.get(
  "/ai-costs/by-user",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const period = c.req.query("period") ?? "30d";
      const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 100);

      const payload = await adminService.getAiCostsByUser(period, limit);
      return c.json(payload);
    } catch (error) {
      debugLog.error("Failed to fetch AI costs by user", {
        service: "admin-route",
        operation: "getAiCostsByUser",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch AI costs by user" }, 500);
    }
  },
);

costsRouter.get(
  "/ai-costs",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const period = c.req.query("period") ?? "30d";
      const payload = await adminService.getAiCosts(period);
      return c.json(payload);
    } catch (error) {
      debugLog.error("Failed to fetch AI costs", {
        service: "admin-route",
        operation: "getAiCosts",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch AI costs" }, 500);
    }
  },
);

export default costsRouter;
