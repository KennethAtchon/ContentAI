## Account management

This document describes the **customer account** area of the product: profile, subscription display, usage statistics, order history, and how those concerns map to **APIs**, **Firebase**, and **PostgreSQL**. It also explains **why** some data is “free” (no network) while other tabs always round-trip to the server.

---

## Table of contents

1. [Product scope](#product-scope)
2. [Profile: `/api/customer/profile`](#profile-apicustomerprofile)
3. [Preferences: link-out](#preferences-link-out)
4. [Subscription tab: claims vs server](#subscription-tab-claims-vs-server)
5. [Usage dashboard: `/api/customer/usage`](#usage-dashboard-apicustomerusage)
6. [Order history](#order-history)
7. [Cross-cutting UX and consistency](#cross-cutting-ux-and-consistency)
8. [Related docs](#related-docs)

---

## Product scope

The account experience is the **self-service** hub for an authenticated **non-admin** user:

- **Profile** — identity and contact fields stored in Postgres, some mirrored to Firebase when policy allows.
- **Subscription** — read **tier** from the token; **mutations** happen on Stripe via portal / checkout flows elsewhere.
- **Usage** — read-only visibility into metered features vs plan limits.
- **Orders** — read-only list of **one-time** purchases; fulfillment and refunds are operator-driven.

Nothing in this area grants **admin** capabilities; admin UIs live under `/admin/*` with separate middleware.

---

## Profile: `/api/customer/profile`

### Read: `GET /api/customer/profile`

Returns:

- **Profile fields** from `users` — name, email, phone, address (structured or combined depending on client), role, timezone, timestamps.
- **`isOAuthUser`** — derived from Firebase Admin **`providerData`**: if the user has **no** `password` provider, email change is **blocked** server-side (must change at Google/Microsoft/etc.).

**Why call Firebase Admin on read?**

Firebase is the **source of truth for auth providers**; Postgres may not know whether the account is OAuth-only. A single extra Admin SDK read on profile load is acceptable vs storing redundant provider flags that drift.

### Write: `PUT /api/customer/profile`

**CSRF-protected** — same-site token required (`csrfMiddleware`).

**Email change path**

1. If `email` in body **differs** from current:
   - Reject if **OAuth-only** (`OAUTH_EMAIL_CHANGE_NOT_ALLOWED`).
   - If password provider exists, check **`getUserByEmail`** to avoid duplicates.
   - **`adminAuth.updateUser(uid, { email })`** then update Postgres.
2. Other fields (`name`, `phone`, `address`, `timezone`) patch **`users`** directly.

**Why mirror email to Firebase *and* Postgres?**

- **Firebase** drives login identity and token `email` claim.
- **Postgres** drives billing artifacts, support lookups, and foreign keys (`orders.user_id`, etc.). **Dual write** keeps them aligned; failures mid-flight should be rare but may need support scripts if they occur.

**Address string vs structured fields**

Some checkout flows (`PaymentService`) **concatenate** street + city + state + zip into a **single `address` string** on `PUT` for speed. If the product later needs structured shipping, add columns or JSONB — document migration in [Database](../core/database.md).

---

## Preferences link-out

Per-user AI/video/voice defaults are **not** edited on a dedicated account sub-tab in all deployments, but when present they use **`/api/customer/settings`**.

See the full architecture write-up: [User preferences system](./user-preferences-system.md) (upsert semantics, `system_default` sentinel, `ai-defaults` / `video-defaults` helper GETs).

---

## Subscription tab: claims vs server

### Displaying current tier

The UI reads **`stripeRole`** from the **Firebase ID token** already held by the client (`useApp`, auth context). **No GET `/subscription`** is required for the badge text.

**Why this is good**

- **Instant render** — no spinner for “what plan am I on?”
- **Fewer backend dependencies** for a read-mostly label

**Why this can confuse users**

- **`stripeRole` is stale until `getIdToken(true)`** after Stripe events. If a user completes checkout and lands on account **before** refresh logic runs, the tab may still show the old tier for seconds.

**Mitigations in product code**

- Force refresh on **checkout success** and **portal return** routes.
- Optionally **poll** Firestore subscription doc for power users (advanced; usually unnecessary).

### Manage billing

“Manage billing” hits our backend to obtain a **Stripe Customer Portal** URL (implementation in `subscriptions` routes / Firebase callable — see [Subscription system](./subscription-system.md)). The browser **redirects** to Stripe; we **never** embed card PANs in our UI.

---

## Usage dashboard: `GET /api/customer/usage`

### What the endpoint computes

Server-side (`backend/src/routes/customer/index.ts`):

- **Month boundaries** in the **user’s perspective** uses server `now` (see note below on timezones).
- **`feature_usages` counts** for the current calendar month:
  - `feature_type = reel_analysis`
  - `feature_type = generation`
- **Limits** from **`getFeatureLimitsForStripeRole(stripeRole)`** — same function as enforcement gates so dashboard and **actual blocking** stay aligned.
- **Queue depth** — counts `queue_items` with `status = scheduled` for the user (social / scheduling pipeline visibility).

### Why enforcement is not client-side

The UI **cannot** safely enforce limits — anyone could call the API with a forged token... **except** the API **re-checks** on each AI operation. The dashboard is **honest telemetry** for legitimate users, not a security boundary.

### Staleness

The dashboard fetch is typically **once per navigation**. If the user burns through quota in **another tab**, this tab may show outdated numbers until refresh. Acceptable tradeoff vs WebSocket push for quota.

### Timezone nuance

Usage resets are **month-based on server clock** unless explicitly shifted by user timezone fields in future work. If users near the international date line complain, consider **explicit `usageMonth` stored in UTC** per billing anchor.

---

## Order history

### List

**`GET /api/customer/orders`** paginates orders for **`auth.user.id`** from Postgres.

### Detail

**`GET /api/customer/orders/:orderId`** returns a single row **if owned**.

### Immutability

Customers **cannot** PATCH order status — support uses **admin** routes. This avoids chargeback / accounting inconsistencies from self-service “mark complete” buttons.

### Relationship to subscriptions

Orders **do not** grant `stripeRole`. A user can have **both** an active subscription and historical product orders (e.g. coaching add-on). UI should not conflate them in copy.

---

## Cross-cutting UX and consistency

- **i18n** — all user-visible strings must go through **`react-i18next`** keys (project rule); architecture docs describe behavior, not copy.
- **Loading states** — profile and usage benefit from **skeletons**; subscription tier label can render **synchronously** from token.
- **Error surfaces** — OAuth email change errors should link to **help** explaining provider consoles.

---

## Related docs

- [Subscription system](./subscription-system.md)
- [User preferences](./user-preferences-system.md)
- [Business model](./business-model.md)
- [Authentication](../core/authentication.md)
- [API patterns](../core/api.md)
