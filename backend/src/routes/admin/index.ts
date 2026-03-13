import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { ADMIN_SPECIAL_CODE_HASH } from "../../utils/config/envUtil";
import { createHash } from "crypto";
import { adminAuth, adminDb } from "../../services/firebase/admin";
import { db } from "../../services/db/db";
import { debugLog } from "../../utils/debug/debug";
import {
  users,
  orders,
  contactMessages,
  featureUsages,
  aiCostLedger,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, or, ilike, desc, gte, lte, sql } from "drizzle-orm";
import {
  getMonthBoundaries,
  calculatePercentChange,
} from "../../utils/helpers/date";
import { formatOrderResponse } from "../../utils/helpers/order-helpers";
import {
  extractSubscriptionTier,
  convertFirestoreTimestamp,
} from "../../services/firebase/subscription-helpers";
import { getTierConfig } from "../../constants/subscription.constants";
import { FirebaseUserSync } from "../../services/firebase/sync";
import nichesRouter from "./niches";

const admin = new Hono<HonoEnv>();

// Mount niches & admin-reel sub-router
admin.route("/", nichesRouter);

// ─── GET /api/admin/verify ────────────────────────────────────────────────────

admin.get(
  "/verify",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    const auth = c.get("auth");
    return c.json({
      success: true,
      message: "Admin access verified",
      user: auth.user,
    });
  },
);

// ─── POST /api/admin/verify ───────────────────────────────────────────────────

admin.post(
  "/verify",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const body = await c.req.json();
      const { adminCode } = body;

      if (!adminCode) return c.json({ error: "Admin code is required" }, 400);

      if (!ADMIN_SPECIAL_CODE_HASH) {
        return c.json(
          { error: "Admin verification not properly configured" },
          500,
        );
      }

      const hashedInput = createHash("sha256").update(adminCode).digest("hex");
      const trueAdminHash = createHash("sha256")
        .update(ADMIN_SPECIAL_CODE_HASH)
        .digest("hex");

      if (hashedInput !== trueAdminHash) {
        return c.json({ error: "Invalid admin code" }, 403);
      }

      const auth = c.get("auth");
      const uid = auth.firebaseUser.uid;

      await db
        .insert(users)
        .values({
          firebaseUid: uid,
          email: auth.firebaseUser.email || "",
          name: (auth.firebaseUser.name as string) || "Admin User",
          role: "admin",
          isActive: true,
        })
        .onConflictDoUpdate({
          target: users.firebaseUid,
          set: { role: "admin", lastLogin: new Date() },
        });

      await adminAuth.setCustomUserClaims(uid, { role: "admin" });

      return c.json({
        success: true,
        message: "Admin role granted successfully",
      });
    } catch (error) {
      debugLog.error("Admin verification error", {
        service: "admin-route",
        operation: "verifyAdmin",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Admin verification failed" }, 500);
    }
  },
);

// ─── GET /api/admin/analytics ─────────────────────────────────────────────────

admin.get(
  "/analytics",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const now = new Date();
      const { startOfThisMonth, startOfLastMonth, endOfLastMonth } =
        getMonthBoundaries();

      const _usersWithPaidOrdersSubquery = db
        .select({ userId: orders.userId })
        .from(orders)
        .where(eq(orders.status, "paid"))
        .as("paid_orders_sq");

      const [
        [{ totalCustomers }],
        [{ customersWithPaidOrders }],
        [{ lastMonthCustomers }],
        [{ lastMonthCustomersWithPaidOrders }],
        [{ thisMonthCustomers }],
        [{ thisMonthCustomersWithPaidOrders }],
      ] = await Promise.all([
        db
          .select({ totalCustomers: sql<number>`count(*)::int` })
          .from(users)
          .where(eq(users.role, "user")),
        db
          .select({
            customersWithPaidOrders: sql<number>`count(distinct ${users.id})::int`,
          })
          .from(users)
          .innerJoin(
            orders,
            and(eq(orders.userId, users.id), eq(orders.status, "paid")),
          )
          .where(eq(users.role, "user")),
        db
          .select({ lastMonthCustomers: sql<number>`count(*)::int` })
          .from(users)
          .where(
            and(
              eq(users.role, "user"),
              gte(users.createdAt, startOfLastMonth),
              lte(users.createdAt, endOfLastMonth),
            ),
          ),
        db
          .select({
            lastMonthCustomersWithPaidOrders: sql<number>`count(distinct ${users.id})::int`,
          })
          .from(users)
          .innerJoin(
            orders,
            and(
              eq(orders.userId, users.id),
              eq(orders.status, "paid"),
              gte(orders.createdAt, startOfLastMonth),
              lte(orders.createdAt, endOfLastMonth),
            ),
          )
          .where(
            and(
              eq(users.role, "user"),
              gte(users.createdAt, startOfLastMonth),
              lte(users.createdAt, endOfLastMonth),
            ),
          ),
        db
          .select({ thisMonthCustomers: sql<number>`count(*)::int` })
          .from(users)
          .where(
            and(
              eq(users.role, "user"),
              gte(users.createdAt, startOfThisMonth),
              lte(users.createdAt, now),
            ),
          ),
        db
          .select({
            thisMonthCustomersWithPaidOrders: sql<number>`count(distinct ${users.id})::int`,
          })
          .from(users)
          .innerJoin(
            orders,
            and(
              eq(orders.userId, users.id),
              eq(orders.status, "paid"),
              gte(orders.createdAt, startOfThisMonth),
              lte(orders.createdAt, now),
            ),
          )
          .where(
            and(
              eq(users.role, "user"),
              gte(users.createdAt, startOfThisMonth),
              lte(users.createdAt, now),
            ),
          ),
      ]);

      const conversionRate =
        totalCustomers > 0
          ? (customersWithPaidOrders / totalCustomers) * 100
          : 0;
      const lastMonthConversionRate =
        lastMonthCustomers > 0
          ? (lastMonthCustomersWithPaidOrders / lastMonthCustomers) * 100
          : 0;
      const thisMonthConversionRate =
        thisMonthCustomers > 0
          ? (thisMonthCustomersWithPaidOrders / thisMonthCustomers) * 100
          : 0;
      const percentChange = calculatePercentChange(
        lastMonthConversionRate,
        thisMonthConversionRate,
      );

      return c.json({
        conversionRate,
        lastMonthConversionRate,
        thisMonthConversionRate,
        percentChange,
      });
    } catch (error) {
      debugLog.error("Failed to fetch analytics", {
        service: "admin-route",
        operation: "getAnalytics",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch analytics data" }, 500);
    }
  },
);

// ─── GET /api/admin/customers ─────────────────────────────────────────────────

admin.get(
  "/customers",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const page = parseInt(c.req.query("page") || "1", 10);
      const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 50);
      const search = c.req.query("search");
      const skip = (page - 1) * limit;

      const customerWhere = and(
        eq(users.role, "user"),
        search ? ilike(users.email, `%${search}%`) : undefined,
      );

      const [customers, [{ total }]] = await Promise.all([
        db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            phone: users.phone,
            address: users.address,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
            isActive: users.isActive,
          })
          .from(users)
          .where(customerWhere)
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset(skip),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(users)
          .where(customerWhere),
      ]);

      const totalPages = Math.ceil(total / limit);
      return c.json({
        customers: customers.map((c) => ({
          ...c,
          name: c.name || "",
          email: c.email || "",
          isActive: c.isActive !== undefined ? c.isActive : true,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasMore: page < totalPages,
          hasPrevious: page > 1,
          showing: customers.length,
          from: skip + 1,
          to: skip + customers.length,
        },
      });
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

// ─── GET /api/admin/orders ────────────────────────────────────────────────────

admin.get(
  "/orders",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const page = parseInt(c.req.query("page") || "1", 10);
      const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
      const search = c.req.query("search");
      const customerId = c.req.query("customerId");
      const skip = (page - 1) * limit;

      const orderWhere = and(
        eq(orders.isDeleted, false),
        customerId ? eq(orders.userId, customerId) : undefined,
        search?.trim()
          ? or(
              ilike(orders.id, `%${search}%`),
              ilike(users.name, `%${search}%`),
              ilike(users.email, `%${search}%`),
            )
          : undefined,
      );

      const [orderRows, [{ total }]] = await Promise.all([
        db
          .select({
            order: orders,
            user: { id: users.id, name: users.name, email: users.email },
          })
          .from(orders)
          .innerJoin(users, eq(orders.userId, users.id))
          .where(orderWhere)
          .orderBy(desc(orders.createdAt))
          .limit(limit)
          .offset(skip),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(orders)
          .leftJoin(users, eq(orders.userId, users.id))
          .where(orderWhere),
      ]);
      const ordersWithUser = orderRows.map(({ order, user }) => ({
        ...order,
        user,
      }));

      const totalPages = Math.ceil(total / limit);
      return c.json({
        orders: ordersWithUser.map(formatOrderResponse),
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasMore: page < totalPages,
          hasPrevious: page > 1,
          showing: ordersWithUser.length,
          from: skip + 1,
          to: skip + ordersWithUser.length,
        },
      });
    } catch (error) {
      debugLog.error("Failed to fetch orders", {
        service: "admin-route",
        operation: "getOrders",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch orders" }, 500);
    }
  },
);

// ─── POST /api/admin/orders ───────────────────────────────────────────────────

admin.post(
  "/orders",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const body = await c.req.json();
      const { userId, totalAmount, status } = body;

      if (!userId || totalAmount === undefined) {
        return c.json({ error: "userId and totalAmount are required" }, 400);
      }

      const [newOrder] = await db
        .insert(orders)
        .values({
          userId,
          totalAmount: String(totalAmount),
          status: status || "pending",
        })
        .returning();
      const [orderUser] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const order = { ...newOrder, user: orderUser };

      return c.json({ order: formatOrderResponse(order) }, 201);
    } catch (error) {
      debugLog.error("Failed to create order", {
        service: "admin-route",
        operation: "createOrder",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create order" }, 500);
    }
  },
);

// ─── PUT /api/admin/orders ────────────────────────────────────────────────────

admin.put(
  "/orders",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const body = await c.req.json();
      const { id, userId, totalAmount, status } = body;

      if (!id) return c.json({ error: "id is required" }, 400);

      const updateData: Record<string, unknown> = {};
      if (userId) updateData.userId = userId;
      if (totalAmount !== undefined)
        updateData.totalAmount = String(totalAmount);
      if (status !== undefined) updateData.status = status;

      const [updatedOrder] = await db
        .update(orders)
        .set(updateData)
        .where(eq(orders.id, id))
        .returning();
      const [orderUser] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, updatedOrder.userId))
        .limit(1);
      const order = { ...updatedOrder, user: orderUser };

      return c.json({ order: formatOrderResponse(order) });
    } catch (error) {
      debugLog.error("Failed to update order", {
        service: "admin-route",
        operation: "updateOrder",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update order" }, 500);
    }
  },
);

// ─── DELETE /api/admin/orders ─────────────────────────────────────────────────

admin.delete(
  "/orders",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const body = await c.req.json();
      const { id, deletedBy } = body;

      if (!id) return c.json({ error: "id is required" }, 400);

      const [existing] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);
      if (!existing) return c.json({ error: "Order not found" }, 404);

      const [deletedOrder] = await db
        .update(orders)
        .set({
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: deletedBy || "admin",
        })
        .where(eq(orders.id, id))
        .returning();
      const [orderUser] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, deletedOrder.userId))
        .limit(1);
      const order = { ...deletedOrder, user: orderUser };

      return c.json({ order: formatOrderResponse(order), deleted: true });
    } catch (error) {
      debugLog.error("Failed to delete order", {
        service: "admin-route",
        operation: "deleteOrder",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete order" }, 500);
    }
  },
);

// ─── GET /api/admin/orders/:id ────────────────────────────────────────────────

admin.get(
  "/orders/:id",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const id = c.req.param("id");

      const [orderRow] = await db
        .select({
          order: orders,
          user: { id: users.id, name: users.name, email: users.email },
        })
        .from(orders)
        .innerJoin(users, eq(orders.userId, users.id))
        .where(eq(orders.id, id))
        .limit(1);
      if (!orderRow) return c.json({ error: "Order not found" }, 404);
      const order = { ...orderRow.order, user: orderRow.user };

      return c.json({ order: formatOrderResponse(order) });
    } catch (error) {
      debugLog.error("Failed to fetch order", {
        service: "admin-route",
        operation: "getOrderById",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch order" }, 500);
    }
  },
);

// ─── GET /api/admin/subscriptions ────────────────────────────────────────────

admin.get(
  "/subscriptions",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const page = parseInt(c.req.query("page") || "1", 10);
      const limit = parseInt(c.req.query("limit") || "50", 10);
      const status = c.req.query("status");
      const tier = c.req.query("tier");
      const search = c.req.query("search");

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

admin.get(
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

admin.get(
  "/subscriptions/:id",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const id = c.req.param("id");
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

// ─── GET /api/admin/feature-usages ───────────────────────────────────────────

admin.get(
  "/feature-usages",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const page = parseInt(c.req.query("page") || "1", 10);
      const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
      const skip = (page - 1) * limit;

      const [usages, [{ total }]] = await Promise.all([
        db
          .select()
          .from(featureUsages)
          .orderBy(desc(featureUsages.createdAt))
          .limit(limit)
          .offset(skip),
        db.select({ total: sql<number>`count(*)::int` }).from(featureUsages),
      ]);

      const totalPages = Math.ceil(total / limit);
      return c.json({
        featureUsages: usages,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
          hasPrevious: page > 1,
        },
      });
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

// ─── POST /api/admin/sync-firebase ────────────────────────────────────────────

admin.post(
  "/sync-firebase",
  rateLimiter("admin"),
  csrfMiddleware(),
  authMiddleware("admin"),
  async (c) => {
    try {
      const results = await FirebaseUserSync.syncAllUsers();

      const summary = {
        total: results.length,
        successful: results.filter((r: { success?: boolean }) => r.success)
          .length,
        failed: results.filter((r: { success?: boolean }) => !r.success).length,
        results,
      };

      return c.json({ success: true, summary });
    } catch (error) {
      debugLog.error("Failed to sync Firebase", {
        service: "admin-route",
        operation: "syncFirebase",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to sync with Firebase" }, 500);
    }
  },
);

// ─── GET /api/admin/database/health ──────────────────────────────────────────

admin.get(
  "/database/health",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({ status: "healthy", database: "connected" });
    } catch (error) {
      debugLog.error("Database health check failed", {
        service: "admin-route",
        operation: "databaseHealthCheck",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json(
        { status: "unhealthy", database: "disconnected", error: String(error) },
        503,
      );
    }
  },
);

// ─── GET /api/admin/schema ─────────────────────────────────────────────────────

admin.get(
  "/schema",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      // Return actual Drizzle schema structure
      const getTableName = (table: any) => {
        const firstColumn = Object.values(table)[0] as { tableName?: string };
        return firstColumn?.tableName || "unknown";
      };

      const schema = {
        tables: [
          {
            name: "User",
            tableName: getTableName(users),
            columns: Object.entries(users).map(([key, column]) => ({
              name: key,
              dataType: (column as any).dataType,
              nullable: (column as any).nullable,
              hasDefault: !!(column as any).hasDefault,
              primaryKey: key === "id",
              unique: (column as any).unique || false,
            })),
          },
          {
            name: "Order",
            tableName: getTableName(orders),
            columns: Object.entries(orders).map(([key, column]) => ({
              name: key,
              dataType: (column as any).dataType,
              nullable: (column as any).nullable,
              hasDefault: !!(column as any).hasDefault,
              primaryKey: key === "id",
              unique: (column as any).unique || false,
            })),
          },
          {
            name: "ContactMessage",
            tableName: getTableName(contactMessages),
            columns: Object.entries(contactMessages).map(([key, column]) => ({
              name: key,
              dataType: (column as any).dataType,
              nullable: (column as any).nullable,
              hasDefault: !!(column as any).hasDefault,
              primaryKey: key === "id",
              unique: (column as any).unique || false,
            })),
          },
          {
            name: "FeatureUsage",
            tableName: getTableName(featureUsages),
            columns: Object.entries(featureUsages).map(([key, column]) => ({
              name: key,
              dataType: (column as any).dataType,
              nullable: (column as any).nullable,
              hasDefault: !!(column as any).hasDefault,
              primaryKey: key === "id",
              unique: (column as any).unique || false,
            })),
          },
        ],
      };

      return c.json(schema);
    } catch (error) {
      debugLog.error("Failed to fetch schema", {
        service: "admin-route",
        operation: "getSchema",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch schema" }, 500);
    }
  },
);

// ─── GET /api/admin/ai-costs ─────────────────────────────────────────────────

admin.get(
  "/ai-costs",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const period = c.req.query("period") ?? "30d";

      const now = new Date();
      let periodStart: Date;
      switch (period) {
        case "7d":
          periodStart = new Date(now.getTime() - 7 * 86_400_000);
          break;
        case "90d":
          periodStart = new Date(now.getTime() - 90 * 86_400_000);
          break;
        case "all":
          periodStart = new Date(0);
          break;
        default: // 30d
          periodStart = new Date(now.getTime() - 30 * 86_400_000);
      }

      const [totals, byProvider, byModel, byFeature, byDay] = await Promise.all([
        // Overall totals
        db
          .select({
            totalCost: sql<string>`sum(total_cost)::text`,
            totalInputTokens: sql<number>`sum(input_tokens)::int`,
            totalOutputTokens: sql<number>`sum(output_tokens)::int`,
            callCount: sql<number>`count(*)::int`,
          })
          .from(aiCostLedger)
          .where(gte(aiCostLedger.createdAt, periodStart)),

        // Breakdown by provider
        db
          .select({
            provider: aiCostLedger.provider,
            totalCost: sql<string>`sum(total_cost)::text`,
            callCount: sql<number>`count(*)::int`,
          })
          .from(aiCostLedger)
          .where(gte(aiCostLedger.createdAt, periodStart))
          .groupBy(aiCostLedger.provider)
          .orderBy(sql`sum(total_cost) desc`),

        // Breakdown by model
        db
          .select({
            provider: aiCostLedger.provider,
            model: aiCostLedger.model,
            totalCost: sql<string>`sum(total_cost)::text`,
            inputTokens: sql<number>`sum(input_tokens)::int`,
            outputTokens: sql<number>`sum(output_tokens)::int`,
            callCount: sql<number>`count(*)::int`,
          })
          .from(aiCostLedger)
          .where(gte(aiCostLedger.createdAt, periodStart))
          .groupBy(aiCostLedger.provider, aiCostLedger.model)
          .orderBy(sql`sum(total_cost) desc`),

        // Breakdown by feature type
        db
          .select({
            featureType: aiCostLedger.featureType,
            totalCost: sql<string>`sum(total_cost)::text`,
            callCount: sql<number>`count(*)::int`,
          })
          .from(aiCostLedger)
          .where(gte(aiCostLedger.createdAt, periodStart))
          .groupBy(aiCostLedger.featureType)
          .orderBy(sql`sum(total_cost) desc`),

        // Daily cost trend
        db
          .select({
            day: sql<string>`date_trunc('day', created_at)::text`,
            totalCost: sql<string>`sum(total_cost)::text`,
            callCount: sql<number>`count(*)::int`,
          })
          .from(aiCostLedger)
          .where(gte(aiCostLedger.createdAt, periodStart))
          .groupBy(sql`date_trunc('day', created_at)`)
          .orderBy(sql`date_trunc('day', created_at) asc`),
      ]);

      return c.json({
        period,
        totals: totals[0] ?? { totalCost: "0", totalInputTokens: 0, totalOutputTokens: 0, callCount: 0 },
        byProvider,
        byModel,
        byFeature,
        byDay,
      });
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

// ─── GET /api/admin/ai-costs/by-user ─────────────────────────────────────────

admin.get(
  "/ai-costs/by-user",
  rateLimiter("admin"),
  authMiddleware("admin"),
  async (c) => {
    try {
      const period = c.req.query("period") ?? "30d";
      const limit = Math.min(parseInt(c.req.query("limit") ?? "20", 10), 100);

      const now = new Date();
      const periodStart =
        period === "all"
          ? new Date(0)
          : new Date(now.getTime() - parseInt(period) * 86_400_000);

      const rows = await db
        .select({
          userId: aiCostLedger.userId,
          totalCost: sql<string>`sum(total_cost)::text`,
          callCount: sql<number>`count(*)::int`,
          inputTokens: sql<number>`sum(input_tokens)::int`,
          outputTokens: sql<number>`sum(output_tokens)::int`,
        })
        .from(aiCostLedger)
        .where(and(gte(aiCostLedger.createdAt, periodStart), sql`user_id is not null`))
        .groupBy(aiCostLedger.userId)
        .orderBy(sql`sum(total_cost) desc`)
        .limit(limit);

      return c.json({ period, users: rows });
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

export default admin;
