import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { debugLog } from "../../utils/debug/debug";
import { adminService } from "../../domain/singletons";
import { adminFeatureUsagesQuerySchema } from "../../domain/admin/admin.schemas";

const featureUsagesRouter = new Hono<HonoEnv>();
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

featureUsagesRouter.get(
  "/feature-usages",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminFeatureUsagesQuerySchema, validationErrorHook),
  async (c) => {
    try {
      const { page, limit } = c.req.valid("query");

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
