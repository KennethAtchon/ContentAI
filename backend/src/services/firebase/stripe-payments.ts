/**
 * Firebase Stripe Extension Helpers
 *
 * Utilities for reading payment and subscription data managed by the
 * Firebase Stripe Payments extension (firestore-stripe-payments).
 *
 * The extension stores all Stripe data under:
 *   customers/{uid}/subscriptions/{subId}
 *   customers/{uid}/payments/{paymentId}
 *   customers/{uid}/checkout_sessions/{sessionId}
 *
 * This module provides typed helpers so route handlers don't query
 * Firestore directly with raw string paths.
 */

import { adminDb } from "./admin";
import {
  extractSubscriptionTier,
  convertFirestoreTimestamp,
} from "./subscription-helpers";
import type { SubscriptionTier } from "@/constants/subscription.constants";

export interface FirestoreSubscription {
  id: string;
  uid: string;
  status: string;
  tier: SubscriptionTier | string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  isInTrial: boolean;
  billingCycle: "monthly" | "annual" | null;
}

/**
 * Fetches the active subscription for a Firebase user.
 * Returns null if no active or trialing subscription exists.
 */
export async function getActiveSubscription(
  uid: string,
): Promise<FirestoreSubscription | null> {
  const snapshot = await adminDb
    .collection("customers")
    .doc(uid)
    .collection("subscriptions")
    .where("status", "in", ["active", "trialing"])
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const data = doc.data();

  return normalizeSubscription(doc.id, uid, data);
}

/**
 * Fetches all subscriptions (any status) for a Firebase user.
 */
export async function getAllSubscriptions(
  uid: string,
): Promise<FirestoreSubscription[]> {
  const snapshot = await adminDb
    .collection("customers")
    .doc(uid)
    .collection("subscriptions")
    .get();

  return snapshot.docs.map((doc) =>
    normalizeSubscription(doc.id, uid, doc.data()),
  );
}

/**
 * Checks whether a user is currently in a trial period.
 */
export async function isUserInTrial(uid: string): Promise<boolean> {
  const snapshot = await adminDb
    .collection("customers")
    .doc(uid)
    .collection("subscriptions")
    .where("status", "==", "trialing")
    .limit(1)
    .get();

  return !snapshot.empty;
}

/**
 * Gets the Stripe customer ID for a Firebase user from Firestore.
 * Returns null if not found (user has never checked out).
 */
export async function getStripeCustomerId(uid: string): Promise<string | null> {
  const doc = await adminDb.collection("customers").doc(uid).get();
  return doc.data()?.stripeId ?? null;
}

function normalizeSubscription(
  id: string,
  uid: string,
  data: Record<string, any>,
): FirestoreSubscription {
  let billingCycle: "monthly" | "annual" | null = null;
  if (data.metadata?.billingCycle) {
    billingCycle = data.metadata.billingCycle as "monthly" | "annual";
  } else if (data.items?.data?.[0]?.price?.interval) {
    billingCycle =
      data.items.data[0].price.interval === "month" ? "monthly" : "annual";
  }

  return {
    id,
    uid,
    status: data.status ?? "incomplete",
    tier: extractSubscriptionTier(data),
    stripeCustomerId: data.customer ?? null,
    stripeSubscriptionId: data.id ?? null,
    stripePriceId: data.items?.data?.[0]?.price?.id ?? null,
    currentPeriodStart: convertFirestoreTimestamp(data.current_period_start),
    currentPeriodEnd: convertFirestoreTimestamp(data.current_period_end),
    cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
    canceledAt: convertFirestoreTimestamp(data.canceled_at),
    trialStart: convertFirestoreTimestamp(data.trial_start),
    trialEnd: convertFirestoreTimestamp(data.trial_end),
    isInTrial: data.status === "trialing",
    billingCycle,
  };
}
