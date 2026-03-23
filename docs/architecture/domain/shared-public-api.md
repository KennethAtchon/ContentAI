## Shared & public API (`/api/shared`)

Routes are mounted at **`/api/shared`** from `backend/src/routes/public/index.ts`. The module name says “public,” but the file actually mixes **unauthenticated marketing/support endpoints**, **authenticated user utilities**, and **admin-only PII retrieval**. This document explains each surface, **why** it was shaped this way, and the security tradeoffs.

---

## Table of contents

1. [Why these routes are grouped](#why-these-routes-are-grouped)
2. [Contact messages: POST (public)](#contact-messages-post-public)
3. [Contact messages: GET (admin)](#contact-messages-get-admin)
4. [Order confirmation email: POST `/emails`](#order-confirmation-email-post-emails)
5. [Authenticated image upload: POST `/upload`](#authenticated-image-upload-post-upload)
6. [Rate limiting and abuse](#rate-limiting-and-abuse)
7. [Security review checklist](#security-review-checklist)
8. [Operational notes](#operational-notes)

---

## Why these routes are grouped

Historically, “things that are not core studio CRUD” accumulate under a **catch-all public module**: marketing forms, email triggers, small uploads. Mounting them under **`/api/shared`**:

- Avoids sprouting dozens of top-level mounts in `index.ts`.
- Keeps **CORS + rate limit** policies consistent for “semi-public” traffic.

**Downside:** discoverability — engineers may not guess that “contact” lives under `shared`. The domain README and this file exist to fix that.

---

## Contact messages: POST (public)

**Path:** `POST /api/shared/contact-messages`  
**Auth:** None  
**Rate limit:** `rateLimiter("public")`

### Purpose

Accept inquiries from **unauthenticated** visitors (pricing page, marketing site form, etc.) without requiring Firebase sign-in.

### Validation

Requires **non-empty** `name`, `email`, `subject`, `message`. `phone` optional.

### Spam and basic abuse controls

Before insert, the handler concatenates name + subject + message and runs **regex heuristics**:

- Script tags, `javascript:`, inline event handlers (`onload=`), extreme character repetition.

On match → **400** with a generic, user-safe message (no stack trace, no “regex detail” leakage).

**Why regex and not CAPTCHA?**

CAPTCHA adds UX friction and third-party deps. A first line of **cheap server-side filtering** knocks down naive bots; if abuse becomes material, add **hCaptcha/Turnstile**, **IP reputation**, or **WAF rules** in front of this route.

### Encryption at rest

Each PII field (`name`, `email`, `phone`, `subject`, `message`) is passed through **`encrypt()`** (`backend/src/utils/security/encryption.ts`) **before** `INSERT`.

**Algorithm:** AES-256-GCM with random IV per field, auth tag, base64 payload joined as `iv:tag:ciphertext`.

**Why encrypt if the DB is already “private”?**

- **Defense in depth** — DB backups, replicas, and analyst SQL consoles often have **broader access** than the running app.
- **Compliance narrative** — “contact content at rest is encrypted” is easier to argue than “trust everyone with Postgres.”

**Operational requirement:** **`ENCRYPTION_KEY`** must be **exactly 32 characters** (see `encryption.ts`). Rotation requires a **re-encryption job** or dual-key decrypt — not implemented in-route.

### Response

**201** with generic success copy, new `id`, and `createdAt` — enough for the client to show confirmation without leaking internal IDs beyond what’s needed for support correlation.

---

## Contact messages: GET (admin)

**Path:** `GET /api/shared/contact-messages`  
**Auth:** **`authMiddleware("admin")`**  
**Rate limit:** `rateLimiter("admin")`

### Purpose

Support or staff review of inbound messages with **pagination** and **filters**: `page`, `limit` (capped), `search` (ILIKE across name/email/subject), `dateFrom`, `dateTo`.

### Decryption

Rows are loaded **encrypted** from Postgres. The handler iterates known PII fields and **`decrypt()`**s each. **Decrypt failure** is caught per-field and leaves ciphertext as-is (comment: “leave as-is”) so a **single corrupted row** does not break the entire list UI.

**Why not fail the whole page?**

Operational resilience: one bad migration or truncated cell should not deny access to all messages.

---

## Order confirmation email: POST `/emails`

**Path:** `POST /api/shared/emails`  
**Auth:** None  
**Rate limit:** `rateLimiter("public")`

### Purpose

Trigger **`sendOrderConfirmationEmail`** (Resend) with a structured payload: `customerName`, `customerEmail`, `orderId`, `totalAmount`, optional `therapies`, `products`, `address`, `phone`.

### Why this is sensitive

This endpoint is **publicly callable** with no Firebase token. **Rationale (typical):** the success page or a lightweight client bundle may need to fire a confirmation without holding admin credentials. **Risk:** anyone who can guess or obtain valid-looking payloads could **spam victims** or **probe** whether emails exist.

**Mitigations you should treat as mandatory in production:**

- **Short-lived HMAC-signed tokens** or **server-only** invocation after `orders/create` validates payment.
- **Strict rate limiting** (public tier + per-IP).
- **Idempotency keys** per order id to prevent duplicate blasts on refresh.

If the codebase still relies on “obscurity + rate limit,” document that as **technical debt** and track hardening.

### Relationship to Stripe

Stripe already sends **receipt emails** for many configurations. This route is for **branded / enriched** content (line items, therapies copy). Keep messaging consistent to avoid **double-email** annoyance unless intentional.

---

## Authenticated image upload: POST `/upload`

**Path:** `POST /api/shared/upload`  
**Auth:** **`authMiddleware("user")`** + **`csrfMiddleware()`**  
**Rate limit:** `rateLimiter("customer")`

### Purpose

Upload a **small image** (profile, CMS block, rich form) to object storage via **`storage.uploadFile`**, returning **`url`** and **`filename`**.

### Constraints

- **Max 10 MB**
- **Allowed MIME:** jpeg, png, gif, webp — **no SVG** (reduces XSS when URLs are embedded in HTML contexts).

### Filename safety

Uses **`generateSecureFilename`** so original names cannot path-traverse or overwrite well-known keys.

### Why under `/shared` instead of `/media`

Historical / pragmatic: not every image is a “library asset” row in `asset`. This path is **URL-out** focused. If the product converges on a single asset pipeline, consider deprecating in favor of `/api/media` or a dedicated avatar endpoint.

---

## Rate limiting and abuse

| Endpoint | Profile | Intent |
|----------|---------|--------|
| Contact POST | `public` | Cap anonymous volume |
| Emails POST | `public` | Cap email spam potential |
| Upload POST | `customer` | Per-user fairness |
| Contact GET | `admin` | Low volume, privileged |

See `backend/src/services/rate-limit/` for numeric windows.

---

## Security review checklist

- [ ] **Contact POST** — consider CAPTCHA if spam rises.
- [ ] **Emails POST** — authenticate or sign requests; tie to completed order server-side.
- [ ] **Upload** — ensure returned URLs are **not** world-writable buckets if the CDN is public; prefer signed or path-scoped public URLs per env config.
- [ ] **Encryption** — `ENCRYPTION_KEY` rotation runbook documented.
- [ ] **Logging** — no decrypted contact bodies in info-level logs.

---

## Operational notes

- **Support workflow:** admins use GET with search; export features may need CSV — not in this route today.
- **Retention:** no automatic purge of `contact_message`; define GDPR retention if EU users submit data.

---

## Related documentation

- [Security](../core/security.md) (CSRF, rate limits)
- [Subscription system](./subscription-system.md) (orders, confirmation flow)
- [Error handling & logging](../core/error-handling.md)
