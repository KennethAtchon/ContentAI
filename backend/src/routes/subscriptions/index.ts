import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import {
  FIREBASE_PROJECT_ID_SERVER,
  FIREBASE_PROJECT_ID,
  BASE_URL,
  STRIPE_SECRET_KEY,
} from "../../utils/config/envUtil";
import { adminDb } from "../../services/firebase/admin";
import { usersService } from "../../domain/singletons";
import { Errors } from "../../utils/errors/app-error";
import { STRIPE_MAP } from "../../constants/stripe.constants";
import Stripe from "stripe";
import { createCheckoutSessionBodySchema } from "../../domain/subscriptions/subscriptions.schemas";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

const subscriptions = new Hono<HonoEnv>();
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

// ─── GET /api/subscriptions/current ─────────────────────────────────────────

subscriptions.get(
  "/current",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    const auth = c.get("auth");
    const uid = auth.firebaseUser.uid;

    const customerRef = adminDb.collection("customers").doc(uid);
    const subscriptionsSnapshot = await customerRef
      .collection("subscriptions")
      .where("status", "in", ["active", "trialing"])
      .get();

    if (subscriptionsSnapshot.empty) {
      return c.json({ subscription: null, tier: null, billingCycle: null });
    }

    const subscriptionDoc = subscriptionsSnapshot.docs[0];
    const subData = subscriptionDoc.data();

    // Mark hasUsedFreeTrial when user has any active subscription
    if (subData.status === "trialing" || subData.status === "active") {
      try {
        const user = await usersService.getUserById(auth.user.id);
        if (!user.hasUsedFreeTrial) {
          await usersService.updateUser(auth.user.id, {
            hasUsedFreeTrial: true,
          });
        }
      } catch {
        // Don't fail the request if marking fails
      }
    }

    const tierFromMetadata = subData.metadata?.tier || "basic";

    let billingCycle: "monthly" | "annual" | null = null;
    if (subData.metadata?.billingCycle) {
      billingCycle = subData.metadata.billingCycle as "monthly" | "annual";
    } else if (subData.items?.data?.[0]?.price?.interval) {
      const interval = subData.items.data[0].price.interval;
      billingCycle = interval === "month" ? "monthly" : "annual";
    } else if (subData.items?.data?.[0]?.price?.id) {
      const priceId = subData.items.data[0].price.id;
      for (const [, tierConfig] of Object.entries(
        STRIPE_MAP.tiers,
      ) as any[]) {
        if (tierConfig.prices?.monthly?.priceId === priceId) {
          billingCycle = "monthly";
          break;
        }
        if (tierConfig.prices?.annual?.priceId === priceId) {
          billingCycle = "annual";
          break;
        }
      }
    }

    return c.json({
      subscription: {
        id: subscriptionDoc.id,
        status: subData.status,
        currentPeriodStart: subData.current_period_start
          ? new Date(subData.current_period_start * 1000).toISOString()
          : null,
        currentPeriodEnd: subData.current_period_end
          ? new Date(subData.current_period_end * 1000).toISOString()
          : null,
        cancelAtPeriodEnd: subData.cancel_at_period_end || false,
      },
      tier: tierFromMetadata,
      billingCycle,
    });
  },
);

// ─── POST /api/subscriptions/portal ─────────────────────────────────────────

subscriptions.post(
  "/portal",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) throw Errors.unauthorized();

    const projectId = FIREBASE_PROJECT_ID_SERVER || FIREBASE_PROJECT_ID;
    const region = "us-central1";
    const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/ext-firestore-stripe-payments-createPortalLink`;
    const origin = c.req.header("origin") || "http://localhost:5173";
    const baseUrl = BASE_URL !== "[BASE_URL]" ? BASE_URL : origin;

    const callableData = {
      data: {
        returnUrl: `${baseUrl}/account`,
        locale: "auto",
        features: {
          subscription_update: {
            enabled: true,
            default_allowed_updates: ["price"],
            proration_behavior: "none",
          },
        },
      },
    };

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(callableData),
    });

    if (!response.ok) {
      const errorData: any = await response
        .json()
        .catch(() => ({
          error: "Unknown error",
          code: "UPSTREAM_ERROR",
        }));
      throw Errors.internal(
        errorData.error?.message || errorData.error || `HTTP ${response.status}`,
      );
    }

    const result: any = await response.json();

    if (result.error) {
      throw Errors.internal(
        result.error.message || result.error || "Firebase Extension error",
      );
    }

    const portalUrl =
      result.data?.url ||
      result.url ||
      result.result?.url ||
      result.result?.data?.url ||
      (typeof result.data === "string" ? result.data : null) ||
      (typeof result === "string" ? result : null);

    if (!portalUrl) throw Errors.internal("No portal URL in response");

    return c.json({ url: portalUrl });
  },
);

// ─── POST /api/subscriptions/checkout ────────────────────────────────────────

subscriptions.post(
  "/checkout",
  rateLimiter("payment"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createCheckoutSessionBodySchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { priceId, tier, billingCycle, trialEnabled } = c.req.valid("json");

    if (!stripe) throw Errors.internal("Stripe not configured");

    const origin = c.req.header("origin") || "http://localhost:5173";
    const baseUrl = BASE_URL !== "[BASE_URL]" ? BASE_URL : origin;
    const uid = auth.firebaseUser.uid;

    // Check trial eligibility
    let allowTrial = false;
    if (trialEnabled) {
      const user = await usersService.getUserById(auth.user.id);
      const trialingSnapshot = await adminDb
        .collection("customers")
        .doc(uid)
        .collection("subscriptions")
        .where("status", "==", "trialing")
        .get();
      allowTrial = !user.hasUsedFreeTrial && trialingSnapshot.empty;
    }

    // Find existing Stripe customer from Firestore
    const customerDoc = await adminDb.collection("customers").doc(uid).get();
    let stripeCustomerId: string | undefined = customerDoc.data()?.stripeId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: auth.user.email,
        metadata: { firebaseUID: uid },
      });
      stripeCustomerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      subscription_data: {
        ...(allowTrial ? { trial_period_days: 14 } : {}),
        metadata: {
          tier: tier || "basic",
          billingCycle: billingCycle || "monthly",
          firebaseUID: uid,
        },
      },
      metadata: {
        tier: tier || "basic",
        billingCycle: billingCycle || "monthly",
        firebaseUID: uid,
      },
    });

    if (!session.url) throw Errors.internal("Failed to create checkout session");

    return c.json({ url: session.url });
  },
);

export default subscriptions;
