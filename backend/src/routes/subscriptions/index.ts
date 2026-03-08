import { Hono } from "hono";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import {
  FIREBASE_PROJECT_ID_SERVER,
  FIREBASE_PROJECT_ID,
  BASE_URL,
  STRIPE_SECRET_KEY,
} from "../../utils/config/envUtil";
import { adminDb } from "../../services/firebase/admin";
import { db } from "../../services/db/db";
import { debugLog } from "../../utils/debug/debug";
import { users } from "../../infrastructure/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { STRIPE_MAP } from "../../constants/stripe.constants";
import Stripe from "stripe";

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

const subscriptions = new Hono<HonoEnv>();

// ─── GET /api/subscriptions/current ─────────────────────────────────────────

subscriptions.get(
  "/current",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
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
          const [dbUser] = await db
            .select({ hasUsedFreeTrial: users.hasUsedFreeTrial })
            .from(users)
            .where(eq(users.id, auth.user.id))
            .limit(1);
          if (dbUser && !dbUser.hasUsedFreeTrial) {
            await db
              .update(users)
              .set({ hasUsedFreeTrial: true })
              .where(eq(users.id, auth.user.id));
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
          } else if (tierConfig.prices?.annual?.priceId === priceId) {
            billingCycle = "annual";
            break;
          }
        }
      }

      const isInTrial = subData.status === "trialing";
      const trialEnd = subData.trial_end
        ? new Date(subData.trial_end * 1000).toISOString()
        : null;

      return c.json({
        subscription: {
          id: subscriptionDoc.id,
          tier: tierFromMetadata,
          billingCycle,
          status: subData.status || "inactive",
          currentPeriodStart: subData.current_period_start
            ? new Date(subData.current_period_start * 1000).toISOString()
            : null,
          currentPeriodEnd: subData.current_period_end
            ? new Date(subData.current_period_end * 1000).toISOString()
            : null,
          isInTrial,
          trialEnd,
        },
        tier: tierFromMetadata,
        billingCycle,
        isInTrial,
      });
    } catch (error) {
      debugLog.error("Error fetching current subscription", {
        service: "subscriptions-route",
        operation: "getCurrentSubscription",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch subscription" }, 500);
    }
  },
);

// ─── GET /api/subscriptions/trial-eligibility ────────────────────────────────

subscriptions.get(
  "/trial-eligibility",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");

      const [dbUser] = await db
        .select({ hasUsedFreeTrial: users.hasUsedFreeTrial })
        .from(users)
        .where(eq(users.id, auth.user.id))
        .limit(1);

      if (!dbUser) return c.json({ error: "User not found" }, 404);

      let isInTrial = false;
      const uid = auth.firebaseUser.uid;
      if (uid) {
        const trialingSnapshot = await adminDb
          .collection("customers")
          .doc(uid)
          .collection("subscriptions")
          .where("status", "==", "trialing")
          .get();
        isInTrial = !trialingSnapshot.empty;
      }

      const isEligible = !dbUser.hasUsedFreeTrial && !isInTrial;

      return c.json({
        isEligible,
        hasUsedFreeTrial: dbUser.hasUsedFreeTrial,
        isInTrial,
      });
    } catch (error) {
      debugLog.error("Error checking trial eligibility", {
        service: "subscriptions-route",
        operation: "checkTrialEligibility",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to check trial eligibility" }, 500);
    }
  },
);

// ─── POST /api/subscriptions/portal-link ─────────────────────────────────────

subscriptions.post(
  "/portal-link",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const authHeader = c.req.header("Authorization");
      const token = authHeader?.replace("Bearer ", "");

      if (!token) return c.json({ error: "Authentication required" }, 401);

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
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(
          errorData.error?.message ||
            errorData.error ||
            `HTTP ${response.status}`,
        );
      }

      const result: any = await response.json();

      if (result.error) {
        throw new Error(
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

      if (!portalUrl) throw new Error("No portal URL in response");

      return c.json({ url: portalUrl });
    } catch (error) {
      debugLog.error("Error creating portal link", {
        service: "subscriptions-route",
        operation: "createPortalLink",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create portal link" }, 500);
    }
  },
);

// ─── POST /api/subscriptions/checkout ────────────────────────────────────────

subscriptions.post(
  "/checkout",
  rateLimiter("payment"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const body = await c.req.json();
      const { priceId, tier, billingCycle, trialEnabled } = body;

      if (!priceId) return c.json({ error: "priceId is required" }, 400);

      if (!stripe) return c.json({ error: "Stripe not configured" }, 500);

      const origin = c.req.header("origin") || "http://localhost:5173";
      const baseUrl = BASE_URL !== "[BASE_URL]" ? BASE_URL : origin;
      const uid = auth.firebaseUser.uid;

      // Check trial eligibility
      let allowTrial = false;
      if (trialEnabled) {
        const [dbUser] = await db
          .select({ hasUsedFreeTrial: users.hasUsedFreeTrial })
          .from(users)
          .where(eq(users.id, auth.user.id))
          .limit(1);
        const trialingSnapshot = await adminDb
          .collection("customers")
          .doc(uid)
          .collection("subscriptions")
          .where("status", "==", "trialing")
          .get();
        allowTrial = !dbUser?.hasUsedFreeTrial && trialingSnapshot.empty;
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

      return c.json({ url: session.url });
    } catch (error) {
      debugLog.error("Error creating checkout session", {
        service: "subscriptions-route",
        operation: "createCheckoutSession",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create checkout session" }, 500);
    }
  },
);

export default subscriptions;
