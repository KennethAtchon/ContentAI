# ADR-004: Use Stripe + Firebase Extension for Subscriptions

**Date:** Nov 2025  
**Status:** Accepted

## Context

We need recurring billing with multiple subscription tiers (Free, Pro, Enterprise), a self-service portal, and trial periods.

## Decision

Use **Stripe** for payment processing and the **Firebase Stripe Extension** (`@invertase/firestore-stripe-payments`) to sync subscription state into Firestore and set custom claims on Firebase users.

All plan changes go through the **Stripe Customer Portal** (no custom upgrade/downgrade UI required).

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| Stripe without Firebase Extension | Would require custom webhook handling for every subscription event |
| Paddle | Higher transaction fees; less ecosystem support |
| Lemon Squeezy | Smaller ecosystem; no Firebase integration |
| Custom billing | Too complex to build PCI-compliant billing from scratch |

## Consequences

- ✅ Stripe handles PCI compliance, tax, dunning, retries
- ✅ Firebase Extension auto-syncs subscription state and sets `stripeRole` custom claim
- ✅ Customer Portal handles all self-service plan changes
- ✅ Webhook handling is managed by the Extension
- ⚠️ Subscription state is in Firestore (see ADR-003)
- ⚠️ Firebase Extension version upgrades need manual testing
- ⚠️ Cannot deeply customise the payment/subscription flow without moving off the Extension
