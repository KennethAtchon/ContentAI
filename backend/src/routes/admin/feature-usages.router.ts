import { Hono } from "hono";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { debugLog } from "../../utils/debug/debug";
import { adminService } from "../../domain/singletons";

const featureUsagesRouter = new Hono<HonoEnv>();

featureUsagesRouter.get(
  "/feature-usages",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const page = parseInt(c.req.query("page") || "1", 10);
      const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);

      const payload = await adminService.listFeatureUsages({ page, limit });
      return c.json(payload);
    } catch (error) {
      debugLog.error("Failed to fetch feature usages", {
        service: "admin-route",
        operation: "getFeatureUsages",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch feature usages" }, 500);
    }
  },
);

export default featureUsagesRouter;
