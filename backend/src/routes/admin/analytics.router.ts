import { Hono } from "hono";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { adminService } from "../../domain/singletons";

const analyticsRouter = new Hono<HonoEnv>();

analyticsRouter.get(
  "/analytics",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const data = await adminService.getConversionAnalytics();
    return c.json(data);
  },
);

export default analyticsRouter;
