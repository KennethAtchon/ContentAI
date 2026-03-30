import { Hono } from "hono";
import { authMiddleware, rateLimiter } from "../../../middleware/protection";
import type { HonoEnv } from "../../../types/hono.types";
import {
  computeSubscriptionAnalytics,
  fetchSubscriptionRowsForAnalytics,
} from "../../../domain/admin/admin-subscriptions-firestore";

const analyticsRouter = new Hono<HonoEnv>();

analyticsRouter.get(
  "/subscriptions/analytics",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const rows = await fetchSubscriptionRowsForAnalytics();
    const body = computeSubscriptionAnalytics(rows);
    return c.json(body);
  },
);

export default analyticsRouter;
