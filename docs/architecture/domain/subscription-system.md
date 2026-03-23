## Subscription system

This document explains **how subscriptions and one-time orders relate to Stripe, Firebase, Firestore, PostgreSQL, and our Hono API** — not just the happy path, but **why** the architecture looks this way and where the sharp edges are (token lag, dual checkout paths, public email endpoints).

---

## Table of contents

1. [Executive summary](#executive-summary)
2. [The Firebase Stripe extension as integration boundary](#the-firebase-stripe-extension-as-integration-boundary)
3. [Firestore document–driven checkout (extension path)](#firestore-document-driven-checkout-extension-path)
4. [Why `stripeRole` lives in the JWT](#why-striperole-lives-in-the-jwt)
5. [Customer Portal for plan changes](#customer-portal-for-plan-changes)
6. [Cancellation and access through period end](#cancellation-and-access-through-period-end)
7. [Trial eligibility: why Postgres participates](#trial-eligibility-why-postgres-participates)
8. [One-time orders vs subscriptions](#one-time-orders-vs-subscriptions)
9. [Server-created subscription checkout (`POST /api/subscriptions/checkout`)](#server-created-subscription-checkout-post-apisubscriptionscheckout)
10. [Failure modes and operations](#failure-modes-and-operations)
11. [Related docs](#related-docs)

---

## Executive summary

| Concern | Primary store | Who writes |
|---------|---------------|------------|
| Subscription lifecycle, Stripe customer linkage | **Firestore** (extension) | Extension + Stripe webhooks |
| Tier for API gating | **Firebase JWT custom claim** `stripeRole` | Extension (via Admin SDK) |
| User profile, trial flags, orders | **PostgreSQL** | Our API + app logic |
| One-time Checkout for products | **Firestore `checkout_sessions`** + Stripe | Extension / CF + Stripe |
| Alternative subscription Checkout | **Stripe API** from our backend | `POST /api/subscriptions/checkout` |

The **mental model**: subscriptions are **Firebase-extension–native**; orders are **Postgres-native**; **both** can create money movement in Stripe but **only** the subscription pipeline maintains **`stripeRole`**.

---

## The Firebase Stripe extension as integration boundary

**Official extension:** `ext-firestore-stripe-payments` (name may vary slightly by version). It runs as **Firebase Cloud Functions** in the Firebase project.

**What we deliberately do *not* do:** implement raw Stripe webhook handlers in Hono for subscription `customer.subscription.updated`, invoice paid, etc. The extension already:

- Normalizes webhook quirks across API versions.
- Writes predictable documents under `customers/{uid}/...`.
- Calls **Firebase Admin** to set custom claims.

**Why this is a good tradeoff for a small team**

- **Less security-critical code** in our repo (signature verification, idempotency, retry storms).
- **Faster** time to a working subscription product.
- **Upgrade path:** if we outgrow the extension (complex Connect, usage-based billing, entitlements engine), we can **migrate** webhook handling behind a feature flag while keeping the same Firestore shape temporarily.

**Costs**

- **Debugging** spans three consoles: Stripe, Firebase Functions logs, Firestore.
- **Version lock-in** — extension behavior changes with Firebase releases; pin versions in `firebase.json` / extension config.

---

## Firestore document–driven checkout (extension path)

### End-to-end flow

1. **Client** creates a document under `customers/{firebaseUid}/checkout_sessions/{autoId}` with fields the extension expects: e.g. Stripe **price** reference, **mode** (`subscription` or `payment`), success/cancel URLs, optional promotion flags, **metadata** for our app.
2. **Extension trigger** fires on create. It calls **Stripe Checkout API** and writes **`url`** (and **`error`**) back onto the same document.
3. **Client** attaches an **`onSnapshot`** listener. When `url` appears, it **`window.location`** redirects to Stripe Hosted Checkout.
4. User pays. **Stripe** sends webhooks to the extension.
5. For **subscriptions**, the extension maintains **`subscriptions`** subcollection docs and updates **`stripeRole`**.
6. User returns to our **`success_url`**. Frontend calls **`getIdToken(true)`** so the next API call carries the new claim.

**Why document-driven instead of `POST /api/.../checkout` only?**

- Matches **extension contract** exactly — the extension is **designed** to watch Firestore.
- **Real-time** handoff without polling our API for session creation.
- **Same pattern** for `mode: payment` product checkouts if the extension / Cloud Function supports dynamic `line_items` from the document (implementation detail lives in Firebase config).

**Metadata discipline**

For **orders**, checkout metadata must include **`userId: <Firebase uid>`** so **`POST /api/customer/orders/create`** can prove the session belongs to the caller (see [Orders](#one-time-orders-vs-subscriptions)). **Never** put only Postgres `users.id` in metadata unless every client and server path agrees — today the code expects **Firebase UID**.

---

## Why `stripeRole` lives in the JWT

**Mechanism:** After subscription events, the extension sets a **custom claim** such as `stripeRole: "pro"` on the Firebase user.

**Benefits**

- **Zero extra DB read** on each Hono request — `authMiddleware` already decodes the JWT; feature gates read `stripeRole` from `auth.firebaseUser`.
- **Edge-friendly** — any future worker that trusts Firebase tokens gets the same tier view.

**Drawbacks**

- **Eventual consistency with human perception** — Stripe + Firestore may be updated before the user’s **browser** holds a refreshed JWT. Mitigations:
  - Force refresh after checkout success and portal return.
  - Show copy like “Your plan may take a moment to update” if needed.

**Important:** **`stripeRole` is not the only authority for everything.** PostgreSQL **`users.role`** remains relevant for **staff admin** and internal tooling. Product tiering for AI limits uses **`stripeRole`** via `getFeatureLimitsForStripeRole` (see [Business model](./business-model.md)).

---

## Customer Portal for plan changes

**Rule:** existing subscribers **do not** use the “new subscription” checkout document flow for upgrades/downgrades. They use **Stripe Customer Portal**.

**Why**

- **Proration** — Stripe calculates partial credits/charges; reproducing this in app code is error-prone.
- **Payment method updates, invoices, cancellation** — all hosted UI.

**Our backend’s role**

- Provide a **portal URL** (often via a **callable Cloud Function** from the same extension family, or a thin backend proxy that calls Firebase — see `subscriptions` routes for the actual implementation in-repo).
- **Never** trust the client to self-assign tier; only **Stripe + extension** mutate `stripeRole`.

---

## Cancellation and access through period end

Stripe models cancel as **`cancel_at_period_end`**. Until the period ends:

- User **keeps** paid access.
- Firestore subscription docs reflect scheduled cancel.

When the subscription **actually ends**, webhooks fire, extension removes or updates claims, and the next token refresh shows **free** (or base) tier.

**UX implication:** UI that reads only `stripeRole` may still show “Pro” until refresh even after the user clicked cancel — clarify in-account copy if support tickets spike.

---

## Trial eligibility: why Postgres participates

Trials are a **business rule** that must be enforced **before** money moves:

- **`hasUsedFreeTrial`** on **`users`** — flipped when a trial converts so the same identity cannot re-trial infinitely.
- **Firestore subscription existence check** — if they already have a sub doc, no second trial.

The **Firestore checkout document** may still include `trial_period_days` **only when** our server or client logic has verified eligibility. **`POST /api/subscriptions/checkout`** recomputes eligibility with Postgres + Firestore queries before calling Stripe.

**Why not store trial state only in Stripe?**

Stripe knows trial **on the subscription**, but **eligibility** (has this human already eaten a trial on our product?) is **our** policy. Centralizing in Postgres keeps **one boolean** auditable in SQL backups.

---

## One-time orders vs subscriptions

### Storage and claims

| | Subscriptions | One-time orders |
|---|----------------|-----------------|
| Primary record | Firestore | PostgreSQL `order` table |
| `stripeRole` | Updated by extension | **Never** |
| Typical Checkout `mode` | `subscription` | `payment` |

### Product checkout (client + Firestore)

See `createProductCheckout` — **`mode: "payment"`**, **`line_items`**. Success redirect includes **`session_id`**.

### Persisting the order server-side

**`POST /api/customer/orders/create`** (preferred):

1. **Idempotency** — if an order with the same **`stripe_session_id`** exists for this Postgres user, return it.
2. **Stripe.retrieve(session)** — verify **`mode === payment`**, **`payment_status`** paid (or `no_payment_required` for edge discounts).
3. **Metadata check** — `metadata.userId === Firebase uid` (checkout writes Firebase UID, not Postgres id).
4. **`totalAmount`** from `amount_total` cents → decimal string for `numeric` column.
5. **Insert** `order` row (`user_id`, `total_amount`, `status`, `stripe_session_id`).

**Race:** unique constraint on `stripe_session_id` — concurrent double-submit catches **`23505`** and returns the winner’s row.

### Generic `POST /api/customer/orders`

Still available for **admin tools** or migrations that already computed amounts — must supply **`totalAmount`** per schema (`NOT NULL`).

### Recovery endpoint

**`GET /api/customer/orders/by-session?sessionId=`** — if the success page reloads after insert, the UI can hydrate without double POST.

### Confirmation email

**`POST /api/shared/emails`** — see [Shared & public API](./shared-public-api.md) for **security caveats** (public endpoint).

---

## Server-created subscription checkout (`POST /api/subscriptions/checkout`)

Some flows use **our backend** with the **Stripe Node SDK** to create a **subscription** Checkout Session directly:

- Ensures **Stripe Customer** exists (create + remember `stripeId` in Firestore customer doc pattern).
- Applies **trial** only when Postgres + Firestore checks pass.
- Returns **`url`** JSON to the client — **no Firestore listener required** for that path.

**Why two subscription checkout mechanisms can coexist**

- **Historical** migration (extension-first → hybrid).
- **A/B** or **platform** constraints (e.g. server needs to attach complex `subscription_data.metadata`).

**Operational guidance:** pick **one primary path per client surface** to reduce confusion; document which button uses which API in frontend README or route comments.

---

## Failure modes and operations

- **Extension misconfig** — checkout docs never get `url`; client times out. Check Firebase function logs and Stripe dashboard for API key errors.
- **Claim not updating** — user paid but still gated. Verify webhook delivery, extension logs, then force **`getIdToken(true)`**.
- **Order create 403** — metadata `userId` mismatch (wrong id type in checkout metadata).
- **Duplicate emails** — success page remounted; ensure **idempotent** order create (implemented) and **idempotent** email trigger (may need work — see shared API doc).

---

## Related docs

- [Business model](./business-model.md)
- [Account management](./account-management.md)
- [Shared & public API](./shared-public-api.md)
- [Authentication](../core/authentication.md)
- [Security](../core/security.md)
