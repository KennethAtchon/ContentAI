import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../validation/zod-validation-hook";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { adminService } from "../../domain/singletons";
import { adminCustomersQuerySchema } from "../../domain/admin/admin.schemas";

const customersRouter = new Hono<HonoEnv>();

customersRouter.get(
  "/customers",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminCustomersQuerySchema, zodValidationErrorHook),
  async (c) => {
    const { page, limit, search } = c.req.valid("query");

    const payload = await adminService.listCustomers({ page, limit, search });
    return c.json(payload);
  },
);

export default customersRouter;
