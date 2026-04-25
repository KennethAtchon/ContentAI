/**
 * Stripe Map Loader
 *
 * Utility to load and access Stripe product and price mappings from stripe.constants.ts
 */

import {
  STRIPE_MAP,
  type StripeMap,
  type StripePriceConfig,
  type StripeTierConfig,
  type StripeTier,
  type BillingCycle,
} from "@/shared/constants/stripe.constants";

// Re-export types for backward compatibility
export type {
  StripePriceConfig,
  StripeTierConfig,
  StripeMap,
  StripeTier,
  BillingCycle,
};

/**
 * Get the Stripe map data
 */
export function getStripeMap(): StripeMap {
  return STRIPE_MAP;
}

/**
 * Get Stripe configuration for a specific tier
 */
export function getStripeTierConfig(tier: StripeTier): StripeTierConfig {
  const map = getStripeMap();
  return map.tiers[tier];
}

/**
 * Get price ID for a tier and billing cycle
 */
export function getStripePriceId(
  tier: StripeTier,
  billingCycle: BillingCycle
): string {
  const tierConfig = getStripeTierConfig(tier);
  return tierConfig.prices[billingCycle].priceId;
}

/**
 * Get price amount for a tier and billing cycle
 */
export function getStripePriceAmount(
  tier: StripeTier,
  billingCycle: BillingCycle
): number {
  const tierConfig = getStripeTierConfig(tier);
  return tierConfig.prices[billingCycle].amount;
}
