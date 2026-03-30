import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { adminService } from "../../domain/singletons";
import {
  adminCostsByUserQuerySchema,
  adminCostsQuerySchema,
} from "../../domain/admin/admin.schemas";

const costsRouter = new Hono<HonoEnv>();
type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const validationErrorHook = (result: ValidationResult, c: Context) => {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "INVALID_INPUT",
        details: result.error?.issues ?? [],
      },
      422,
    );
  }
};

costsRouter.get(
  "/ai-costs/by-user",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminCostsByUserQuerySchema, validationErrorHook),
  async (c) => {
    const { period, limit } = c.req.valid("query");

    const payload = await adminService.getAiCostsByUser(period, limit);
    return c.json(payload);
  },
);

costsRouter.get(
  "/ai-costs",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminCostsQuerySchema, validationErrorHook),
  async (c) => {
    const { period } = c.req.valid("query");
    const payload = await adminService.getAiCosts(period);
    return c.json(payload);
  },
);

export default costsRouter;
