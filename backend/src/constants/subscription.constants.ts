/**
 * Subscription Tier Constants and Configuration
 *
 * Defines the three subscription tiers (Creator, Pro, Agency) with their
 * features and pricing. Tier keys stay as basic/pro/enterprise to match
 * Stripe Firebase custom claims (stripeRole).
 */

import {
  getStripePriceId,
  getStripePriceAmount,
} from "@/utils/stripe-map-loader";

export const SUBSCRIPTION_TIERS = {
  BASIC: "basic",
  PRO: "pro",
  ENTERPRISE: "enterprise",
} as const;

export const SUBSCRIPTION_TRIAL_DAYS = 14;

export type SubscriptionTier =
  (typeof SUBSCRIPTION_TIERS)[keyof typeof SUBSCRIPTION_TIERS];

export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | "incomplete"
  | "incomplete_expired";

export interface SubscriptionTierFeatures {
  maxReelsPerMonth: number;        // -1 = unlimited
  maxGenerationsPerMonth: number;  // -1 = unlimited (AI chat messages)
  maxQueueItems: number;           // -1 = unlimited
  aiAnalysis: boolean;
  instagramPublishing: boolean;
  supportLevel: "email" | "priority" | "dedicated";
  apiAccess: boolean;
  customBranding: boolean;
}

export interface SubscriptionTierConfig {
  name: string;
  price: number;
  billingCycle: "monthly" | "annual";
  features: SubscriptionTierFeatures;
  stripePriceId: string;
}

const BASE_TIER_FEATURES: Record<SubscriptionTier, SubscriptionTierFeatures> = {
  [SUBSCRIPTION_TIERS.BASIC]: {
    maxReelsPerMonth: 100,
    maxGenerationsPerMonth: 50,
    maxQueueItems: 10,
    aiAnalysis: true,
    instagramPublishing: false,
    supportLevel: "email",
    apiAccess: false,
    customBranding: false,
  },
  [SUBSCRIPTION_TIERS.PRO]: {
    maxReelsPerMonth: -1,
    maxGenerationsPerMonth: 300,
    maxQueueItems: 100,
    aiAnalysis: true,
    instagramPublishing: true,
    supportLevel: "priority",
    apiAccess: false,
    customBranding: false,
  },
  [SUBSCRIPTION_TIERS.ENTERPRISE]: {
    maxReelsPerMonth: -1,
    maxGenerationsPerMonth: -1,
    maxQueueItems: -1,
    aiAnalysis: true,
    instagramPublishing: true,
    supportLevel: "dedicated",
    apiAccess: true,
    customBranding: true,
  },
};

const TIER_NAMES: Record<SubscriptionTier, string> = {
  [SUBSCRIPTION_TIERS.BASIC]: "Creator",
  [SUBSCRIPTION_TIERS.PRO]: "Pro",
  [SUBSCRIPTION_TIERS.ENTERPRISE]: "Agency",
};

export interface SubscriptionTierConfigFull {
  name: string;
  price: number;
  billingCycle: "monthly" | "annual";
  features: SubscriptionTierFeatures;
  stripePriceId: string;
}

export function getTierConfig(
  tier: SubscriptionTier,
  billingCycle: "monthly" | "annual" = "monthly"
): SubscriptionTierConfigFull {
  return {
    name: TIER_NAMES[tier],
    price: getStripePriceAmount(tier, billingCycle),
    billingCycle,
    features: BASE_TIER_FEATURES[tier],
    stripePriceId: getStripePriceId(tier, billingCycle),
  };
}

export function isUsageLimitReached(
  usageCount: number,
  usageLimit: number | null
): boolean {
  if (usageLimit === null || usageLimit === -1) return false;
  return usageCount >= usageLimit;
}

export function getTierDescription(tier: SubscriptionTier): string {
  switch (tier) {
    case SUBSCRIPTION_TIERS.BASIC:
      return "Creator and higher";
    case SUBSCRIPTION_TIERS.PRO:
      return "Pro and Agency";
    case SUBSCRIPTION_TIERS.ENTERPRISE:
      return "Agency";
    default:
      return "";
  }
}

export {
  isSubscriptionTier,
  toSubscriptionTier,
} from "@/utils/type-guards/subscription-type-guards";
