import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { debugLog } from "../../utils/debug/debug";
import { adminService } from "../../domain/singletons";
import { adminCustomersQuerySchema } from "../../domain/admin/admin.schemas";

const customersRouter = new Hono<HonoEnv>();
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

customersRouter.get(
  "/customers",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminCustomersQuerySchema, validationErrorHook),
  async (c) => {
    try {
      const { page, limit, search } = c.req.valid("query");

      const payload = await adminService.listCustomers({ page, limit, search });
      return c.json(payload);
    } catch (error) {
      debugLog.error("Failed to fetch customers", {
        service: "admin-route",
        operation: "getCustomers",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch customers" }, 500);
    }
  },
);

export default customersRouter;
