/**
 * Subscription Tier Constants and Configuration
 *
 * Defines the three subscription tiers (Creator, Pro, Agency) with their
 * features and pricing. Tier keys stay as basic/pro/enterprise to match
 * Stripe Firebase custom claims (stripeRole).
 */

import {
  BASE_TIER_FEATURES,
  FREE_TIER_LIMITS,
  SUBSCRIPTION_TIERS,
  SUBSCRIPTION_TRIAL_DAYS,
  TIER_NAMES,
  type SubscriptionStatus,
  type SubscriptionTier,
  type SubscriptionTierConfig,
  type SubscriptionTierFeatures,
} from "@contentai/contracts/subscription";
import {
  getStripePriceId,
  getStripePriceAmount,
} from "@/shared/payments/stripe-map-loader";
export { FREE_TIER_LIMITS, SUBSCRIPTION_TIERS, SUBSCRIPTION_TRIAL_DAYS };
export type {
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionTierConfig,
  SubscriptionTierFeatures,
};

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
} from "@/shared/type-guards/subscription-type-guards";
