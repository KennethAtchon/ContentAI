import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { db } from "../../services/db/db";
import { users, featureUsages } from "../../infrastructure/database/drizzle/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { adminDb } from "../../services/firebase/admin";
import {
  extractSubscriptionTier,
  convertFirestoreTimestamp,
} from "../../services/firebase/subscription-helpers";
import { getTierConfig } from "../../constants/subscription.constants";
import {
  adminSubscriptionIdParamSchema,
  adminSubscriptionsQuerySchema,
} from "../../domain/admin/admin.schemas";

const subscriptionsRouter = new Hono<HonoEnv>();
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

subscriptionsRouter.get(
  "/subscriptions",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("query", adminSubscriptionsQuerySchema, validationErrorHook),
  async (c) => {
    try {
      const { page, limit, status, tier, search } = c.req.valid("query");

      const customersSnapshot = await adminDb.collection("customers").get();
      const allSubscriptions: any[] = [];

      for (const customerDoc of customersSnapshot.docs) {
        const subscriptionsSnapshot = await customerDoc.ref
          .collection("subscriptions")
          .get();

        for (const subDoc of subscriptionsSnapshot.docs) {
          const subData = subDoc.data();

          const [dbUser] = await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(eq(users.firebaseUid, customerDoc.id))
            .limit(1);

          const tierFromMetadata = extractSubscriptionTier(subData);

          let usageCount = 0;
          let usageLimit: number | null = null;
          if (dbUser) {
            try {
              const tierConfig = getTierConfig(
                tierFromMetadata as "basic" | "pro" | "enterprise",
              );
              usageLimit =
                tierConfig.features.maxGenerationsPerMonth === -1
                  ? null
                  : tierConfig.features.maxGenerationsPerMonth;
              const now = new Date();
              const startOfMonth = new Date(
                now.getFullYear(),
                now.getMonth(),
                1,
              );
              const endOfMonth = new Date(
                now.getFullYear(),
                now.getMonth() + 1,
                0,
                23,
                59,
                59,
                999,
              );

              const [usageResult] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(featureUsages)
                .where(
                  and(
                    eq(featureUsages.userId, dbUser.id),
                    gte(featureUsages.createdAt, startOfMonth),
                    lte(featureUsages.createdAt, endOfMonth),
                  ),
                );
              usageCount = usageResult.count;
            } catch {
              /* skip usage on error */
            }
          }

          const subscription = {
            id: subDoc.id,
            userId: customerDoc.id,
            user: dbUser || {
              id: customerDoc.id,
              name: subData.metadata?.userEmail || "Unknown",
              email: subData.metadata?.userEmail || "",
            },
            tier: tierFromMetadata,
            status: subData.status || "incomplete",
            stripeCustomerId: subData.customer,
            stripeSubscriptionId: subData.id,
            usageCount,
            usageLimit,
            currentPeriodStart: convertFirestoreTimestamp(
              subData.current_period_start,
            ),
            currentPeriodEnd: convertFirestoreTimestamp(
              subData.current_period_end,
            ),
            createdAt: subData.created
              ? convertFirestoreTimestamp(subData.created) ||
                subDoc.createTime?.toDate() ||
                new Date()
              : subDoc.createTime?.toDate() || new Date(),
            updatedAt: subData.updated
              ? convertFirestoreTimestamp(subData.updated) ||
                subDoc.updateTime?.toDate() ||
                new Date()
              : subDoc.updateTime?.toDate() || new Date(),
          };

          if (status && status !== "all" && subscription.status !== status)
            continue;
          if (tier && tier !== "all" && subscription.tier !== tier) continue;
          if (search) {
            const q = search.toLowerCase();
            const matches =
              subscription.userId.toLowerCase().includes(q) ||
              subscription.stripeCustomerId?.toLowerCase().includes(q) ||
              subscription.stripeSubscriptionId?.toLowerCase().includes(q) ||
              subscription.user?.email?.toLowerCase().includes(q);
            if (!matches) continue;
          }

          allSubscriptions.push(subscription);
        }
      }

      allSubscriptions.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      const total = allSubscriptions.length;
      const skip = (page - 1) * limit;
      const paginated = allSubscriptions
        .slice(skip, skip + limit)
        .map((sub) => ({
          ...sub,
          currentPeriodStart: sub.currentPeriodStart
            ? sub.currentPeriodStart.toISOString()
            : null,
          currentPeriodEnd: sub.currentPeriodEnd
            ? sub.currentPeriodEnd.toISOString()
            : null,
          createdAt: sub.createdAt.toISOString(),
          updatedAt: sub.updatedAt.toISOString(),
        }));

      return c.json({
        subscriptions: paginated,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: skip + paginated.length < total,
        },
      });
    } catch (error) {
      debugLog.error("Failed to fetch subscriptions", {
        service: "admin-route",
        operation: "getSubscriptions",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch subscriptions" }, 500);
    }
  },
);

// ─── GET /api/admin/subscriptions/analytics ───────────────────────────────────

subscriptionsRouter.get(
  "/subscriptions/analytics",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const customersSnapshot = await adminDb.collection("customers").get();
      const allSubscriptions: Array<{
        tier: string;
        status: string;
        canceledAt: Date | null;
      }> = [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const customerDoc of customersSnapshot.docs) {
        const subscriptionsSnapshot = await customerDoc.ref
          .collection("subscriptions")
          .get();
        for (const subDoc of subscriptionsSnapshot.docs) {
          const subData = subDoc.data();
          const tier = extractSubscriptionTier(subData);
          const status = subData.status || "incomplete";
          const canceledAt = subData.canceled_at
            ? new Date(subData.canceled_at * 1000)
            : null;
          allSubscriptions.push({ tier, status, canceledAt });
        }
      }

      const activeSubscriptions = allSubscriptions.filter((s) =>
        ["active", "trialing"].includes(s.status),
      );

      const tierDistribution: Record<string, number> = {};
      for (const sub of activeSubscriptions) {
        tierDistribution[sub.tier] = (tierDistribution[sub.tier] || 0) + 1;
      }

      let mrr = 0;
      for (const sub of activeSubscriptions) {
        try {
          const config = getTierConfig(
            sub.tier as "basic" | "pro" | "enterprise",
          );
          mrr += config.price / 100;
        } catch {
          /* skip unknown tiers */
        }
      }

      const canceledLast30Days = allSubscriptions.filter(
        (s) => s.canceledAt && s.canceledAt >= thirtyDaysAgo,
      ).length;

      const churnRate =
        activeSubscriptions.length > 0
          ? (canceledLast30Days / activeSubscriptions.length) * 100
          : 0;

      const activeCount = activeSubscriptions.length;
      const arpu = activeCount > 0 ? mrr / activeCount : 0;

      const revenueByTier = Object.entries(tierDistribution).map(
        ([tier, count]) => {
          let price = 0;
          try {
            const config = getTierConfig(
              tier as "basic" | "pro" | "enterprise",
            );
            price = (config.price / 100) * count;
          } catch {
            /* skip unknown tiers */
          }
          return { tier, revenue: price };
        },
      );

      return c.json({
        activeSubscriptions: activeCount,
        totalTrialing: allSubscriptions.filter((s) => s.status === "trialing")
          .length,
        mrr,
        arr: mrr * 12,
        churnRate,
        arpu,
        tierDistribution,
        revenueByTier,
        growthRate: 0,
      });
    } catch (error) {
      debugLog.error("Failed to fetch subscription analytics", {
        service: "admin-route",
        operation: "getSubscriptionAnalytics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch subscription analytics" }, 500);
    }
  },
);

// ─── GET /api/admin/subscriptions/:id ────────────────────────────────────────

subscriptionsRouter.get(
  "/subscriptions/:id",
  rateLimiter("admin"),
  authMiddleware("admin"),
  zValidator("param", adminSubscriptionIdParamSchema, validationErrorHook),
  async (c) => {
    try {
      const { id } = c.req.valid("param");
      const customersSnapshot = await adminDb.collection("customers").get();

      for (const customerDoc of customersSnapshot.docs) {
        const subDoc = await customerDoc.ref
          .collection("subscriptions")
          .doc(id)
          .get();
        if (subDoc.exists) {
          return c.json({ subscription: { id: subDoc.id, ...subDoc.data() } });
        }
      }

      return c.json({ error: "Subscription not found" }, 404);
    } catch (error) {
      debugLog.error("Failed to fetch subscription", {
        service: "admin-route",
        operation: "getSubscriptionById",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch subscription" }, 500);
    }
  },
);

export default subscriptionsRouter;
