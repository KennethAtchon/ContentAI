/**
 * Stripe Product Setup
 *
 * Creates or finds existing Stripe products and prices for all subscription
 * tiers, then writes the real IDs to backend/src/constants/stripe.constants.ts.
 *
 * Usage:
 *   bun stripe/setup-products.ts
 *
 * ─── Stripe constraints ────────────────────────────────────────────────────
 *  • Prices are IMMUTABLE: amount, currency, and interval cannot be changed.
 *    If you change an amount here, a new Stripe price will be created and the
 *    old one will be archived. Stripe does not allow deleting prices either.
 *  • Products CAN be updated (name, metadata). Archived products are reused.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * The Firebase Stripe Payments extension requires products to have:
 *   metadata.firebaseRole = "basic" | "pro" | "enterprise"
 */

import { loadEnv, requireEnv } from "../shared/env.ts";
import Stripe from "stripe";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

loadEnv();

const STRIPE_API_VERSION = "2025-02-24.acacia" as const;

// ─── Tier definitions ─────────────────────────────────────────────────────────
// Edit amounts here. Note: changing an amount requires a new Stripe price —
// the old one will be automatically archived (prices cannot be edited or deleted).

interface TierDef {
  key: "basic" | "pro" | "enterprise";
  productName: string;
  firebaseRole: string;
  monthly: { amountCents: number };
  annual: { amountCents: number };
}

const TIER_DEFS: TierDef[] = [
  {
    key: "basic",
    productName: "Tier 1",
    firebaseRole: "basic",
    monthly: { amountCents: 1000 },  // $10.00/mo
    annual:  { amountCents: 10000 }, // $100.00/yr
  },
  {
    key: "pro",
    productName: "Tier 2",
    firebaseRole: "pro",
    monthly: { amountCents: 2500 },  // $25.00/mo
    annual:  { amountCents: 20000 }, // $200.00/yr
  },
  {
    key: "enterprise",
    productName: "Tier 3",
    firebaseRole: "enterprise",
    monthly: { amountCents: 10000 },  // $100.00/mo
    annual:  { amountCents: 100000 }, // $1000.00/yr
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Paginate through all Stripe products (active or inactive) and return the first match. */
async function findProductByRole(
  stripe: Stripe,
  firebaseRole: string,
  active: boolean,
): Promise<Stripe.Product | undefined> {
  let startingAfter: string | undefined;
  while (true) {
    const page = await stripe.products.list({
      active,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    const match = page.data.find((p) => p.metadata?.firebaseRole === firebaseRole);
    if (match) return match;
    if (!page.has_more) return undefined;
    startingAfter = page.data[page.data.length - 1].id;
  }
}

/** Fetch all active and inactive prices for a product. */
async function fetchAllPrices(stripe: Stripe, productId: string): Promise<Stripe.Price[]> {
  const [active, inactive] = await Promise.all([
    stripe.prices.list({ product: productId, active: true,  limit: 100 }),
    stripe.prices.list({ product: productId, active: false, limit: 100 }),
  ]);
  return [...active.data, ...inactive.data];
}

// ─── Product setup ────────────────────────────────────────────────────────────

async function ensureProduct(stripe: Stripe, def: TierDef): Promise<Stripe.Product> {
  // 1. Reuse active product if it exists
  const activeMatch = await findProductByRole(stripe, def.firebaseRole, true);
  if (activeMatch) {
    console.log(`  [exists]     ${activeMatch.id}  "${activeMatch.name}"`);
    return activeMatch;
  }

  // 2. Unarchive if previously archived
  const archivedMatch = await findProductByRole(stripe, def.firebaseRole, false);
  if (archivedMatch) {
    const product = await stripe.products.update(archivedMatch.id, { active: true });
    console.log(`  [unarchived] ${product.id}  "${product.name}"`);
    return product;
  }

  // 3. Create new
  const product = await stripe.products.create({
    name: def.productName,
    metadata: { firebaseRole: def.firebaseRole, tier: def.key },
  });
  console.log(`  [created]    ${product.id}  "${product.name}"`);
  return product;
}

// ─── Price setup ──────────────────────────────────────────────────────────────
//
// Stripe prices are IMMUTABLE — amount, currency, and interval are fixed at
// creation and CANNOT be changed afterwards. Prices also CANNOT be deleted,
// only archived (set to inactive).
//
// This function handles three scenarios:
//   A. Price already exists with the same amount → reuse it (or reactivate if archived)
//   B. Price exists but with a different amount  → create new price, archive old
//   C. No price exists yet                       → create new price

async function ensurePrice(
  stripe: Stripe,
  productId: string,
  interval: "month" | "year",
  amountCents: number,
): Promise<Stripe.Price> {
  const allPrices = await fetchAllPrices(stripe, productId);
  const pricesForInterval = allPrices.filter((p) => p.recurring?.interval === interval);

  // Scenario A: exact match exists — reuse it
  const exactMatch = pricesForInterval.find((p) => p.unit_amount === amountCents);
  if (exactMatch) {
    if (exactMatch.active) {
      console.log(`    [exists]      ${exactMatch.id}  ${interval}ly  $${amountCents / 100}`);
      return exactMatch;
    }
    // Was archived — reactivate it
    const price = await stripe.prices.update(exactMatch.id, { active: true });
    await stripe.products.update(productId, { default_price: price.id });
    console.log(`    [reactivated] ${price.id}  ${interval}ly  $${amountCents / 100}`);
    return price;
  }

  // Scenario B or C: no exact match — must create a new price.
  // Stripe does not allow editing or deleting prices, so old ones get archived.
  const activePricesForInterval = pricesForInterval.filter((p) => p.active);
  if (activePricesForInterval.length > 0) {
    const oldAmounts = activePricesForInterval
      .map((p) => `$${(p.unit_amount ?? 0) / 100}`)
      .join(", ");
    console.log(`    [amount changed] ${interval}ly: ${oldAmounts} → $${amountCents / 100}`);
    console.log(`    Stripe prices are immutable and cannot be deleted — archiving old price(s).`);
  }

  const newPrice = await stripe.prices.create({
    product: productId,
    unit_amount: amountCents,
    currency: "usd",
    recurring: { interval },
  });
  await stripe.products.update(productId, { default_price: newPrice.id });
  console.log(`    [created]     ${newPrice.id}  ${interval}ly  $${amountCents / 100}`);

  for (const old of activePricesForInterval) {
    await stripe.prices.update(old.id, { active: false });
    console.log(`    [archived]    ${old.id}  (was $${(old.unit_amount ?? 0) / 100})`);
  }

  return newPrice;
}

// ─── Write stripe.constants.ts ────────────────────────────────────────────────

interface TierResult {
  key: string;
  productId: string;
  productName: string;
  dashboardLink: string;
  monthly: { priceId: string; amount: number };
  annual: { priceId: string; amount: number };
}

function buildStripeMapTs(results: TierResult[]): string {
  const [basic, pro, enterprise] = results;

  const tier = (r: TierResult) =>
    `\
    ${r.key}: {
      productId: "${r.productId}",
      productName: "${r.productName}",
      gamma_hyperlink: "${r.dashboardLink}",
      prices: {
        monthly: { priceId: "${r.monthly.priceId}", amount: ${r.monthly.amount} },
        annual:  { priceId: "${r.annual.priceId}",  amount: ${r.annual.amount} },
      },
    },`;

  return `export const STRIPE_MAP: StripeMap = {
  tiers: {
${tier(basic)}
${tier(pro)}
${tier(enterprise)}
  },
} as const;
`;
}

function writeStripeConstants(results: TierResult[], isTestMode: boolean): void {
  const filePath = resolve(
    import.meta.dir,
    "../../backend/src/constants/stripe.constants.ts",
  );

  const content = readFileSync(filePath, "utf-8");
  const marker = "export const STRIPE_MAP";
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Could not find "${marker}" in ${filePath}`);
  }

  writeFileSync(filePath, content.slice(0, markerIndex) + buildStripeMapTs(results), "utf-8");
  console.log(`\nUpdated: backend/src/constants/stripe.constants.ts`);
  if (isTestMode) console.log("Note: these are TEST mode IDs (sk_test_...)");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const stripeKey = requireEnv("STRIPE_SECRET_KEY");
  const isTestMode = stripeKey.startsWith("sk_test_");
  const dashboardBase = isTestMode
    ? "https://dashboard.stripe.com/test/products"
    : "https://dashboard.stripe.com/products";

  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });
  console.log(`Mode: ${isTestMode ? "TEST" : "LIVE"}\nSetting up Stripe products...\n`);

  const results: TierResult[] = [];

  for (const def of TIER_DEFS) {
    console.log(`\n[${def.key}]`);
    const product = await ensureProduct(stripe, def);
    const [monthlyPrice, annualPrice] = await Promise.all([
      ensurePrice(stripe, product.id, "month", def.monthly.amountCents),
      ensurePrice(stripe, product.id, "year",  def.annual.amountCents),
    ]);

    results.push({
      key: def.key,
      productId: product.id,
      productName: def.productName,
      dashboardLink: `${dashboardBase}/${product.id}`,
      monthly: { priceId: monthlyPrice.id, amount: def.monthly.amountCents / 100 },
      annual:  { priceId: annualPrice.id,  amount: def.annual.amountCents / 100 },
    });
  }

  writeStripeConstants(results, isTestMode);
  console.log("\nDone! Run `bun lint` in backend/ to verify the file.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
