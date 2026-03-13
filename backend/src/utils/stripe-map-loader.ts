import {
  STRIPE_MAP,
  type StripeMap,
  type StripePriceConfig,
  type StripeTierConfig,
  type StripeTier,
  type BillingCycle,
} from "@/constants/stripe.constants";

export type { StripePriceConfig, StripeTierConfig, StripeMap, StripeTier, BillingCycle };

export function getStripeMap(): StripeMap {
  return STRIPE_MAP;
}

export function getStripeTierConfig(tier: StripeTier): StripeTierConfig {
  return STRIPE_MAP.tiers[tier];
}

export function getStripePriceId(tier: StripeTier, billingCycle: BillingCycle): string {
  return STRIPE_MAP.tiers[tier].prices[billingCycle].priceId;
}

export function getStripePriceAmount(tier: StripeTier, billingCycle: BillingCycle): number {
  return STRIPE_MAP.tiers[tier].prices[billingCycle].amount;
}
