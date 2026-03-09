/**
 * Subscription Tier Constants and Configuration
 *
 * Defines the three subscription tiers (Basic, Pro, Enterprise) with their
 * features, pricing, and Stripe price IDs.
 */

import {
  getStripePriceId,
  getStripePriceAmount,
} from "@/shared/utils/stripe-map-loader";

export const SUBSCRIPTION_TIERS = {
  BASIC: "basic",
  PRO: "pro",
  ENTERPRISE: "enterprise",
} as const;

/**
 * Default trial period in days for new subscriptions
 */
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
  maxReelsPerMonth: number; // -1 means unlimited
  maxGenerationsPerMonth: number; // -1 means unlimited
  maxQueueItems: number; // -1 means unlimited
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
    maxReelsPerMonth: 50,
    maxGenerationsPerMonth: 20,
    maxQueueItems: 5,
    aiAnalysis: true,
    instagramPublishing: false,
    supportLevel: "email",
    apiAccess: false,
    customBranding: false,
  },
  [SUBSCRIPTION_TIERS.PRO]: {
    maxReelsPerMonth: 500,
    maxGenerationsPerMonth: 200,
    maxQueueItems: 50,
    aiAnalysis: true,
    instagramPublishing: true,
    supportLevel: "priority",
    apiAccess: true,
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

// Tier names
const TIER_NAMES: Record<SubscriptionTier, string> = {
  [SUBSCRIPTION_TIERS.BASIC]: "Basic",
  [SUBSCRIPTION_TIERS.PRO]: "Pro",
  [SUBSCRIPTION_TIERS.ENTERPRISE]: "Enterprise",
};

/**
 * Get subscription tier configuration for a specific billing cycle
 */
export function getTierConfig(
  tier: SubscriptionTier,
  billingCycle: "monthly" | "annual" = "monthly"
): SubscriptionTierConfig {
  return {
    name: TIER_NAMES[tier],
    price: getStripePriceAmount(tier, billingCycle),
    billingCycle,
    features: BASE_TIER_FEATURES[tier],
    stripePriceId: getStripePriceId(tier, billingCycle),
  };
}

/**
 * Check if usage limit is reached
 */
export function isUsageLimitReached(
  usageCount: number,
  usageLimit: number | null
): boolean {
  if (usageLimit === null || usageLimit === -1) {
    return false; // Unlimited
  }
  return usageCount >= usageLimit;
}

/**
 * Get human-readable tier description for feature gating
 * Returns description like "Basic and higher", "Pro and Enterprise", etc.
 */
export function getTierDescription(tier: SubscriptionTier): string {
  switch (tier) {
    case SUBSCRIPTION_TIERS.BASIC:
      return "Basic and higher";
    case SUBSCRIPTION_TIERS.PRO:
      return "Pro and Enterprise";
    case SUBSCRIPTION_TIERS.ENTERPRISE:
      return "Enterprise";
    default:
      return "";
  }
}

/**
 * Type guard to check if a value is a valid SubscriptionTier
 * Re-exported from type-guards for convenience
 */
export {
  isSubscriptionTier,
  toSubscriptionTier,
} from "@/shared/utils/type-guards/subscription-type-guards";
