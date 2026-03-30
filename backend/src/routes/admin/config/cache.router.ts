import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../../middleware/protection";
import type { HonoEnv } from "../../../types/hono.types";
import { systemConfigService } from "../../../domain/singletons";
import { adminConfigInvalidateBodySchema } from "../../../domain/admin/admin.schemas";
import { adminConfigValidationErrorHook } from "./shared-validation";

const cacheRouter = new Hono<HonoEnv>();

cacheRouter.post(
  "/config/cache/invalidate",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator(
    "json",
    adminConfigInvalidateBodySchema,
    adminConfigValidationErrorHook,
  ),
  async (c) => {
    const { category } = c.req.valid("json");
    await systemConfigService.invalidateCache(category);
    return c.json({ success: true, invalidated: category });
  },
);

export default cacheRouter;
