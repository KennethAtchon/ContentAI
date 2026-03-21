## Subscription System

This document explains how subscriptions actually work — the Firebase extension, the two-database split, and why the custom claim is the source of truth for tier access.

---

## The Core Idea: We Don't Build the Stripe Integration

Most of the subscription lifecycle (checkout, webhooks, subscription management, cancellation) is handled by a Firebase extension called `ext-firestore-stripe-payments`. This extension runs as a Firebase Cloud Function and monitors Firestore for changes. When specific documents appear or update, it calls Stripe. When Stripe fires webhook events, it updates Firestore and sets Firebase custom claims.

The result: our backend code does almost nothing for subscription management. The extension does it all automatically.

---

## How a New Subscription Gets Created

The checkout flow doesn't start on our backend. It starts on the frontend:

1. The frontend writes a document to a specific Firestore path (`customers/{uid}/checkout_sessions/{sessionId}`). This document describes what the user wants to buy — the Stripe price ID, billing cycle, success/cancel redirect URLs, and trial days if eligible.

2. The Firebase extension detects the new document (it's watching that Firestore collection). It calls Stripe to create a Checkout Session and writes the Checkout URL back into the same document.

3. The frontend is listening to that document in real-time. The moment the URL appears, it redirects the user to Stripe's hosted checkout page.

4. The user completes payment on Stripe.

5. Stripe fires a webhook to the Firebase extension.

6. The extension creates a subscription document under `customers/{uid}/subscriptions/{subId}` in Firestore and calls Firebase Admin SDK to set a custom claim on the user's account: `stripeRole: "pro"` (or whichever tier they subscribed to).

7. The user is redirected back to the app. The frontend immediately forces a token refresh (`getIdToken(true)`) to get a new JWT with the updated claim.

At no point does our backend create the checkout session or handle the webhook. The extension is the bridge between Stripe and Firebase.

---

## Why the Custom Claim Is the Source of Truth

A Firebase custom claim (`stripeRole`) is a field baked into the user's JWT. Every authenticated request already carries the JWT — so every request already carries the user's tier. The backend doesn't need to query Firestore or PostgreSQL to check subscription status. It just reads the claim from the already-decoded token.

This is why tier-gating is fast. There's no extra database lookup per request.

The downside: claims don't update until the user refreshes their token. A subscription change takes effect within seconds on Stripe and Firestore, but the user won't see it in the app until they get a new token. The app forces a token refresh at key moments (after checkout success, after returning from the portal) to avoid this lag.

---

## Why Plan Changes Only Go Through the Stripe Portal

When a user already has a subscription and wants to change tiers, they're sent to Stripe's hosted Customer Portal — not a custom checkout flow. This is deliberate.

Changing an existing subscription involves proration (crediting unused days of the old plan, charging partial days of the new plan), keeping the same subscription ID, and potentially changing billing cycle. Stripe knows how to handle all of this correctly. Building equivalent logic ourselves would mean replicating Stripe's proration math and handling edge cases (failed payments during upgrade, etc.).

The portal gives users all of that for free. They change their plan on Stripe, Stripe updates the subscription, fires webhooks, the extension updates Firestore and custom claims, and the user returns to the app with a fresh token.

The checkout flow is protected against running if a subscription already exists. It's only for brand new subscriptions.

---

## What Happens When a Subscription Cancels

When a user cancels through the portal, Stripe doesn't cancel the subscription immediately — it sets `cancel_at_period_end: true`. The user keeps access until their current billing period ends. The extension updates Firestore to reflect this.

When the period actually ends, Stripe fires a `customer.subscription.deleted` event. The extension removes the `stripeRole` claim. The user's next token refresh gives them a token with no `stripeRole`, and they drop back to the free tier.

---

## Trial Eligibility

The 14-day free trial is tracked in PostgreSQL, not Firestore, because we need to enforce it before the subscription is created. The Firestore subscription document includes `trial_period_days: 14`, which tells the extension to pass that to Stripe during checkout creation.

Eligibility is checked against two things:
- `user.hasUsedFreeTrial` in PostgreSQL (a boolean that's set to `true` when a trial converts to a paid subscription)
- Whether the user already has a Firestore subscription

If either check fails, the checkout is created without trial days. After the trial converts, we mark `hasUsedFreeTrial = true` so they can't get another trial.

---

## Orders (One-Time Purchases)

One-time purchases are completely separate from subscriptions. They're stored in PostgreSQL (not Firestore), and they go through a direct Stripe integration (not the Firebase extension). After payment succeeds, a frontend component reads the Stripe session ID from the redirect URL, calls our backend to create the order record, and sends a confirmation email.

Orders don't affect the `stripeRole` claim and have nothing to do with the subscription system.
