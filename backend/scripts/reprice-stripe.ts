/**
 * Stripe Repricing Migration Script
 *
 * - Renames products: Tier 1/2/3 → Creator/Pro/Agency
 * - Creates new prices: $19/$49/$149 monthly, $190/$490/$1490 annual (2 months free)
 * - Archives old prices
 * - Outputs new price IDs to paste into stripe.constants.ts
 *
 * Run: bun run scripts/reprice-stripe.ts
 */

import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY not set");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-04-30.basil",
});

const PRODUCTS = {
  basic: {
    id: "prod_TWTXj1UeJcW6vz",
    name: "Creator",
    description: "For individual creators getting started with AI content.",
  },
  pro: {
    id: "prod_TWTYPXmd7zh3kP",
    name: "Pro",
    description: "For creators who want full AI generation and publishing.",
  },
  enterprise: {
    id: "prod_TWTYPkmPHd8GF4",
    name: "Agency",
    description: "For agencies and power users who need unlimited scale.",
  },
} as const;

const OLD_PRICES = {
  basic: {
    monthly: "price_1SZQa63qLZiOfTxsQZkBift7",
    annual: "price_1SZQak3qLZiOfTxsM7kwhZwQ",
  },
  pro: {
    monthly: "price_1SZQaz3qLZiOfTxs8Kg7ZsN8",
    annual: "price_1SZQbE3qLZiOfTxsx4kE2xqk",
  },
  enterprise: {
    monthly: "price_1SZQbQ3qLZiOfTxsIye7eUZm",
    annual: "price_1SZQbe3qLZiOfTxs7xApSWQY",
  },
} as const;

// Amounts in cents. Annual = 10 × monthly (2 months free).
const NEW_AMOUNTS = {
  basic: { monthly: 1900, annual: 19000 }, // $19/mo, $190/yr
  pro: { monthly: 4900, annual: 49000 }, // $49/mo, $490/yr
  enterprise: { monthly: 14900, annual: 149000 }, // $149/mo, $1,490/yr
} as const;

type TierKey = keyof typeof PRODUCTS;

async function run() {
  console.log("🚀 Starting Stripe repricing migration (test mode)\n");

  const newPriceIds: Record<TierKey, { monthly: string; annual: string }> =
    {} as any;

  for (const [tierKey, product] of Object.entries(PRODUCTS) as [
    TierKey,
    (typeof PRODUCTS)[TierKey],
  ][]) {
    console.log(`\n── ${product.name} (${tierKey}) ──────────────────────`);

    // 1. Update product name and description
    console.log(`  Updating product name → "${product.name}"...`);
    await stripe.products.update(product.id, {
      name: product.name,
      description: product.description,
    });
    console.log(`  ✓ Product updated`);

    // 2. Create new monthly price
    console.log(
      `  Creating monthly price $${NEW_AMOUNTS[tierKey].monthly / 100}...`,
    );
    const monthly = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: NEW_AMOUNTS[tierKey].monthly,
      recurring: { interval: "month" },
      nickname: `${product.name} Monthly`,
      metadata: { tier: tierKey, billingCycle: "monthly" },
    });
    console.log(`  ✓ Monthly price created: ${monthly.id}`);

    // 3. Create new annual price
    console.log(
      `  Creating annual price $${NEW_AMOUNTS[tierKey].annual / 100}...`,
    );
    const annual = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: NEW_AMOUNTS[tierKey].annual,
      recurring: { interval: "year" },
      nickname: `${product.name} Annual`,
      metadata: { tier: tierKey, billingCycle: "annual" },
    });
    console.log(`  ✓ Annual price created: ${annual.id}`);

    newPriceIds[tierKey] = { monthly: monthly.id, annual: annual.id };

    // 4. Set new monthly price as product default (required before archiving old default)
    console.log(`  Setting new monthly price as product default...`);
    await stripe.products.update(product.id, { default_price: monthly.id });
    console.log(`  ✓ Default price updated`);

    // 5. Archive old prices
    console.log(
      `  Archiving old monthly price ${OLD_PRICES[tierKey].monthly}...`,
    );
    await stripe.prices.update(OLD_PRICES[tierKey].monthly, { active: false });
    console.log(`  ✓ Old monthly price archived`);

    console.log(
      `  Archiving old annual price ${OLD_PRICES[tierKey].annual}...`,
    );
    await stripe.prices.update(OLD_PRICES[tierKey].annual, { active: false });
    console.log(`  ✓ Old annual price archived`);
  }

  console.log("\n\n✅ Migration complete!\n");
  console.log("══════════════════════════════════════════════════");
  console.log("New price IDs — paste into stripe.constants.ts:");
  console.log("══════════════════════════════════════════════════\n");

  for (const [tierKey, ids] of Object.entries(newPriceIds) as [
    TierKey,
    { monthly: string; annual: string },
  ][]) {
    const product = PRODUCTS[tierKey];
    const amounts = NEW_AMOUNTS[tierKey];
    console.log(`${product.name} (${tierKey}):`);
    console.log(
      `  monthly: { priceId: "${ids.monthly}", amount: ${amounts.monthly / 100} }`,
    );
    console.log(
      `  annual:  { priceId: "${ids.annual}",  amount: ${amounts.annual / 100} }`,
    );
    console.log();
  }

  console.log("══════════════════════════════════════════════════");
  console.log("\nJSON (for direct copy):\n");
  console.log(JSON.stringify(newPriceIds, null, 2));
}

run().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
