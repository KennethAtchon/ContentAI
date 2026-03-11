/**
 * Subscription Tier Constants and Configuration
 *
 * Defines the three subscription tiers (Basic, Pro, Enterprise) with their
 * features, pricing, and Stripe price IDs.
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
  maxCalculationsPerMonth: number; // -1 means unlimited
  calculationTypes: string[];
  exportFormats: string[];
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

// Base tier configurations with features (pricing comes from stripe.constants.ts)
// Only includes gated studio features
// See FEATURE_TIER_REQUIREMENTS in core-feature-permissions.ts for complete mapping
const BASE_TIER_FEATURES: Record<SubscriptionTier, SubscriptionTierFeatures> = {
  [SUBSCRIPTION_TIERS.BASIC]: {
    maxCalculationsPerMonth: 50,
    calculationTypes: ["loan"],
    exportFormats: ["pdf"],
    supportLevel: "email",
    apiAccess: false,
    customBranding: false,
  },
  [SUBSCRIPTION_TIERS.PRO]: {
    maxCalculationsPerMonth: 500,
    calculationTypes: ["loan", "investment"],
    exportFormats: ["pdf", "excel", "csv"],
    supportLevel: "priority",
    apiAccess: true,
    customBranding: false,
  },
  [SUBSCRIPTION_TIERS.ENTERPRISE]: {
    maxCalculationsPerMonth: -1, // unlimited
    calculationTypes: ["loan", "investment", "retirement", "custom"],
    exportFormats: ["pdf", "excel", "csv", "api"],
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
  billingCycle: "monthly" | "annual" = "monthly",
): SubscriptionTierConfig {
  return {
    name: TIER_NAMES[tier],
    price: getStripePriceAmount(tier),
    billingCycle,
    features: BASE_TIER_FEATURES[tier],
    stripePriceId: getStripePriceId(tier),
  };
}

/**
 * Check if a tier has access to a specific export format
 */
export function tierHasExportFormat(
  tier: SubscriptionTier,
  format: string,
): boolean {
  const config = getTierConfig(tier);
  return config.features.exportFormats.includes(format);
}

/**
 * Check if usage limit is reached
 */
export function isUsageLimitReached(
  usageCount: number,
  usageLimit: number | null,
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
} from "@/utils/type-guards/subscription-type-guards";
