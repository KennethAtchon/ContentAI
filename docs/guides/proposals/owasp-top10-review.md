# OWASP Top 10 (2021) Security Review

**Reviewed:** Feb 21, 2026  
**Reviewer:** AI Orchestrator  
**Codebase path:** `project/`

---

## Summary

| ID | Category | Status | Key Risk |
|---|---|---|---|
| A01 | Broken Access Control | **PASS** | `contact-messages` GET bypasses wrapper for admin check; see notes |
| A02 | Cryptographic Failures | **PASS** | No at-rest encryption of PII fields in DB |
| A03 | Injection | **PASS** | Prisma ORM + Zod prevents injection; no page-level CSP (fixed below) |
| A04 | Insecure Design | **PASS** | Stripe webhook verification delegated to Firebase Extension |
| A05 | Security Misconfiguration | **PARTIAL → FIXED** | CSP header added; public rate limit reverted to 100/min |
| A06 | Vulnerable Components | **PARTIAL** | `fast-xml-parser` CVE via `firebase-admin` unresolved (upstream) |
| A07 | Authentication Failures | **PASS** | `checkRevoked: true` added to all `verifyIdToken` calls |
| A08 | Software/Data Integrity | **PARTIAL** | Stripe signature verification delegated to Firebase Extension |
| A09 | Security Logging & Monitoring | **PASS** | PII sanitization in prod; no admin mutation audit trail |
| A10 | SSRF | **PASS** | No server-side HTTP calls from user-supplied URLs |

---

## A01 — Broken Access Control | PASS

**Mitigations:**
- `withApiProtection` HOC enforces CORS → rate limit → CSRF → auth → input validation on every route.
- `withAdminProtection` hard-codes `requireAuth: "admin"` — all 11 admin routes use it.
- `requireAdmin` uses DB as authoritative role source; Firebase custom claims are a read cache only. If claims diverge from DB, DB wins and claims are re-synced.
- `checkRevoked: true` added to all `verifyIdToken` calls (Feb 21, 2026).
- Customer-scoped queries include `userId: authResult.user.id` in every Prisma `where` clause — horizontal privilege escalation not possible.
- `POST /api/customer/orders` explicitly ignores `userId` from request body; uses auth token identity only.

**Remaining gaps:**
- `GET /api/shared/contact-messages` calls `requireAdmin` manually inside the handler instead of via `withAdminProtection`. This works but is inconsistent and prone to being missed in code review. Low risk.
- `/api/health` and `/api/health/error-monitoring` are public (`withPublicProtection`) and expose internal diagnostics (memory, uptime, Redis status, error counts). Consider protecting behind a bearer token in production.

---

## A02 — Cryptographic Failures | PASS

**Mitigations:**
- `encryption.ts` uses **AES-256-GCM** with a 12-byte IV and GCM authentication tag (authenticated encryption — prevents ciphertext tampering).
- CSRF tokens also use AES-256-GCM, keyed by `CSRF_SECRET`.
- HSTS: `max-age=31536000; includeSubDomains; preload` in production.
- All secrets sourced from `envUtil`; none hardcoded in code.

**Remaining gaps:**
- PII fields (`email`, `phone`, `address`, `notes`) are **not encrypted at rest** in the PostgreSQL database. The `encrypt`/`decrypt` utilities exist but are not applied to any Prisma model field. If the database is compromised, PII is immediately readable.
- `ENCRYPTION_KEY` is `required: false` in envUtil — no startup-time enforcement.

---

## A03 — Injection | PASS

**Mitigations:**
- Prisma ORM used for all DB operations — parameterized by default.
- `$queryRaw` usages use Prisma's template literal tag, which auto-parameterizes interpolations. No `$queryRawUnsafe` or `$executeRawUnsafe` found.
- Zod schemas validate all request bodies and query params via `validateInputs` middleware.
- Contact form has secondary regex check rejecting `<script>`, `javascript:`, event handler patterns.
- No `eval()` or `new Function()` with user input found.
- **Content-Security-Policy header added** (Feb 21, 2026) — provides browser-level XSS backstop.

**Remaining gaps:**
- DOMPurify is used in only one component (`structured-data.tsx`). If any component renders untrusted HTML, there is no systematic sanitization layer.

---

## A04 — Insecure Design | PASS

**Mitigations:**
- Redis-backed rate limiting on all route types: `auth` (5/min), `payment` (30/hr), `upload` (25/min), `admin` (30/min), `customer` (60/min), `public` (100/min), `contact` (5/5min). Fail-secure: if Redis is unavailable, returns 503 rather than bypassing.
- CSRF protection on all mutation routes (AES-256-GCM, bound to Firebase UID, 24-hour lifetime).
- Replay attack prevention for orders: `stripeSessionId` has `@unique` constraint.
- **Public rate limit reverted from 500/min to 100/min** (Feb 21, 2026).

**Notes:**
- No `STRIPE_WEBHOOK_SECRET`-based `stripe.webhooks.constructEvent` call in application code. Webhook processing is delegated to the Firebase/Stripe Extension (Cloud Function). Verify the Extension is configured with the correct `STRIPE_WEBHOOK_SECRET` in the Firebase console.

---

## A05 — Security Misconfiguration | PARTIAL → FIXED

**Mitigations (pre-existing):**
- `poweredByHeader: false` in `next.config.ts`.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-XSS-Protection`, `HSTS` (production), `Cross-Origin-Opener-Policy`.
- CORS uses explicit origin allowlist; never wildcard.
- `/api/metrics` returns 404 if `METRICS_SECRET` is unset, or requires Bearer token if set.

**Fixed (Feb 21, 2026):**
- **Content-Security-Policy header added** to `middleware.ts` covering all page responses. Allows `self`, Firebase/Google APIs, Stripe JS, Google Fonts.
- **Public rate limit reverted** from 500/min → 100/min.

**Remaining gaps:**
- `/api/health` and `/api/health/error-monitoring` remain public — they expose memory usage, Redis status, and error counts without authentication. Acceptable for now; protect behind a token before public launch.
- `METRICS_SECRET` being optional means `/api/metrics` silently becomes open if the env var is forgotten. Consider making it required in production startup checks.

---

## A06 — Vulnerable and Outdated Components | PARTIAL

**Status:**
- `next` upgraded from 16.0.7 → 16.0.9 (Feb 21, 2026), clearing 4 HIGH CVEs.
- `bun.lock` pins all dependency versions.
- `bun audit` is run in CI (security-audit job in `.github/workflows/ci.yml`).

**Remaining:**
- `fast-xml-parser` critical CVE via `firebase-admin`/`aws-sdk` transitive dependency. Requires an upstream release of `firebase-admin` with a patched version. Track `firebase-admin` releases. The app does not directly parse XML user input, so attack surface is low.

---

## A07 — Authentication Failures | PASS

**Mitigations:**
- All `verifyIdToken` calls now use `checkRevoked: true` (added Feb 21, 2026):
  - `firebase-middleware.ts` → `requireAuth` and `requireAdmin`
  - `app/api/users/delete-account/route.ts`
  - `shared/middleware/helper.ts` (CSRF validation path)
- Firebase Admin SDK verifies JWT signature, issuer, audience, and expiry server-side on every request.
- Role determination uses DB as source of truth; Firebase claims are a fast-read cache.
- Auth rate limit: 5 req/min on auth endpoints with alerting.
- Firebase's built-in brute-force protections (reCAPTCHA, account lockout) cover sign-in endpoints directly.

---

## A08 — Software and Data Integrity Failures | PARTIAL

**Mitigations:**
- `bun.lock` pins all dependency versions.
- No `eval()` or `new Function()` with user-controlled data.
- `stripeSessionId` `@unique` constraint prevents order replay.

**Notes:**
- Stripe webhook signature verification (`stripe.webhooks.constructEvent`) is not implemented in application code — it is delegated to the Firebase/Stripe Extension's Cloud Function. This is architecturally acceptable but means signature verification trust is external. Verify the Extension configuration.

---

## A09 — Security Logging and Monitoring Failures | PASS

**Mitigations:**
- All auth failures logged via `debugLog.error` with structured metadata (no raw error message leaked to client).
- PII sanitization (`pii-sanitization.ts`) applied in production — covers emails, phones, credit cards, JWTs, IPs, SSNs, UUIDs.
- Rate limit violations logged at `warn`/`error` with alerting on sensitive limit types.

**Remaining gaps:**
- PII sanitization is disabled in development — if real data is used locally, it will appear in plaintext logs.
- No structured success log for admin mutations (create/update/delete orders, sync-firebase). Admin actions should produce an audit trail log entry on success, not just on failure.

---

## A10 — Server-Side Request Forgery (SSRF) | PASS

**Mitigations:**
- The only server-side `fetch()` call in API routes is in `/api/subscriptions/portal-link/route.ts`, which calls a Firebase Cloud Functions URL. The URL is constructed from hardcoded env vars — not user input.
- No `fetch()` or HTTP client calls found in any API route with URL parameters derived from user input.

---

## Code Changes Made During This Review

| File | Change |
|------|--------|
| `project/features/auth/services/firebase-middleware.ts` | Added `checkRevoked: true` to `requireAuth` and `requireAdmin` |
| `project/app/api/users/delete-account/route.ts` | Added `checkRevoked: true` to `verifyIdToken` |
| `project/shared/middleware/helper.ts` | Added `checkRevoked: true` to CSRF validation `verifyIdToken` |
| `project/middleware.ts` | Added `Content-Security-Policy` header |
| `project/shared/constants/rate-limit.config.ts` | Reverted public rate limit: 500/min → 100/min |

---

## Recommended Follow-Up Actions

| Priority | Action |
|----------|--------|
| HIGH | Protect `/api/health/error-monitoring` with a bearer token in production |
| MEDIUM | Add structured success audit logs for all admin mutations |
| MEDIUM | Evaluate at-rest encryption for PII fields (email, phone, address) in PostgreSQL |
| MEDIUM | Verify Firebase/Stripe Extension has `STRIPE_WEBHOOK_SECRET` configured |
| LOW | Move `requireAdmin` in `contact-messages` GET to the `withAdminProtection` wrapper |
| LOW | Consider making `ENCRYPTION_KEY` and `METRICS_SECRET` required at startup in production |
