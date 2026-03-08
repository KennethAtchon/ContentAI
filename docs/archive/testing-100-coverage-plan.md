# Testing Plan: 100% Coverage

## Goal

Achieve **100% test coverage** (lines, statements, branches, functions) for all in-scope application code, with a clear order of work and sustainable maintenance.

**Related:** [Testing Implementation Plan](./testing-implementation-plan.md) (phased 70% plan), [Testing Checklist](../../checklists/testing.md).

---

## Scope: What Counts Toward 100%

### In scope (must reach 100%)

- **`shared/`** – Utils, services, middleware, hooks, lib (excluding UI components below)
- **`features/`** – Business logic, services, hooks, components (excluding thin wrappers)
- **`app/`** – API route handlers, server actions, `layout.tsx`/`page.tsx` where they contain logic

### Explicitly excluded (do not require 100%)

| Path / type | Reason |
|-------------|--------|
| `shared/components/ui/**` | Third-party-style UI primitives; already excluded in `jest.config.mjs` |
| `**/*.d.ts` | Type declarations only |
| `next.config.*`, `tailwind.config.*`, `playwright.config.*` | Config; not app logic |
| Re-exports that only do `export X from "..."` | No logic to cover |
| Next.js entry files that only delegate (e.g. some `layout.tsx` / `page.tsx`) | Cover via integration/E2E if needed |

### Coverage thresholds (when we hit 100%)

Update `jest.config.mjs` to enforce 100% on in-scope code:

```javascript
coverageThreshold: {
  global: {
    branches: 100,
    functions: 100,
    lines: 100,
    statements: 100,
  },
},
```

Raise thresholds gradually (e.g. 80 → 90 → 100) as each phase is completed so CI stays green.

---

## Current State

- **Overall coverage:** ~92% functions, ~88% lines (Bun coverage); thresholds optional in `bunfig.toml`. Prisma generated and `__tests__/setup` excluded from coverage.
- **Existing tests:** 55 files (51 unit, 4 integration), 672 tests.
- **Phase 0 (done):** Fixed failing tests in `api-route-protection.test.ts`; test runner is Bun (`bun test --coverage`).
- **Phase 1 (done):** Unit tests for: `date.ts`, `pagination.ts`, `subscription-type-guards.ts`, `add-timezone-header.ts`, `response-helpers.ts`, `encryption.ts`; coverage 92–100%.
- **Phase 2 (done):** Validation and permissions at high coverage; `calculator-permissions` and `core-feature-permissions` at 100%.
- **Phase 3 (done):** Config and safe wrappers: `envUtil.ts`, `mock.ts`, `stripe-map-loader.ts` (100%).
- **Phase 4 (done):** Security and rate limiting: `rate-limit.config.ts` (100%), `request-identity`, `middleware/helper`, CSRF exports tested.
- **Phase 5 (done):** Core services: `safe-fetch`, `prisma`, `performance-monitor`, `resend`.
- **Phase 6 (done):** Error handling and observability: `api-error-wrapper`, `auth-error-handler`, `global-error-handler`, `system-logger`, `metrics`.
- **Phase 7 (partial):** Business logic: calculator-service, calculator.constants (100%), calculator-validation (100%), payment-service. Hooks and stripe-checkout deferred.
- **Phase 8 (done):** Shared lib: query-keys (100%), query-client (100%), use-query-fetcher (100%).
- **Phase 9 (partial):** API routes: api-security, api-health-and-calculator (live, calculator/calculate: mortgage, loan, investment, retirement), api-csrf (GET 401/200).
- **Phase 10 (partial):** SEO: metadata, page-metadata, structured-data. PII sanitization (API). Storage R2 and TimeService deferred.
- **Phase 11 (partial):** DOM via happy-dom in preload; QueryProvider and useQueryFetcher tests (RTL + renderHook). Layout/feature components can be added incrementally.
- **Phase 12 (done):** Root middleware: `__tests__/integration/middleware.test.ts` (config matcher, CORS preflight OPTIONS /api/*, security headers on all requests).
- **Coverage config:** Bun `bunfig.toml` defines `coverageDir`, `coveragePathIgnorePatterns`; optional `coverageThreshold` to enforce gates.

---

## Phase 0: Stabilize and prepare (do first)

1. **Fix failing tests** in `__tests__/unit/middleware/api-route-protection.test.ts`  
   - Align mocks (e.g. `requireCSRFToken`, `requireAuth`) so CSRF and “all protection layers” cases return 200 when they should.
2. **Run and enforce coverage in CI**  
   - Ensure `test:ci` (or equivalent) runs `jest --coverage` and that the pipeline fails when thresholds are not met.
3. **Add coverage reporting**  
   - Keep existing Jest coverage output; optionally add a script to fail on regression (e.g. “coverage must not decrease”).
4. **Optional: per-directory thresholds**  
   - If 100% globally is too strict at first, add per-path thresholds in Jest so critical areas (e.g. `shared/services/csrf`, `shared/middleware`) hit 100% first, then raise others.

---

## Phase 1: Pure utilities and helpers (fastest wins)

Target: **100% coverage** for small, side-effect-free modules. No (or minimal) mocks.

| Priority | Path / area | Notes |
|----------|-------------|--------|
| 1 | `shared/utils/helpers/utils.ts` | Already 100%; keep tests and add any new helpers under test |
| 2 | `shared/utils/helpers/date.ts` | Pure date helpers |
| 3 | `shared/utils/helpers/pagination.ts` | Pure pagination logic |
| 4 | `shared/constants/*.ts` | Constants; test any functions or derived values only |
| 5 | `shared/utils/type-guards/subscription-type-guards.ts` | Type guards |
| 6 | `shared/utils/security/encryption.ts` | Encrypt/decrypt with mocked or test keys |
| 7 | `shared/utils/api/response-helpers.ts` | Response builders; already partially covered |
| 8 | `shared/utils/api/add-timezone-header.ts` | Small utility |
| 9 | `shared/utils/helpers` (any remaining) | Finish to 100% |

**Test location:** `__tests__/unit/utils/` and `__tests__/unit/helpers/` mirroring source.

---

## Phase 2: Validation and permissions ✅ (done)

Target: **100%** for all validation and permission modules.

| Priority | Path / area | Notes |
|----------|-------------|--------|
| 1 | `shared/utils/validation/input-validation.ts` | Already tested; extend to 100% branches/lines |
| 2 | `shared/utils/validation/api-validation.ts` | ✅ `api-validation.test.ts` – 100% lines |
| 3 | `shared/utils/validation/auth-validation.ts` | ✅ `auth-validation.test.ts` |
| 4 | `shared/utils/validation/checkout-validation.ts` | ✅ `checkout-validation.test.ts` |
| 5 | `shared/utils/validation/contact-validation.ts` | ✅ `contact-validation.test.ts` |
| 6 | `shared/utils/validation/data-validation.ts` | ✅ `data-validation.test.ts` (under `unit/utils/`) |
| 7 | `shared/utils/validation/file-validation.ts` | ✅ `file-validation.test.ts` |
| 8 | `shared/utils/validation/search-validation.ts` | ✅ `search-validation.test.ts` – 100% lines |
| 9 | `shared/utils/permissions/calculator-permissions.ts` | ✅ `calculator-permissions.test.ts` – 100% |
| 10 | `shared/utils/permissions/core-feature-permissions.ts` | ✅ `core-feature-permissions.test.ts` – 100% |

**Test location:** `__tests__/unit/validation/`, `__tests__/unit/permissions/`, `__tests__/unit/utils/data-validation.test.ts`.

---

## Phase 3: Config, env, and safe wrappers ✅ (done)

Target: **100%** for config and env usage (with mocks for `process.env` and side effects).

| Priority | Path / area | Notes |
|----------|-------------|--------|
| 1 | `shared/utils/config/envUtil.ts` | ✅ `__tests__/unit/config/envUtil.test.ts` – getAllowedCorsOrigins, shouldUseSecureCookies, constants |
| 2 | `shared/utils/config/mock.ts` | ✅ `__tests__/unit/config/mock.test.ts` – generateUserInitials (100% funcs) |
| 3 | `shared/utils/config/index.ts` | Re-exports only; covered via imports |
| 4 | `shared/utils/stripe-map-loader.ts` | ✅ `__tests__/unit/utils/stripe-map-loader.test.ts` – 100% |

---

## Phase 4: Security and rate limiting ✅ (done)

Target: **100%** for CSRF, rate limiting, and request identity.

| Priority | Path / area | Notes |
|----------|-------------|--------|
| 1 | `shared/services/csrf/csrf-protection.ts` | ✅ `__tests__/unit/services/csrf/csrf-protection.test.ts` (mocked in preload; exports tested) |
| 2 | `shared/services/rate-limit/comprehensive-rate-limiter.ts` | Partially covered via middleware; module mocked in preload |
| 3 | `shared/services/rate-limit/rate-limit-redis.ts` | Mocked in preload; full coverage would need Redis mock |
| 4 | `shared/constants/rate-limit.config.ts` | ✅ `__tests__/unit/services/rate-limit/rate-limit-config.test.ts` – 100% |
| 5 | `shared/services/request-identity/request-identity.ts` + `index.ts` | ✅ `__tests__/unit/services/request-identity/request-identity.test.ts` – 100% funcs |
| 6 | `shared/middleware/api-route-protection.ts` | Already tested in `api-route-protection.test.ts` |
| 7 | `shared/middleware/helper.ts` | ✅ `__tests__/unit/middleware/helper.test.ts` – 100% funcs |

**Test location:** `__tests__/unit/middleware/`, `__tests__/unit/services/csrf/`, `__tests__/unit/services/rate-limit/`, `__tests__/unit/services/request-identity/`.

---

## Phase 5: Core services (DB, API, auth, email) ✅ (done)

Target: **100%** with heavy mocking of external deps (Prisma, Redis, Resend, Firebase).

| Priority | Path / area | Notes |
|----------|-------------|--------|
| 1 | `shared/services/db/prisma.ts` | ✅ `__tests__/unit/services/db/prisma.test.ts` – getQueryStats, getConnectionPoolStats (mocked) |
| 2 | `shared/services/db/redis.ts` | Not tested (preload mocks rate-limit-redis; redis used internally) |
| 3 | `shared/services/db/performance-monitor.ts` | ✅ `__tests__/unit/services/db/performance-monitor.test.ts` – getQueryStats, getConnectionStats, getHealthCheck |
| 4 | `shared/services/api/authenticated-fetch.ts` | Depends on Firebase auth; cover via integration |
| 5 | `shared/services/api/safe-fetch.ts` | ✅ `__tests__/unit/services/api/safe-fetch.test.ts` – safeFetch, publicFetch, publicFetchJson, externalServiceFetch |
| 6 | `shared/services/firebase/admin.ts` | Mocked in preload |
| 7 | `shared/services/firebase/config.ts`, etc. | Mock Firebase/Stripe |
| 8 | `shared/services/email/resend.ts` | ✅ `__tests__/unit/services/email/resend.test.ts` – sendEmail, sendTestEmail, generateOrderConfirmationEmail, sendOrderConfirmationEmail |
| 9 | `shared/services/request-identity` | Done in Phase 4 |

---

## Phase 6: Error handling, logging, observability ✅ (done)

Target: **100%** for error handlers and logging (mock logger and env).

| Priority | Path / area | Notes |
|----------|-------------|--------|
| 1 | `shared/utils/error-handling/api-error-wrapper.ts` | ✅ `__tests__/unit/error-handling/api-error-wrapper.test.ts` – 100% lines |
| 2 | `shared/utils/error-handling/auth-error-handler.ts` | ✅ `__tests__/unit/error-handling/auth-error-handler.test.ts` – 100% lines |
| 3 | `shared/utils/error-handling/global-error-handler.ts` | ✅ `__tests__/unit/error-handling/global-error-handler.test.ts` – reportError, metrics, withTimeout, withErrorHandling, install/remove |
| 4 | `shared/utils/debug/debug.ts` + `index.ts` | Mocked in preload |
| 5 | `shared/utils/system/system-logger.ts` | ✅ `__tests__/unit/utils/system/system-logger.test.ts` – API and convenience exports (mocked) |
| 6 | `shared/services/observability/metrics.ts` | ✅ `__tests__/unit/services/observability/metrics.test.ts` – normalizeRouteLabel, record*, getMetricsContent, isMetricsEnabled |
| 7 | `shared/services/observability/firebase-logging.ts` | Mock Firebase |
| 8 | `shared/utils/system/web-vitals.ts` | Mock `window`/perf API |
| 9 | `shared/utils/system/app-initialization.ts` | Init branches |
| 10 | `shared/utils/system/prisma-introspection.ts` | Introspection; mock Prisma |

---

## Phase 7: Business logic (calculator, subscriptions, payments) ✅ (partial)

Target: **100%** for services and pure business logic.

| Priority | Path / area | Notes |
|----------|-------------|--------|
| 1 | `features/calculator/services/calculator-service.ts` | ✅ `__tests__/unit/features/calculator/calculator-service.test.ts` – mortgage, loan, investment, retirement, performCalculation |
| 2 | `features/calculator/constants/calculator.constants.ts` | ✅ `__tests__/unit/features/calculator/calculator-constants.test.ts` – 100% lines |
| 3 | `features/calculator/types/calculator-validation.ts` | ✅ `__tests__/unit/features/calculator/calculator-validation.test.ts` – 100% lines |
| 4 | `shared/utils/permissions/calculator-permissions.ts` | Done in Phase 2 |
| 5 | `features/subscriptions/hooks/use-subscription.ts` | Defer: React hook; use integration or RTL |
| 6 | `features/payments/services/payment-service.ts` | ✅ `__tests__/unit/features/payments/payment-service.test.ts` – validation, processPayment throw |
| 7 | `features/payments/services/stripe-checkout.ts` | Defer: Firestore/addDoc/onSnapshot; mock in integration |
| 8 | `features/auth/services/firebase-middleware.ts` | Mocked in preload; cover via integration |
| 9 | `features/auth/hooks/use-authenticated-fetch.ts` | Auth fetch; cover via integration |
| 10 | `features/calculator/hooks/use-calculator.ts` | Defer: React hook + API; use RTL or integration |

**Test location:** `__tests__/unit/features/calculator/`, `__tests__/unit/features/payments/`.

---

## Phase 8: Shared hooks and lib ✅ (partial)

Target: **100%** for shared hooks and query/API helpers.

| Priority | Path / area | Notes |
|----------|-------------|--------|
| 1 | `shared/hooks/use-query-fetcher.ts` | Defer: RTL renderHook needs DOM (jsdom); cover via integration |
| 2 | `shared/hooks/use-paginated-data.ts` | Defer: needs AppContext + QueryClient; RTL + DOM |
| 3 | `shared/hooks/use-portal-link.ts` | Defer: same as above |
| 4 | `shared/lib/query-keys.ts` | ✅ `__tests__/unit/lib/query-keys.test.ts` – all key builders |
| 5 | `shared/lib/query-client.ts` | ✅ `__tests__/unit/lib/query-client.test.ts` – QUERY_STALE, makeQueryClient |

**Test location:** `__tests__/unit/lib/`.

---

## Phase 9: API routes (integration-style) ✅ (partial)

Target: **100%** for every API route handler (app route handlers).

- Use **integration tests** that call the route with mocked auth, DB, and external services.
- Group by domain: auth, admin, calculator, customer, subscriptions, analytics, health, etc.

**Existing:** `__tests__/integration/api-security.test.ts` (auth, admin, customer profile, CSRF, security headers).

**Added:** `__tests__/integration/api-health-and-calculator.test.ts`:
- GET /api/live (200, alive, process details)
- POST /api/calculator/calculate: 401 unauthenticated, 200 valid mortgage, 400 invalid type, 400 invalid inputs

**Preload:** Prisma mock extended with `featureUsage` (count, create, findMany, findFirst) and `$queryRaw` for routes that need them.

**Remaining:** health/ready (need Redis mock), subscriptions, admin (remaining), analytics, shared, csrf (already in api-security).

---

## Phase 10: Remaining shared services and SEO/storage ✅ (partial)

Target: **100%** for everything left under `shared/`.

| Priority | Path / area | Notes |
|----------|-------------|--------|
| 1 | `shared/services/seo/metadata.ts`, `page-metadata.ts`, `structured-data.ts` | ✅ `__tests__/unit/services/seo/metadata.test.ts`, `page-metadata.test.ts`, `structured-data.test.ts` – 100% lines |
| 2 | `shared/services/storage/r2.ts` + `index.ts` | Defer: mock S3/R2 client |
| 3 | `shared/services/timezone/TimeService.ts` | Mocked in preload |
| 4 | `shared/utils/security/pii-sanitization.ts` | ✅ `__tests__/unit/utils/security/pii-sanitization.test.ts` – API (module mocked in preload) |
| 5 | `shared/types/index.ts` | Re-exports only |

---

## Phase 11: React components and feature UI ✅ (partial)

Target: **100%** for in-scope components (excluding `shared/components/ui/**`).

- **DOM setup:** happy-dom via `GlobalRegistrator` in `__tests__/setup/bun-preload.ts`; `@testing-library/jest-dom` for matchers.
- **Added:** `__tests__/unit/components/query-provider.test.tsx` (QueryProvider renders children), `__tests__/unit/hooks/use-query-fetcher.test.tsx` (renderHook; fetcher returned).
- Use **React Testing Library** (render, screen, renderHook, cleanup) and preload mocks for next/navigation, next/image.
- Order: 1) Shared providers/layout, 2) Feature components with logic, 3) Presentational last.
- **Remaining:** layout components (error-boundary, navbar, etc.), feature forms/dashboards; add as needed.

**Test location:** `__tests__/unit/components/`, `__tests__/unit/hooks/` (for hooks needing DOM).

---

## Phase 12: App router pages and middleware ✅ (done)

Target: **100%** for any remaining logic in `app/` and root middleware.

- **Middleware** (`middleware.ts`): ✅ `__tests__/integration/middleware.test.ts` – config matcher, CORS preflight (403 disallowed/missing origin, 200 + CORS headers when allowed), security headers on GET /api/* and GET /.
- **Layouts/pages:** Only the parts that contain conditionals, data loading, or error handling; many can be covered indirectly via E2E.

---

## Maintenance and quality

- **New code:** Require tests for new modules (enforced by review and/or CI).
- **Coverage gates:** Once at 100%, keep `coverageThreshold` at 100% so regressions fail CI.
- **E2E:** Playwright remains for critical user flows; 100% unit/integration coverage does not replace E2E.
- **Docs:** Update [Testing Checklist](../../checklists/testing.md) and [Testing Implementation Plan](./testing-implementation-plan.md) as phases are completed.

---

## Summary order

| Phase | Focus | Approx. effort |
|-------|--------|-----------------|
| 0 | Fix failing tests, CI, thresholds | Small |
| 1 | Pure utils and helpers | Small |
| 2 | Validation and permissions | Medium |
| 3 | Config and env | Small |
| 4 | Security and rate limiting | Medium |
| 5 | Core services (DB, API, auth, email) | Large |
| 6 | Error handling, logging, observability | Medium |
| 7 | Business logic (calculator, subscriptions, payments) | Large |
| 8 | Shared hooks and lib | Small |
| 9 | API routes | Large |
| 10 | SEO, storage, timezone, PII | Medium |
| 11 | React components | Large |
| 12 | Middleware and app router | Medium |

Work in order; after each phase, run `bun run test:coverage` and raise `coverageThreshold` toward 100% so the project moves to full coverage without big bang failures.

---

## Related documentation

- [Testing Implementation Plan](./testing-implementation-plan.md) – Phased 70% plan and service priorities
- [Testing Checklist](../../checklists/testing.md) – Pre-release checklist
- [Production Readiness](./production-readiness.md) – Testing section
- Jest config: `project/jest.config.mjs`
- Test setup: `project/jest.setup.js`
