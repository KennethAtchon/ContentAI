import { Hono } from "hono";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { debugLog } from "../../utils/debug/debug";
import { adminService } from "../../domain/singletons";

const analyticsRouter = new Hono<HonoEnv>();

analyticsRouter.get(
  "/analytics",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const data = await adminService.getConversionAnalytics();
      return c.json(data);
    } catch (error) {
      debugLog.error("Failed to fetch analytics", {
        service: "admin-route",
        operation: "getAnalytics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch analytics data" }, 500);
    }
  },
);

export default analyticsRouter;
