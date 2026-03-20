import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  users,
  orders,
  queueItems,
  featureUsages,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { adminAuth } from "../../services/firebase/admin";
import { debugLog } from "../../utils/debug/debug";
import { getFeatureLimitsForStripeRole } from "../../constants/subscription.constants";

const customer = new Hono<HonoEnv>();

// ─── Usage ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/customer/usage
 * Returns usage stats for the current user.
 */
customer.get(
  "/usage",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const userId = auth.user.id;
      const stripeRole = auth.firebaseUser.stripeRole;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const limits = getFeatureLimitsForStripeRole(stripeRole);

      const [analysesCount, generationsCount, queueSizeCount] =
        await Promise.all([
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(featureUsages)
            .where(
              and(
                eq(featureUsages.userId, userId),
                eq(featureUsages.featureType, "reel_analysis"),
                gte(featureUsages.createdAt, monthStart),
              ),
            ),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(featureUsages)
            .where(
              and(
                eq(featureUsages.userId, userId),
                eq(featureUsages.featureType, "generation"),
                gte(featureUsages.createdAt, monthStart),
              ),
            ),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(queueItems)
            .where(
              and(
                eq(queueItems.userId, userId),
                eq(queueItems.status, "scheduled"),
              ),
            ),
        ]);

      return c.json({
        reelsAnalyzed: analysesCount[0]?.count ?? 0,
        reelsAnalyzedLimit: limits.analysis,
        contentGenerated: generationsCount[0]?.count ?? 0,
        contentGeneratedLimit: limits.generation,
        queueSize: queueSizeCount[0]?.count ?? 0,
        queueLimit: null,
        tier: stripeRole ?? "free",
        resetDate: resetDate.toISOString(),
      });
    } catch (error) {
      debugLog.error("Failed to fetch usage stats", {
        service: "customer-route",
        operation: "getUsage",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch usage stats" }, 500);
    }
  },
);

// ─── Profile ───────────────────────────────────────────────────────────────────

/**
 * GET /api/customer/profile
 */
customer.get(
  "/profile",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");

      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          address: users.address,
          role: users.role,
          timezone: users.timezone,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(and(eq(users.id, auth.user.id), eq(users.isDeleted, false)));

      if (!user) return c.json({ error: "User not found" }, 404);

      let isOAuthUser = false;
      try {
        if (auth.firebaseUser?.uid) {
          const fbUser = await adminAuth.getUser(auth.firebaseUser.uid);
          isOAuthUser = !fbUser.providerData.some(
            (p: { providerId?: string }) => p.providerId === "password",
          );
        }
      } catch {
        // Continue without provider info
      }

      return c.json({ profile: user, isOAuthUser });
    } catch (error) {
      debugLog.error("Failed to fetch profile", {
        service: "customer-route",
        operation: "getProfile",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch profile" }, 500);
    }
  },
);

/**
 * PUT /api/customer/profile
 */
customer.put(
  "/profile",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const body = await c.req.json();
      const { name, email, phone, address, timezone } = body;

      // Handle email change with Firebase
      if (email !== undefined && email !== auth.user.email) {
        const fbUser = await adminAuth.getUser(auth.firebaseUser.uid);
        const hasEmailProvider = fbUser.providerData.some(
          (p: any) => p.providerId === "password",
        );

        if (!hasEmailProvider) {
          return c.json(
            {
              error:
                "Cannot change email for OAuth accounts. Update through your OAuth provider.",
              code: "OAUTH_EMAIL_CHANGE_NOT_ALLOWED",
            },
            400,
          );
        }

        try {
          await adminAuth.getUserByEmail(email);
          return c.json(
            { error: "Email already in use", code: "EMAIL_ALREADY_EXISTS" },
            400,
          );
        } catch (e: any) {
          if (e.code !== "auth/user-not-found") throw e;
        }

        await adminAuth.updateUser(auth.firebaseUser.uid, { email });
      }

      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone || null;
      if (address !== undefined) updateData.address = address || null;
      if (timezone !== undefined) updateData.timezone = timezone;

      if (Object.keys(updateData).length === 0) {
        return c.json(
          { error: "No fields to update", code: "NO_FIELDS_PROVIDED" },
          400,
        );
      }

      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, auth.user.id))
        .returning({
          id: users.id,
          name: users.name,
          email: users.email,
          phone: users.phone,
          address: users.address,
          timezone: users.timezone,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      return c.json({
        message: "Profile updated successfully",
        profile: updatedUser,
      });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err?.code === "23505") {
        return c.json(
          { error: "Email already exists", code: "EMAIL_ALREADY_EXISTS" },
          400,
        );
      }
      debugLog.error("Failed to update profile", {
        service: "customer-route",
        operation: "updateProfile",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to update profile" }, 500);
    }
  },
);

// ─── Orders ────────────────────────────────────────────────────────────────────

/**
 * GET /api/customer/orders
 */
customer.get(
  "/orders",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");

      const page = parseInt(c.req.query("page") || "1", 10);
      const limit = parseInt(c.req.query("limit") || "10", 10);
      const skip = (page - 1) * limit;

      const [orderRows, [{ count: total }]] = await Promise.all([
        db
          .select()
          .from(orders)
          .where(eq(orders.userId, auth.user.id))
          .orderBy(desc(orders.createdAt))
          .offset(skip)
          .limit(limit),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(orders)
          .where(eq(orders.userId, auth.user.id)),
      ]);

      return c.json({
        orders: orderRows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      debugLog.error("Failed to fetch orders", {
        service: "customer-route",
        operation: "getOrders",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch orders" }, 500);
    }
  },
);

/**
 * POST /api/customer/orders
 */
customer.post(
  "/orders",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const body = await c.req.json();

      const [order] = await db
        .insert(orders)
        .values({ ...body, userId: auth.user.id })
        .returning();

      return c.json(order, 201);
    } catch (error) {
      debugLog.error("Failed to create order", {
        service: "customer-route",
        operation: "createOrder",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create order" }, 500);
    }
  },
);

/**
 * GET /api/customer/orders/by-session
 */
customer.get(
  "/orders/by-session",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const sessionId = c.req.query("sessionId");
      if (!sessionId) return c.json({ error: "sessionId is required" }, 400);

      const [order] = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.stripeSessionId, sessionId),
            eq(orders.userId, auth.user.id),
          ),
        )
        .limit(1);

      if (!order) return c.json({ error: "Order not found" }, 404);
      return c.json(order);
    } catch (error) {
      debugLog.error("Failed to fetch order by session", {
        service: "customer-route",
        operation: "getOrderBySession",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch order" }, 500);
    }
  },
);

/**
 * GET /api/customer/orders/total-revenue
 */
customer.get(
  "/orders/total-revenue",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");

      const [result] = await db
        .select({ total: sql<string>`sum(total_amount)` })
        .from(orders)
        .where(
          and(eq(orders.userId, auth.user.id), eq(orders.status, "completed")),
        );

      return c.json({ totalRevenue: result?.total || 0 });
    } catch (error) {
      debugLog.error("Failed to fetch total revenue", {
        service: "customer-route",
        operation: "getTotalRevenue",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch total revenue" }, 500);
    }
  },
);

/**
 * GET /api/customer/orders/:orderId
 */
customer.get(
  "/orders/:orderId",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const orderId = c.req.param("orderId");

      const [order] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.userId, auth.user.id)))
        .limit(1);

      if (!order) return c.json({ error: "Order not found" }, 404);
      return c.json(order);
    } catch (error) {
      debugLog.error("Failed to fetch order", {
        service: "customer-route",
        operation: "getOrderById",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch order" }, 500);
    }
  },
);

/**
 * POST /api/customer/fix-stripe-customer
 * Stripe customer data is managed by Firestore via the Firebase Extension.
 * This endpoint is a no-op kept for API compatibility.
 */
customer.post(
  "/fix-stripe-customer",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    return c.json({ message: "Stripe customer ID cleared successfully" });
  },
);

// Mount user settings sub-router
import userSettingsRouter from "./settings";
customer.route("/settings", userSettingsRouter);

export default customer;
