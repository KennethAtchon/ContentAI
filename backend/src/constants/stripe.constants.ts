/**
 * Stripe Constants
 *
 * Type-safe configuration for Stripe products, prices, and tiers.
 * Contains product IDs, price IDs, amounts, and dashboard links.
 */

/**
 * Stripe price configuration for a billing cycle
 */
export interface StripePriceConfig {
  priceId: string;
  amount: number;
}

/**
 * Stripe tier configuration with product and pricing information
 */
export interface StripeTierConfig {
  productId: string;
  productName: string;
  gamma_hyperlink: string;
  prices: {
    monthly: StripePriceConfig;
    annual: StripePriceConfig;
  };
}

/**
 * Complete Stripe map structure with all tiers
 */
export interface StripeMap {
  tiers: {
    basic: StripeTierConfig;
    pro: StripeTierConfig;
    enterprise: StripeTierConfig;
  };
}

/**
 * Subscription tier type
 */
export type StripeTier = "basic" | "pro" | "enterprise";

/**
 * Billing cycle type
 */
export type BillingCycle = "monthly" | "annual";

/**
 * Stripe product and price mappings
 */
export const STRIPE_MAP: StripeMap = {
  tiers: {
    basic: {
      productId: "prod_TWTXj1UeJcW6vz",
      productName: "Tier 1",
      gamma_hyperlink:
        "https://dashboard.stripe.com/test/products/prod_TWTXj1UeJcW6vz",
      prices: {
        monthly: { priceId: "price_1SZQa63qLZiOfTxsQZkBift7", amount: 10 },
        annual: { priceId: "price_1SZQak3qLZiOfTxsM7kwhZwQ", amount: 100 },
      },
    },
    pro: {
      productId: "prod_TWTYPXmd7zh3kP",
      productName: "Tier 2",
      gamma_hyperlink:
        "https://dashboard.stripe.com/test/products/prod_TWTYPXmd7zh3kP",
      prices: {
        monthly: { priceId: "price_1SZQaz3qLZiOfTxs8Kg7ZsN8", amount: 25 },
        annual: { priceId: "price_1SZQbE3qLZiOfTxsx4kE2xqk", amount: 200 },
      },
    },
    enterprise: {
      productId: "prod_TWTYPkmPHd8GF4",
      productName: "Tier 3",
      gamma_hyperlink:
        "https://dashboard.stripe.com/test/products/prod_TWTYPkmPHd8GF4",
      prices: {
        monthly: { priceId: "price_1SZQbQ3qLZiOfTxsIye7eUZm", amount: 100 },
        annual: { priceId: "price_1SZQbe3qLZiOfTxs7xApSWQY", amount: 1000 },
      },
    },
  },
} as const;
