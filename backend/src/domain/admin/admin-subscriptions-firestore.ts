import type { Firestore } from "firebase-admin/firestore";
import { adminDb } from "../../services/firebase/admin";
import { extractSubscriptionTier } from "../../services/firebase/subscription-helpers";
import { getTierConfig } from "../../constants/subscription.constants";
import type { AdminService } from "./admin.service";

export type AdminSubscriptionListRow = {
  id: string;
  customerId: string;
  customerEmail: string | null;
  customerName: string | null;
  status: string;
  tier: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  usageCount: number;
  usageLimit: number | null;
};

export type AdminSubscriptionsAdminService = Pick<
  AdminService,
  "findUserByFirebaseUid" | "countGenerationUsagesThisMonth"
>;

export async function fetchAllFirestoreSubscriptionsForAdminList(
  adminService: AdminSubscriptionsAdminService,
  db: Firestore = adminDb,
): Promise<AdminSubscriptionListRow[]> {
  const customersSnapshot = await db.collection("customers").get();
  const rows: AdminSubscriptionListRow[] = [];

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

      rows.push({
        id: subDoc.id,
        customerId: customerDoc.id,
        customerEmail: dbUser?.email ?? null,
        customerName: dbUser?.name ?? null,
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

  return rows;
}

export function filterSortPaginateAdminSubscriptions(
  rows: AdminSubscriptionListRow[],
  filters: {
    page: number;
    limit: number;
    status?: string;
    tier?: string;
    search?: string;
  },
) {
  let filtered = rows;
  if (filters.status) {
    filtered = filtered.filter((s) => s.status === filters.status);
  }
  if (filters.tier) {
    filtered = filtered.filter((s) => s.tier === filters.tier);
  }
  if (filters.search?.trim()) {
    const term = filters.search.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.customerEmail?.toLowerCase().includes(term) ||
        s.customerName?.toLowerCase().includes(term),
    );
  }

  filtered.sort((a, b) => {
    const aTime = a.currentPeriodEnd?.getTime() || 0;
    const bTime = b.currentPeriodEnd?.getTime() || 0;
    return bTime - aTime;
  });

  const total = filtered.length;
  const paginated = filtered.slice(
    (filters.page - 1) * filters.limit,
    filters.page * filters.limit,
  );

  return { subscriptions: paginated, total };
}

export type AdminSubscriptionAnalyticsRow = {
  tier: string;
  status: string;
  canceledAt: Date | null;
};

export async function fetchSubscriptionRowsForAnalytics(
  db: Firestore = adminDb,
): Promise<AdminSubscriptionAnalyticsRow[]> {
  const customersSnapshot = await db.collection("customers").get();
  const rows: AdminSubscriptionAnalyticsRow[] = [];

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
      rows.push({ tier, status, canceledAt });
    }
  }

  return rows;
}

export function computeSubscriptionAnalytics(
  allSubscriptions: AdminSubscriptionAnalyticsRow[],
) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

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
      const config = getTierConfig(sub.tier as "basic" | "pro" | "enterprise");
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
        const config = getTierConfig(tier as "basic" | "pro" | "enterprise");
        price = (config.price / 100) * count;
      } catch {
        /* skip unknown tiers */
      }
      return { tier, revenue: price };
    },
  );

  return {
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
  };
}
