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
  type SubscriptionTierFeatures,
} from "@contentai/contracts/subscription";
import {
  getStripePriceId,
  getStripePriceAmount,
} from "@/utils/stripe-map-loader";
import { systemLogger } from "@/utils/system/system-logger";
export { FREE_TIER_LIMITS, SUBSCRIPTION_TIERS, SUBSCRIPTION_TRIAL_DAYS };
export type {
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionTierFeatures,
};

/** Async version that reads from DB config with ENV/code fallback. */
export async function getSubscriptionTrialDays(): Promise<number> {
  try {
    const { systemConfigService } = await import("@/domain/singletons");
    return await systemConfigService.getNumber(
      "subscription",
      "trial_days",
      SUBSCRIPTION_TRIAL_DAYS,
    );
  } catch (error) {
    systemLogger.warn(
      "Failed to load trial_days from DB; using static fallback",
      {
        service: "subscription-constants",
        operation: "getSubscriptionTrialDays",
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return SUBSCRIPTION_TRIAL_DAYS;
  }
}

export interface SubscriptionTierConfig {
  name: string;
  price: number;
  billingCycle: "monthly" | "annual";
  features: SubscriptionTierFeatures;
  stripePriceId: string;
}

export interface SubscriptionTierConfigFull {
  name: string;
  price: number;
  billingCycle: "monthly" | "annual";
  features: SubscriptionTierFeatures;
  stripePriceId: string;
}

export function getTierConfig(
  tier: SubscriptionTier,
  billingCycle: "monthly" | "annual" = "monthly",
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
  usageLimit: number | null,
): boolean {
  if (usageLimit === null || usageLimit === -1) return false;
  return usageCount >= usageLimit;
}

/** Returns monthly generation and analysis limits for a given Stripe role (or free tier). */
export function getFeatureLimitsForStripeRole(stripeRole?: string): {
  generation: number;
  analysis: number;
} {
  const tier = stripeRole as SubscriptionTier | undefined;
  if (tier && tier in BASE_TIER_FEATURES) {
    const f = BASE_TIER_FEATURES[tier];
    return {
      generation: f.maxGenerationsPerMonth,
      analysis: f.maxAnalysesPerMonth,
    };
  }
  return {
    generation: FREE_TIER_LIMITS.maxGenerationsPerMonth,
    analysis: FREE_TIER_LIMITS.maxAnalysesPerMonth,
  };
}

/**
 * Async version that reads limits from DB config.
 * Falls back to static hardcoded values if DB is unavailable.
 */
export async function getFeatureLimitsForStripeRoleAsync(
  stripeRole?: string,
): Promise<{
  generation: number;
  analysis: number;
}> {
  try {
    const { systemConfigService } = await import("@/domain/singletons");
    const tier = stripeRole as SubscriptionTier | undefined;

    if (tier === SUBSCRIPTION_TIERS.ENTERPRISE) {
      return { generation: -1, analysis: -1 };
    }
    if (tier === SUBSCRIPTION_TIERS.PRO) {
      return {
        generation: await systemConfigService.getNumber(
          "subscription",
          "pro_generations_per_month",
          500,
        ),
        analysis: await systemConfigService.getNumber(
          "subscription",
          "pro_analyses_per_month",
          200,
        ),
      };
    }
    if (tier === SUBSCRIPTION_TIERS.BASIC) {
      return {
        generation: await systemConfigService.getNumber(
          "subscription",
          "basic_generations_per_month",
          100,
        ),
        analysis: await systemConfigService.getNumber(
          "subscription",
          "basic_analyses_per_month",
          50,
        ),
      };
    }
    // Free tier
    return {
      generation: await systemConfigService.getNumber(
        "subscription",
        "free_generations_per_month",
        FREE_TIER_LIMITS.maxGenerationsPerMonth,
      ),
      analysis: await systemConfigService.getNumber(
        "subscription",
        "free_analyses_per_month",
        FREE_TIER_LIMITS.maxAnalysesPerMonth,
      ),
    };
  } catch (error) {
    systemLogger.warn(
      "Failed to load feature limits from DB; using static fallback",
      {
        service: "subscription-constants",
        operation: "getFeatureLimitsForStripeRoleAsync",
        stripeRole: stripeRole ?? "free",
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return getFeatureLimitsForStripeRole(stripeRole);
  }
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
