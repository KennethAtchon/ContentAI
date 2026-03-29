import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { debugLog } from "../../utils/debug/debug";
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
    try {
      const { period, limit } = c.req.valid("query");

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
  zValidator("query", adminCostsQuerySchema, validationErrorHook),
  async (c) => {
    try {
      const { period } = c.req.valid("query");
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
