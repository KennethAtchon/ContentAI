/**
 * Cancel Stripe Subscriptions
 *
 * Cancels all active, trialing, or past-due subscriptions in the current
 * Stripe account. Useful for resetting test data between dev sessions.
 *
 * NOTE: Stripe does not allow deleting subscription records — canceled
 * subscriptions remain in history. Use --delete-customers to delete the
 * Stripe customer objects themselves, which removes subscriptions,
 * payment methods, and invoices from the account entirely.
 *
 * Usage:
 *   bun stripe/cancel-subscriptions.ts                    # cancel at period end
 *   bun stripe/cancel-subscriptions.ts --immediate        # cancel right now
 *   bun stripe/cancel-subscriptions.ts --delete-customers # delete customers too (full wipe)
 *   bun stripe/cancel-subscriptions.ts --dry-run          # preview without changes
 *   bun stripe/cancel-subscriptions.ts --confirm          # skip confirmation prompt
 *
 * NOTE: Only run this against your TEST Stripe account. The script will
 * warn you if it detects a live key.
 */

import { loadEnv, requireEnv, promptConfirm, DRY_RUN } from "../shared/env.ts";
import Stripe from "stripe";

loadEnv();

const STRIPE_API_VERSION = "2025-02-24.acacia" as const;
const IMMEDIATE = process.argv.includes("--immediate");
const DELETE_CUSTOMERS = process.argv.includes("--delete-customers");

async function listAllCustomers(stripe: Stripe): Promise<Stripe.Customer[]> {
  const all: Stripe.Customer[] = [];
  let startingAfter: string | undefined;

  while (true) {
    const page = await stripe.customers.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    all.push(...(page.data as Stripe.Customer[]));
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return all;
}

async function listAllSubscriptions(stripe: Stripe): Promise<Stripe.Subscription[]> {
  const all: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;

  while (true) {
    const page = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    all.push(...page.data);
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return all;
}

async function main(): Promise<void> {
  const stripeKey = requireEnv("STRIPE_SECRET_KEY");
  const isTestMode = stripeKey.startsWith("sk_test_");

  if (!isTestMode) {
    console.error(
      "\nERROR: This script detected a LIVE Stripe key (sk_live_...).\n" +
        "Refusing to run against a live account. Use a test key (sk_test_...).\n",
    );
    process.exit(1);
  }

  if (DRY_RUN) console.log("DRY RUN — no changes will be made\n");

  const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });

  console.log("Fetching all subscriptions...");
  const all = await listAllSubscriptions(stripe);

  const cancellable = all.filter((s) =>
    ["active", "trialing", "past_due"].includes(s.status),
  );

  if (DELETE_CUSTOMERS) {
    // Deleting a customer removes their subscriptions, invoices, and payment
    // methods from Stripe entirely — the cleanest possible test reset.
    const customers = await listAllCustomers(stripe);

    if (customers.length === 0) {
      console.log("No customers found. Nothing to do.");
      return;
    }

    console.log(`\nFound ${customers.length} customer(s) to delete:\n`);
    for (const c of customers) {
      console.log(`  ${c.id}  ${c.email || "(no email)"}`);
    }

    if (!DRY_RUN) {
      const confirmed = await promptConfirm(
        `Permanently delete ${customers.length} Stripe customer(s) and all their data?`,
      );
      if (!confirmed) {
        console.log("Aborted.");
        return;
      }
    }

    let successCount = 0;
    let errorCount = 0;

    for (const customer of customers) {
      const prefix = DRY_RUN ? "[dry-run] " : "";
      try {
        if (!DRY_RUN) await stripe.customers.del(customer.id);
        console.log(
          `${prefix}Deleted customer ${customer.id} ${customer.email || ""}`,
        );
        successCount++;
      } catch (err: any) {
        console.error(`${prefix}Failed ${customer.id}: ${err.message}`);
        errorCount++;
      }
    }

    console.log(
      `\n${DRY_RUN ? "Would have deleted" : "Deleted"} ${successCount} customer(s)` +
        (errorCount > 0 ? `, ${errorCount} error(s)` : ""),
    );
    return;
  }

  // Default: cancel subscriptions only
  if (cancellable.length === 0) {
    console.log("No active/trialing subscriptions found. Nothing to do.");
    return;
  }

  console.log(`\nFound ${cancellable.length} subscription(s) to cancel:\n`);
  for (const sub of cancellable) {
    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    console.log(`  ${sub.id}  status=${sub.status}  customer=${customerId}`);
  }

  if (!DRY_RUN) {
    const confirmed = await promptConfirm(
      `Cancel ${cancellable.length} subscription(s)${IMMEDIATE ? " IMMEDIATELY" : " at period end"}?`,
    );
    if (!confirmed) {
      console.log("Aborted.");
      return;
    }
  }

  let successCount = 0;
  let errorCount = 0;

  for (const sub of cancellable) {
    const prefix = DRY_RUN ? "[dry-run] " : "";
    try {
      if (!DRY_RUN) {
        if (IMMEDIATE) {
          await stripe.subscriptions.cancel(sub.id);
        } else {
          await stripe.subscriptions.update(sub.id, {
            cancel_at_period_end: true,
          });
        }
      }
      console.log(`${prefix}Canceled ${sub.id}`);
      successCount++;
    } catch (err: any) {
      console.error(`${prefix}Failed ${sub.id}: ${err.message}`);
      errorCount++;
    }
  }

  console.log(
    `\n${DRY_RUN ? "Would have canceled" : "Canceled"} ${successCount} subscription(s)` +
      (errorCount > 0 ? `, ${errorCount} error(s)` : "") +
      (IMMEDIATE || DRY_RUN
        ? ""
        : "\nThey will remain active until their current period ends.\n" +
          "Tip: use --delete-customers to fully wipe customer records instead."),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
