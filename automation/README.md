# Automation Scripts

Dev-only scripts for resetting and seeding Stripe and Firebase test data.
All scripts read credentials from `backend/.env` automatically — no separate `.env` needed here.

> **Never run these against a production Firebase project or a live Stripe key (`sk_live_...`).
> The Stripe scripts will hard-refuse if they detect a live key.**

---

## Setup

Run once after cloning or pulling:

```bash
cd automation
bun install
```

---

## Stripe Scripts

### `bun stripe/setup-products.ts`

Creates the three subscription products (Basic/Pro/Enterprise) in Stripe and automatically updates `backend/src/constants/stripe.constants.ts` with the real IDs.

**Idempotent** — if a product with the matching `firebaseRole` metadata already exists, it's reused rather than duplicated. Safe to re-run.

```bash
bun stripe/setup-products.ts
```

Run this first whenever you start from a clean Stripe test account or after running `stripe/reset.ts`.

---

### `bun stripe/cancel-subscriptions.ts`

Cancels all active, trialing, and past-due subscriptions in the Stripe test account.

> **Note:** Stripe does not allow deleting subscription records. A canceled subscription stays in history. Use `--delete-customers` to fully wipe customer data instead.

```bash
bun stripe/cancel-subscriptions.ts                    # cancel at period end (soft)
bun stripe/cancel-subscriptions.ts --immediate        # cancel right now
bun stripe/cancel-subscriptions.ts --delete-customers # delete Stripe customers entirely (removes subscriptions, invoices, payment methods)
bun stripe/cancel-subscriptions.ts --dry-run          # preview what would happen
bun stripe/cancel-subscriptions.ts --confirm          # skip the confirmation prompt
```

---

### `bun stripe/reset.ts`

Full Stripe wipe: deletes all customers (which removes their subscriptions, invoices, and payment methods), then archives all products and prices. Run `stripe/setup-products.ts` afterwards to recreate them.

> Deleting the customer is the Stripe equivalent of deleting a subscription — there is no direct subscription delete API.

```bash
bun stripe/reset.ts             # interactive confirmation
bun stripe/reset.ts --dry-run   # preview without making changes
bun stripe/reset.ts --confirm   # skip confirmation prompt
```

---

## Firebase Scripts

### `bun firebase/clear-customers.ts`

Deletes the entire Firestore `customers` collection — all subscription, payment, and checkout session documents synced by the Firebase Stripe Payments extension.

Does **not** cancel Stripe subscriptions. Run `stripe/cancel-subscriptions.ts` first if needed.

```bash
bun firebase/clear-customers.ts                    # clear all customers
bun firebase/clear-customers.ts --uid <firebaseUid> # clear one specific user
bun firebase/clear-customers.ts --dry-run          # preview without deleting
bun firebase/clear-customers.ts --confirm          # skip confirmation prompt
```

---

### `bun firebase/clear-users.ts`

Deletes all users from Firebase Authentication.

Does **not** touch Firestore or the Postgres `users` table — run `clear-customers.ts` and the backend DB reset separately.

```bash
bun firebase/clear-users.ts                    # delete all users
bun firebase/clear-users.ts --exclude-admins   # keep users with admin custom claim
bun firebase/clear-users.ts --dry-run          # preview without deleting
bun firebase/clear-users.ts --confirm          # skip confirmation prompt
```

---

## Common Workflows

### Fresh Stripe setup (new test account or after a reset)

```bash
bun stripe/setup-products.ts
```

This is all you need. Products and prices are created, and `stripe.constants.ts` is updated automatically.

---

### Reset Stripe test data between dev sessions

```bash
# Soft cancel (subscription records stay in history):
bun stripe/cancel-subscriptions.ts --immediate

# Hard wipe (deletes customer records entirely — no history):
bun stripe/cancel-subscriptions.ts --delete-customers --confirm

# Full reset (delete customers + archive products/prices):
bun stripe/reset.ts
bun stripe/setup-products.ts
```

---

### Full dev environment reset

```bash
# 1. Cancel Stripe subscriptions
bun stripe/cancel-subscriptions.ts --immediate

# 2. Clear Firestore customer/subscription data
bun firebase/clear-customers.ts --confirm

# 3. Delete Firebase Auth users
bun firebase/clear-users.ts --confirm

# 4. Reset Postgres (from backend/)
cd ../backend && bash scripts/db-reset-and-migrate.sh

# 5. Recreate Stripe products
cd ../automation && bun stripe/setup-products.ts
```
