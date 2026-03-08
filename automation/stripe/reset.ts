/**
 * Stripe Full Reset
 *
 * Deletes all Stripe customers (which removes their subscriptions, invoices,
 * and payment methods), then archives all products and prices.
 * Leaves the account completely clean for a fresh setup.
 *
 * NOTE: Stripe doesn't allow deleting subscription records directly.
 * Deleting the customer is the equivalent of a full wipe.
 *
 * Run stripe/setup-products.ts afterwards to recreate products/prices.
 *
 * Usage:
 *   bun stripe/reset.ts            # interactive confirmation
 *   bun stripe/reset.ts --dry-run  # preview without changes
 *   bun stripe/reset.ts --confirm  # skip confirmation prompt
 *
 * NOTE: Only runs against TEST Stripe accounts (sk_test_...).
 */

import { loadEnv, requireEnv, promptConfirm, DRY_RUN } from "../shared/env.ts";
import Stripe from "stripe";

loadEnv();

const STRIPE_API_VERSION = "2025-02-24.acacia" as const;

async function listAll<T>(
  fn: (params: { limit: number; starting_after?: string }) => Promise<
    Stripe.ApiList<T> & { data: T[]; has_more: boolean }
  >,
): Promise<T[]> {
  const all: T[] = [];
  let startingAfter: string | undefined;

  while (true) {
    const page = await fn({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    all.push(...page.data);
    if (!page.has_more) break;
    startingAfter = (page.data[page.data.length - 1] as any).id;
  }

  return all;
}

async function deleteAllCustomers(stripe: Stripe): Promise<void> {
  console.log("\n--- Deleting customers ---");
  // Deleting a customer removes their subscriptions, invoices, and payment
  // methods — Stripe has no direct subscription delete API.
  const customers = await listAll((p) =>
    stripe.customers.list(p),
  ) as Stripe.Customer[];

  if (customers.length === 0) {
    console.log("No customers.");
    return;
  }

  for (const customer of customers) {
    if (DRY_RUN) {
      console.log(
        `  [dry-run] Would delete customer ${customer.id} ${customer.email || ""}`,
      );
    } else {
      try {
        await stripe.customers.del(customer.id);
        console.log(`  Deleted customer ${customer.id} ${customer.email || ""}`);
      } catch (err: any) {
        console.error(`  Error deleting customer ${customer.id}: ${err.message}`);
      }
    }
  }
}

async function archiveAllPrices(stripe: Stripe): Promise<void> {
  console.log("\n--- Archiving prices ---");
  const prices = await listAll((p) =>
    stripe.prices.list({ active: true, ...p }),
  );

  if (prices.length === 0) {
    console.log("No active prices.");
    return;
  }

  for (const price of prices) {
    if (DRY_RUN) {
      console.log(`  [dry-run] Would archive price ${price.id}`);
    } else {
      try {
        await stripe.prices.update(price.id, { active: false });
        console.log(`  Archived price ${price.id}`);
      } catch (err: any) {
        console.error(`  Error archiving price ${price.id}: ${err.message}`);
      }
    }
  }
}

async function archiveAllProducts(stripe: Stripe): Promise<void> {
  console.log("\n--- Archiving products ---");
  const products = await listAll((p) =>
    stripe.products.list({ active: true, ...p }),
  );

  if (products.length === 0) {
    console.log("No active products.");
    return;
  }

  for (const product of products) {
    if (DRY_RUN) {
      console.log(`  [dry-run] Would archive product ${product.id} "${product.name}"`);
    } else {
      try {
        await stripe.products.update(product.id, { active: false });
        console.log(`  Archived product ${product.id} "${product.name}"`);
      } catch (err: any) {
        console.error(
          `  Error archiving product ${product.id}: ${err.message}`,
        );
      }
    }
  }
}

async function main(): Promise<void> {
  const stripeKey = requireEnv("STRIPE_SECRET_KEY");
  const isTestMode = stripeKey.startsWith("sk_test_");

  if (!isTestMode) {
    console.error(
      "\nERROR: This script detected a LIVE Stripe key.\n" +
        "Refusing to run against a live account. Use a test key (sk_test_...).\n",
    );
    process.exit(1);
  }

  if (DRY_RUN) console.log("DRY RUN — no changes will be made\n");

  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });

  if (!DRY_RUN) {
    const confirmed = await promptConfirm(
      "WARNING: This will DELETE all customers (and their subscriptions/invoices) and archive all products/prices.\n" +
        "Run `bun stripe/setup-products.ts` afterwards to recreate products.",
    );
    if (!confirmed) {
      console.log("Aborted.");
      return;
    }
  }

  await deleteAllCustomers(stripe);
  await archiveAllPrices(stripe);
  await archiveAllProducts(stripe);

  console.log(
    "\nReset complete." +
      (DRY_RUN
        ? " (dry-run — nothing was changed)"
        : "\nRun: bun stripe/setup-products.ts  to recreate products and prices."),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
