import type { Firestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { STRIPE_MAP } from "../../constants/stripe.constants";
import {
  BASE_URL,
  FIREBASE_PROJECT_ID,
  FIREBASE_PROJECT_ID_SERVER,
} from "../../utils/config/envUtil";
import { Errors } from "../../utils/errors/app-error";
import type { UsersService } from "../users/users.service";

type SubscriptionDocData = {
  status?: string;
  metadata?: { tier?: string; billingCycle?: string };
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  items?: {
    data?: Array<{
      price?: { interval?: string; id?: string };
    }>;
  };
};

export async function getCurrentSubscriptionPayload(
  db: Firestore,
  usersService: UsersService,
  uid: string,
  userId: string,
) {
  const customerRef = db.collection("customers").doc(uid);
  const subscriptionsSnapshot = await customerRef
    .collection("subscriptions")
    .where("status", "in", ["active", "trialing"])
    .get();

  if (subscriptionsSnapshot.empty) {
    return { subscription: null, tier: null, billingCycle: null };
  }

  const subscriptionDoc = subscriptionsSnapshot.docs[0];
  const subData = subscriptionDoc.data() as SubscriptionDocData;

  if (subData.status === "trialing" || subData.status === "active") {
    try {
      const user = await usersService.getUserById(userId);
      if (!user.hasUsedFreeTrial) {
        await usersService.updateUser(userId, { hasUsedFreeTrial: true });
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
    for (const tierConfig of Object.values(STRIPE_MAP.tiers)) {
      if (tierConfig.prices.monthly.priceId === priceId) {
        billingCycle = "monthly";
        break;
      }
      if (tierConfig.prices.annual.priceId === priceId) {
        billingCycle = "annual";
        break;
      }
    }
  }

  return {
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
  };
}

export async function createStripeCustomerPortalUrl(
  idToken: string,
  requestOrigin: string | null,
): Promise<string> {
  const projectId = FIREBASE_PROJECT_ID_SERVER || FIREBASE_PROJECT_ID;
  const region = "us-central1";
  const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/ext-firestore-stripe-payments-createPortalLink`;
  const origin = requestOrigin || "http://localhost:5173";
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
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(callableData),
  });

  if (!response.ok) {
    const errorData: {
      error?: { message?: string } | string;
      code?: string;
    } = await response.json().catch(() => ({
      error: "Unknown error",
      code: "UPSTREAM_ERROR",
    }));
    const msg =
      typeof errorData.error === "object" && errorData.error?.message
        ? errorData.error.message
        : typeof errorData.error === "string"
          ? errorData.error
          : `HTTP ${response.status}`;
    throw Errors.internal(msg);
  }

  const result: {
    error?: { message?: string } | string;
    data?: { url?: string } | string;
    url?: string;
    result?: { url?: string; data?: { url?: string } };
  } = await response.json();

  if (result.error) {
    throw Errors.internal(
      typeof result.error === "object" && "message" in result.error
        ? String((result.error as { message?: string }).message)
        : String(result.error),
    );
  }

  const portalUrl =
    (typeof result.data === "object" && result.data?.url) ||
    result.url ||
    result.result?.url ||
    result.result?.data?.url ||
    (typeof result.data === "string" ? result.data : null) ||
    (typeof result === "string" ? result : null);

  if (!portalUrl) throw Errors.internal("No portal URL in response");

  return portalUrl;
}

export async function createSubscriptionCheckoutSession(
  stripe: Stripe,
  db: Firestore,
  usersService: UsersService,
  params: {
    uid: string;
    userId: string;
    email: string;
    priceId: string;
    tier?: string;
    billingCycle?: string;
    trialEnabled?: boolean;
    requestOrigin: string | null;
  },
): Promise<string> {
  const {
    uid,
    userId,
    email,
    priceId,
    tier,
    billingCycle,
    trialEnabled,
    requestOrigin,
  } = params;

  const origin = requestOrigin || "http://localhost:5173";
  const baseUrl = BASE_URL !== "[BASE_URL]" ? BASE_URL : origin;

  let allowTrial = false;
  if (trialEnabled) {
    const user = await usersService.getUserById(userId);
    const trialingSnapshot = await db
      .collection("customers")
      .doc(uid)
      .collection("subscriptions")
      .where("status", "==", "trialing")
      .get();
    allowTrial = !user.hasUsedFreeTrial && trialingSnapshot.empty;
  }

  const customerDoc = await db.collection("customers").doc(uid).get();
  let stripeCustomerId: string | undefined = customerDoc.data()?.stripeId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email,
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

  return session.url;
}
