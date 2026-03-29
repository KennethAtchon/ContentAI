import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware, rateLimiter } from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { adminDb } from "../../services/firebase/admin";
import { adminService } from "../../domain/singletons";
import {
  extractSubscriptionTier,
} from "../../services/firebase/subscription-helpers";
import { getTierConfig } from "../../constants/subscription.constants";
import { adminSubscriptionsQuerySchema } from "../../domain/admin/admin.schemas";

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
    const { page, limit, status, tier, search } = c.req.valid("query");

    const customersSnapshot = await adminDb.collection("customers").get();
    const allSubscriptions: any[] = [];

    for (const customerDoc of customersSnapshot.docs) {
      const subscriptionsSnapshot = await customerDoc.ref
        .collection("subscriptions")
        .get();

      for (const subDoc of subscriptionsSnapshot.docs) {
        const subData = subDoc.data();

        const dbUser = await adminService.findUserByFirebaseUid(customerDoc.id);

        const tierFromMetadata = extractSubscriptionTier(subData);

        let usageCount = 0;
        let usageLimit: number | null = null;
        if (dbUser) {
          const tierConfig = getTierConfig(
            tierFromMetadata as "basic" | "pro" | "enterprise",
          );
          usageLimit =
            tierConfig.features.maxGenerationsPerMonth === -1
              ? null
              : tierConfig.features.maxGenerationsPerMonth;

          usageCount = await adminService.countGenerationUsagesThisMonth(
            dbUser.id,
          );
        }

        allSubscriptions.push({
          id: subDoc.id,
          customerId: customerDoc.id,
          customerEmail: dbUser?.email || null,
          customerName: dbUser?.name || null,
          status: subData.status || "incomplete",
          tier: tierFromMetadata,
          currentPeriodStart: subData.current_period_start
            ? new Date(subData.current_period_start * 1000)
            : null,
          currentPeriodEnd: subData.current_period_end
            ? new Date(subData.current_period_end * 1000)
            : null,
          canceledAt: subData.canceled_at
            ? new Date(subData.canceled_at * 1000)
            : null,
          usageCount,
          usageLimit,
        });
      }
    }

    // Filter
    let filtered = allSubscriptions;
    if (status) {
      filtered = filtered.filter((s) => s.status === status);
    }
    if (tier) {
      filtered = filtered.filter((s) => s.tier === tier);
    }
    if (search?.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.customerEmail?.toLowerCase().includes(term) ||
          s.customerName?.toLowerCase().includes(term),
      );
    }

    // Sort by currentPeriodEnd descending
    filtered.sort((a, b) => {
      const aTime = a.currentPeriodEnd?.getTime() || 0;
      const bTime = b.currentPeriodEnd?.getTime() || 0;
      return bTime - aTime;
    });

    const total = filtered.length;
    const paginated = filtered.slice((page - 1) * limit, page * limit);

    return c.json({
      subscriptions: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
);

subscriptionsRouter.get(
  "/subscriptions/analytics",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
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
  },
);

export default subscriptionsRouter;
