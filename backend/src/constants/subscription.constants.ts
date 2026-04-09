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

/** Async version that reads from DB config with ENV/code fallback. */
export async function getSubscriptionTrialDays(): Promise<number> {
  try {
    const { systemConfigService } = await import("@/domain/singletons");
    return await systemConfigService.getNumber(
      "subscription",
      "trial_days",
      SUBSCRIPTION_TRIAL_DAYS,
    );
  } catch {
    return SUBSCRIPTION_TRIAL_DAYS;
  }
}

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
  maxReelsPerMonth: number; // -1 = unlimited
  maxGenerationsPerMonth: number; // -1 = unlimited (AI chat messages)
  maxAnalysesPerMonth: number; // -1 = unlimited (reel AI analyses)
  maxQueueItems: number; // -1 = unlimited
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

// Free tier limits for users without an active subscription
export const FREE_TIER_LIMITS = {
  maxGenerationsPerMonth: 10,
  maxAnalysesPerMonth: 5,
} as const;

const BASE_TIER_FEATURES: Record<SubscriptionTier, SubscriptionTierFeatures> = {
  [SUBSCRIPTION_TIERS.BASIC]: {
    maxReelsPerMonth: 100,
    maxGenerationsPerMonth: 100,
    maxAnalysesPerMonth: 50,
    maxQueueItems: 10,
    aiAnalysis: true,
    instagramPublishing: false,
    supportLevel: "email",
    apiAccess: false,
    customBranding: false,
  },
  [SUBSCRIPTION_TIERS.PRO]: {
    maxReelsPerMonth: -1,
    maxGenerationsPerMonth: 500,
    maxAnalysesPerMonth: 200,
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
    maxAnalysesPerMonth: -1,
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
  } catch {
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
