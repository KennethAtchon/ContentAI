import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { adminService } from "../../domain/singletons";
import { adminFeatureUsagesQuerySchema } from "../../domain/admin/admin.schemas";

const featureUsagesRouter = new Hono<HonoEnv>();

featureUsagesRouter.get(
  "/feature-usages",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminFeatureUsagesQuerySchema, zodValidationErrorHook),
  async (c) => {
    const { page, limit } = c.req.valid("query");

    const payload = await adminService.listFeatureUsages({ page, limit });
    return c.json(payload);
  },
);

export default featureUsagesRouter;
