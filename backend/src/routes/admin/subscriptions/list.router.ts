import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../../middleware/protection";
import type { HonoEnv } from "../../../types/hono.types";
import { adminService } from "../../../domain/singletons";
import { adminSubscriptionsQuerySchema } from "../../../domain/admin/admin.schemas";
import {
  fetchAllFirestoreSubscriptionsForAdminList,
  filterSortPaginateAdminSubscriptions,
} from "../../../domain/admin/admin-subscriptions-firestore";

const listRouter = new Hono<HonoEnv>();
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

listRouter.get(
  "/subscriptions",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminSubscriptionsQuerySchema, validationErrorHook),
  async (c) => {
    const { page, limit, status, tier, search } = c.req.valid("query");

    const rows = await fetchAllFirestoreSubscriptionsForAdminList(
      adminService,
    );
    const { subscriptions, total } = filterSortPaginateAdminSubscriptions(
      rows,
      { page, limit, status, tier, search },
    );

    return c.json({
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
);

export default listRouter;
