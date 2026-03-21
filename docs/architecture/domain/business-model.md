## Business Model

This document explains how access, billing, and limits actually work — not just what the tiers are.

---

## The Access Model

There are four tiers: Free, Basic, Pro, and Enterprise. Each tier is a strict superset of the one below — Pro users get everything Basic users get, plus more. Access to specific features is simply checked against your tier, server-side.

The tier you're on is encoded directly into your Firebase authentication token as a custom claim (`stripeRole`). This means the backend knows your tier on every request without touching a database — it's just a field in the JWT you already send. When your subscription changes, this claim gets updated, and the next time you refresh your token, the new tier is in effect.

---

## Why There Are Two Separate Data Stores

Subscriptions and orders are stored in completely different databases, and this is intentional:

**Subscriptions → Firestore.** We use a Firebase extension (`ext-firestore-stripe-payments`) that handles the entire Stripe subscription lifecycle automatically. You don't manage this data — Stripe webhooks update the extension, the extension updates Firestore, and the extension sets your Firebase custom claims. If we stored subscriptions in PostgreSQL, we'd have to build all of that ourselves.

**Orders (one-time purchases) → PostgreSQL.** Orders are created manually after payment is confirmed. They don't have the complex lifecycle that subscriptions do (no renewals, cancellations, trials, etc.), so there's no reason to use Firestore for them.

This split means subscription data and order data live in different systems and are accessed differently. It's a tradeoff: less custom code, but two places to look for billing information.

---

## How Billing Actually Works for New Subscriptions

When someone subscribes, no backend code runs first. The flow is:

1. The frontend writes a document to Firestore describing the subscription they want (price ID, which tier, billing cycle, redirect URLs).
2. The Firebase extension detects the new Firestore document and creates a Stripe Checkout Session on our behalf.
3. The extension writes the Checkout URL back into the same Firestore document.
4. The frontend is watching that document in real-time. When the URL appears, it redirects the user to Stripe.
5. The user pays on Stripe's hosted page.
6. Stripe fires a webhook to the extension.
7. The extension creates a subscription document in Firestore and sets the `stripeRole` custom claim on the user's Firebase account.
8. The user gets redirected back to the app. The frontend forces a token refresh to pick up the new claim.

The app never directly talks to Stripe during checkout. The extension is the only thing that does.

---

## Why Plan Changes Go Through the Stripe Portal Only

If a user already has a subscription and wants to change tiers, they're sent to Stripe's hosted Customer Portal rather than any custom UI in the app. This is a deliberate choice:

Subscription changes involve proration (what do you owe/get credit for partway through a billing period?), handling the same subscription ID through the change, and updating the billing cycle. Stripe knows how to do this correctly. Building equivalent logic ourselves would be complex and error-prone. The portal handles it, fires the appropriate webhooks, and the extension updates Firebase automatically.

The checkout flow is only for creating a new subscription — it's protected against running if you already have one.

---

## Usage Limits

Generation limits (how many AI calls you can make) exist because AI calls cost money. The app tracks every generation in the database and checks your running total before letting each request through. If you're at your limit, the request is rejected with a 429.

Limits reset monthly. Upgrading your tier immediately grants the higher limit — the system re-checks against your current tier's limit on every request.

Free users get access to a limited number of generations. Enterprise users are effectively unlimited (the limit is set to infinity in config). The limits are enforced entirely server-side; the UI reflects them for clarity but cannot enforce them.

---

## Trials

A 14-day free trial is available to first-time subscribers. Eligibility is checked in two places:
- A `hasUsedFreeTrial` boolean on the user's database record (prevents using it twice)
- Whether the user has an existing Firestore subscription

If both are clear, the checkout is created with `trial_period_days: 14`. After the trial converts, the flag is set to `true` in the database.
