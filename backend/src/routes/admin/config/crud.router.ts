import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../../middleware/protection";
import type { HonoEnv } from "../../../types/hono.types";
import { systemConfigService } from "../../../domain/singletons";
import {
  adminConfigCategoryParamSchema,
  adminConfigKeyParamSchema,
  adminConfigUpdateBodySchema,
} from "../../../domain/admin/admin.schemas";
import { adminConfigValidationErrorHook } from "./shared-validation";

const crudRouter = new Hono<HonoEnv>();

crudRouter.get(
  "/config",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const rows = await systemConfigService.getAll();
    return c.json({ config: rows });
  },
);

crudRouter.get(
  "/config/:category",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator(
    "param",
    adminConfigCategoryParamSchema,
    adminConfigValidationErrorHook,
  ),
  async (c) => {
    const { category } = c.req.valid("param");
    const rows = await systemConfigService.getCategoryPublic(category);
    return c.json(rows);
  },
);

crudRouter.put(
  "/config/:category/:key",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  zValidator(
    "param",
    adminConfigKeyParamSchema,
    adminConfigValidationErrorHook,
  ),
  zValidator(
    "json",
    adminConfigUpdateBodySchema,
    adminConfigValidationErrorHook,
  ),
  async (c) => {
    const { category, key } = c.req.valid("param");
    const parsed = c.req.valid("json");

    const auth = c.get("auth");
    await systemConfigService.set(category, key, parsed.value, auth.user.email);

    return c.json({ success: true });
  },
);

export default crudRouter;
