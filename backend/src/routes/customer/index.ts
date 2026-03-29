import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { queueService, customerService } from "../../domain/singletons";
import Stripe from "stripe";
import { adminAuth } from "../../services/firebase/admin";
import { Errors } from "../../utils/errors/app-error";
import { getFeatureLimitsForStripeRole } from "../../constants/subscription.constants";
import { STRIPE_SECRET_KEY } from "../../utils/config/envUtil";
import {
  createCustomerOrderSchema,
  createOrderFromCheckoutSchema,
  customerOrderIdParamSchema,
  customerOrdersQuerySchema,
  orderBySessionQuerySchema,
  updateCustomerProfileSchema,
} from "../../domain/customer/customer.schemas";

const stripeClient = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

const customer = new Hono<HonoEnv>();
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
    const auth = c.get("auth");
    const userId = auth.user.id;
    const stripeRole = auth.firebaseUser.stripeRole;

    const limits = getFeatureLimitsForStripeRole(stripeRole);
    const queueSize = await queueService.countScheduledForUser(userId);

    const stats = await customerService.getUsageStats(
      userId,
      stripeRole,
      queueSize,
      limits,
    );

    return c.json(stats);
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
    const auth = c.get("auth");

    const user = await customerService.getProfile(auth.user.id);

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
  zValidator("json", updateCustomerProfileSchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { name, email, phone, address, timezone } = c.req.valid("json");

    // Handle email change with Firebase
    if (email !== undefined && email !== auth.user.email) {
      const fbUser = await adminAuth.getUser(auth.firebaseUser.uid);
      const hasEmailProvider = fbUser.providerData.some(
        (p: any) => p.providerId === "password",
      );

      if (!hasEmailProvider) {
        throw Errors.badRequest(
          "Cannot change email for OAuth accounts. Update through your OAuth provider.",
          "OAUTH_EMAIL_CHANGE_NOT_ALLOWED",
        );
      }

      try {
        await adminAuth.getUserByEmail(email);
        throw Errors.badRequest("Email already in use", "EMAIL_ALREADY_EXISTS");
      } catch (e: any) {
        if (e.code !== "auth/user-not-found") throw e;
      }

      await adminAuth.updateUser(auth.firebaseUser.uid, { email });
    }

    const updateData: {
      name?: string;
      email?: string;
      phone?: string | null;
      address?: string | null;
      timezone?: string;
    } = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone || null;
    if (address !== undefined) updateData.address = address || null;
    if (timezone !== undefined) updateData.timezone = timezone;

    if (Object.keys(updateData).length === 0) {
      throw Errors.badRequest("No fields to update", "NO_FIELDS_PROVIDED");
    }

    try {
      const updatedUser = await customerService.updateProfile(
        auth.user.id,
        updateData,
      );

      return c.json({
        message: "Profile updated successfully",
        profile: updatedUser,
      });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err?.code === "23505") {
        throw Errors.badRequest("Email already exists", "EMAIL_ALREADY_EXISTS");
      }
      throw error;
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
  zValidator("query", customerOrdersQuerySchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { page, limit } = c.req.valid("query");

    const result = await customerService.listOrders(auth.user.id, {
      page,
      limit,
    });

    return c.json(result);
  },
);

/**
 * POST /api/customer/orders/create
 *
 * Creates a completed order from a Stripe Checkout Session (mode=payment).
 * Verifies payment with Stripe, checks metadata.userId, and fills totalAmount from the session.
 */
customer.post(
  "/orders/create",
  rateLimiter("payment"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createOrderFromCheckoutSchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    if (!stripeClient) {
      throw Errors.internal("Stripe is not configured");
    }

    const { stripeSessionId, status } = c.req.valid("json");

    // Check for existing order
    const existing = await customerService.getOrderByStripeSessionId(
      auth.user.id,
      stripeSessionId,
    );
    if (existing) {
      return c.json({ order: existing }, 200);
    }

    const session =
      await stripeClient.checkout.sessions.retrieve(stripeSessionId);

    if (session.mode !== "payment") {
      throw Errors.badRequest(
        "Checkout session is not a one-time payment",
        "INVALID_SESSION_MODE",
      );
    }

    if (
      session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required"
    ) {
      throw Errors.badRequest(
        `Payment not completed for this session: ${session.payment_status}`,
        "PAYMENT_NOT_COMPLETED",
      );
    }

    const metaUserId = session.metadata?.userId;
    // Checkout metadata uses Firebase UID (see frontend createProductCheckout / PaymentService).
    if (!metaUserId || metaUserId !== auth.firebaseUser.uid) {
      throw Errors.forbidden("Session does not belong to this user");
    }

    const amountCents = session.amount_total;
    if (amountCents == null) {
      throw Errors.badRequest(
        "Session has no amount_total; cannot create order",
        "MISSING_AMOUNT",
      );
    }

    const totalAmount = (amountCents / 100).toFixed(2);

    try {
      const order = await customerService.createOrderFromCheckout(
        auth.user.id,
        {
          totalAmount,
          status: status ?? "completed",
          stripeSessionId,
        },
      );

      return c.json({ order }, 201);
    } catch (insertErr: unknown) {
      const code =
        insertErr && typeof insertErr === "object" && "code" in insertErr
          ? (insertErr as { code?: string }).code
          : undefined;
      if (code === "23505") {
        // Race condition - order was created by another request
        const race = await customerService.getOrderByStripeSessionId(
          auth.user.id,
          stripeSessionId,
        );
        if (race) return c.json({ order: race }, 200);
      }
      throw insertErr;
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
  zValidator("json", createCustomerOrderSchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const body = c.req.valid("json");

    const order = await customerService.createOrder(auth.user.id, {
      totalAmount: String(body.totalAmount),
      status: body.status,
      stripeSessionId: body.stripeSessionId,
    });

    return c.json(order, 201);
  },
);

/**
 * GET /api/customer/orders/by-session
 */
customer.get(
  "/orders/by-session",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", orderBySessionQuerySchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { sessionId } = c.req.valid("query");

    const order = await customerService.getOrderByStripeSessionId(
      auth.user.id,
      sessionId,
    );

    if (!order) {
      throw Errors.notFound("Order");
    }

    return c.json(order);
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
    const auth = c.get("auth");

    const totalRevenue = await customerService.getTotalRevenue(auth.user.id);

    return c.json({ totalRevenue });
  },
);

/**
 * GET /api/customer/orders/:orderId
 */
customer.get(
  "/orders/:orderId",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", customerOrderIdParamSchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { orderId } = c.req.valid("param");

    const order = await customerService.getOrderById(auth.user.id, orderId);

    return c.json(order);
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
