/**
 * Stripe Constants
 *
 * Type-safe configuration for Stripe products, prices, and tiers.
 * Contains product IDs, price IDs, amounts, and dashboard links.
 *
 * Last updated: 2026-03-12 (Creator $19/Pro $49/Agency $149 repricing)
 */

export interface StripePriceConfig {
  priceId: string;
  amount: number;
}

export interface StripeTierConfig {
  productId: string;
  productName: string;
  gamma_hyperlink: string;
  prices: {
    monthly: StripePriceConfig;
    annual: StripePriceConfig;
  };
}

export interface StripeMap {
  tiers: {
    basic: StripeTierConfig;
    pro: StripeTierConfig;
    enterprise: StripeTierConfig;
  };
}

export type StripeTier = "basic" | "pro" | "enterprise";
export type BillingCycle = "monthly" | "annual";

export const STRIPE_MAP: StripeMap = {
  tiers: {
    basic: {
      productId: "prod_TWTXj1UeJcW6vz",
      productName: "Creator",
      gamma_hyperlink:
        "https://dashboard.stripe.com/acct_1SZFe93qLZiOfTxs/test/products/prod_TWTXj1UeJcW6vz",
      prices: {
        monthly: { priceId: "price_1TAKwu3qLZiOfTxsYsXxDTz5", amount: 19 },
        annual: { priceId: "price_1TAKwu3qLZiOfTxsniuPBlXP", amount: 190 },
      },
    },
    pro: {
      productId: "prod_TWTYPXmd7zh3kP",
      productName: "Pro",
      gamma_hyperlink:
        "https://dashboard.stripe.com/acct_1SZFe93qLZiOfTxs/test/products/prod_TWTYPXmd7zh3kP",
      prices: {
        monthly: { priceId: "price_1TAKwv3qLZiOfTxshaqnb9bW", amount: 49 },
        annual: { priceId: "price_1TAKwv3qLZiOfTxsULOKNeKa", amount: 490 },
      },
    },
    enterprise: {
      productId: "prod_TWTYPkmPHd8GF4",
      productName: "Agency",
      gamma_hyperlink:
        "https://dashboard.stripe.com/acct_1SZFe93qLZiOfTxs/test/products/prod_TWTYPkmPHd8GF4",
      prices: {
        monthly: { priceId: "price_1TAKww3qLZiOfTxsR8Q6WemR", amount: 149 },
        annual: { priceId: "price_1TAKww3qLZiOfTxscEmKstBs", amount: 1490 },
      },
    },
  },
} as const;
