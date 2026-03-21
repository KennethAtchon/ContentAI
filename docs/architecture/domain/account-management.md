## Account Management

This document explains what the account page does and the interesting bits about how each section actually works.

---

## What the Account Page Is

The account page is a single route with four tabs: profile, subscription, usage, and order history. It's the customer's self-service hub. Nothing here is admin-level — it only shows and affects the authenticated user's own data.

---

## Profile

Standard form — name, email, phone, address, notes. Submitting calls `PATCH /api/users/profile`. The profile data lives in PostgreSQL. Nothing fancy here.

---

## Subscription Display

The subscription tab shows the user's current plan. Notably, it doesn't fetch this from a backend subscription endpoint on load — the tier is read directly from the Firebase JWT custom claim (`stripeRole`) that's already in the user's auth token. No extra API call needed.

This means the subscription display is essentially instant (no loading state), but it shows the tier as of the last token refresh. If a subscription just changed, the user needs to have refreshed their token for the display to update.

The "Manage Billing" button calls our backend to get a Stripe Customer Portal URL, then redirects the user there. All actual plan changes happen on Stripe's side. See [Subscription System](./subscription-system.md) for the full lifecycle.

---

## Usage Dashboard

Shows generation counts versus tier limits — "you've used 34 of your 500 monthly generations." The data comes from a backend endpoint that queries the `feature_usage` table and joins it against the user's tier limits.

This is display-only. The actual enforcement happens on the backend before each AI call — the usage dashboard is just a way for users to see where they stand. The numbers might lag slightly behind the actual enforcement point (the enforcement happens on the server at request time, the dashboard fetches once on page load).

---

## Order History

Fetches and displays one-time purchase orders from PostgreSQL. Users can click an order to see details in a drawer. Orders are immutable from the user's side — status changes are admin-only.
