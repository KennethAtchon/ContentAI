import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { zodValidationErrorHook } from "../../../validation/zod-validation-hook";
import { authMiddleware, rateLimiter } from "../../../middleware/protection";
import type { HonoEnv } from "../../../types/hono.types";
import { adminService } from "../../../domain/singletons";
import { adminSubscriptionsQuerySchema } from "../../../domain/admin/admin.schemas";
import {
  fetchAllFirestoreSubscriptionsForAdminList,
  filterSortPaginateAdminSubscriptions,
} from "../../../domain/admin/admin-subscriptions-firestore";

const listRouter = new Hono<HonoEnv>();

listRouter.get(
  "/subscriptions",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminSubscriptionsQuerySchema, zodValidationErrorHook),
  async (c) => {
    const { page, limit, status, tier, search } = c.req.valid("query");

    const rows = await fetchAllFirestoreSubscriptionsForAdminList(adminService);
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
