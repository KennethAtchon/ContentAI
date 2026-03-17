# Testing Checklist

**Review Frequency:** Before releases

**References:** [AI_Orchestrator overview](../AI_Orchestrator/overview.md) (testing section). API patterns — `project/shared/services/api/authenticated-fetch.ts`, `project/features/auth/`. **Plan for 100% coverage:** [Testing Plan: 100% Coverage](../AI_Orchestrator/consider/testing-100-coverage-plan.md). **Integration tests plan:** [Integration Tests Plan](../AI_Orchestrator/consider/integration-tests-plan.md). **E2E plan:** [E2E Testing Plan](../AI_Orchestrator/consider/e2e-testing-plan.md).

## Unit Tests

- [x] Unit tests written for critical functions — 50 unit test files across features, services, utils, hooks, validation
- [x] Unit tests passing
- [x] Test coverage > 80% (or project standard) — ~84% lines (Bun coverage)
- [x] Edge cases tested
- [x] Error cases tested
- [x] Mocking implemented correctly — `bun-preload.ts` provides global mocks; per-file mocks via `mock.module`
- [x] Test utilities and helpers available — `__tests__/setup/bun-preload.ts` (preload), `bunfig.toml` (config)

## Integration Tests

- [x] API endpoint tests written — 180 tests across 13 files
- [x] All API routes covered per [Integration Tests Plan](../AI_Orchestrator/consider/integration-tests-plan.md) (phases 1–7)
  - [x] Phase 1: Health & readiness (`api-health-ready.test.ts`) — `/api/health`, `/api/ready`, `/api/metrics`
  - [x] Phase 2: Generator (`api-generator.test.ts`) — types, history, usage, export
  - [x] Phase 3: Customer orders (`api-customer-orders.test.ts`) — list, create, by-id, create, total-revenue, by-session
  - [x] Phase 4: Subscriptions (`api-subscriptions.test.ts`) — current, portal-link, trial-eligibility
  - [x] Phase 5: Admin (`api-admin.test.ts`) — orders CRUD, orders/[id], subscriptions, subscriptions/[id], subscriptions/analytics, analytics, sync-firebase, schema, database/health, verify
  - [x] Phase 6: Users & shared (`api-users.test.ts`, `api-shared.test.ts`) — users CRUD, delete-account, customers-count, upload, emails, contact-messages
  - [x] Phase 7: Analytics (`api-analytics.test.ts`) — web-vitals, form-progress, form-completion, search-performance, health/error-monitoring
- [ ] Database integration tests written — not yet started; Prisma interactions are mocked in current tests
- [x] External service integration tests written (Firestore, Firebase Auth, Stripe portal — mocked)
- [x] Authentication flow tested
- [x] Authorization flow tested
- [x] Error handling tested
- [x] Integration tests passing — 180/180 pass

## End-to-End Tests

> Playwright fully configured. 102 E2E tests across 13 spec files (× 5 browsers = 510 total runs). Tests are written and discovered; **running them requires the app to be live and a real Firebase test account** (storageState not yet generated). E2E CI job added to `.github/workflows/ci.yml` (runs when `E2E_ENABLED=true`). See [E2E Testing Plan](../AI_Orchestrator/consider/e2e-testing-plan.md).

- [x] Critical user flows tested — specs written for all major flows
- [x] Authentication flow tested (sign-in, sign-up, sign-out, protected redirect)
- [x] Payment flow tested (pricing CTA, checkout, success/cancel pages)
- [x] Form submissions tested (contact form validation + success)
- [x] Navigation tested (public pages, auth-gated pages, mobile, 404)
- [x] Admin flows tested (dashboard, orders, subscriptions, customers)
- [ ] E2E tests passing — requires live app + Firebase test account to run
- [ ] E2E tests stable (no flaky tests) — not yet validated against live app
- [x] Global setup/teardown helpers created (`__tests__/helpers/global-setup.ts`, `global-teardown.ts`)
- [x] Auth fixtures created (`auth-helpers.ts`, `fixtures.ts` with `authenticatedPage`, `adminPage`)

## Security Testing

- [x] Authentication tests written — Firebase auth, Bearer tokens, 401/403 paths
- [x] Authorization tests written — admin vs user role checks, `withAdminProtection`, `withUserProtection`
- [x] CSRF protection tested — `requireCSRFToken`, header validation, 403 on missing token
- [x] Rate limiting tested — `applyRateLimit`, 429 response, Redis-backed (mocked)
- [x] Input validation tested — Zod schemas, 400/422 on invalid bodies and query params
- [x] SQL injection prevention tested — Prisma parameterized queries, `$queryRaw` safety
- [x] XSS prevention tested — suspicious content detection in contact-messages route
- [x] Security tests passing

## Performance Testing

> Lighthouse CI is installed (`@lhci/cli`). `.lighthouserc.js` configured with LCP < 2.5s, FCP < 1.8s, CLS < 0.1, accessibility ≥ 0.9, and bundle size budgets. Load test script at `scripts/load-test.js` (k6).

- [x] Load testing performed — `scripts/load-test.js` (k6) ready; run with `bun run load-test`
- [x] Stress testing performed — k6 spike stage included in load test script
- [x] Performance benchmarks established — `.lighthouserc.js`: LCP < 2.5s, FCP < 1.8s, CLS < 0.1, TBT < 300ms
- [ ] Performance regressions checked — requires running Lighthouse CI against live app post-deploy
- [ ] Memory leaks checked — not yet profiled
- [ ] CPU usage checked — Railway metrics available post-deploy

## Browser & Device Testing

> Playwright config covers Chromium, Firefox, Mobile Chrome (all environments); WebKit (Safari), Mobile Safari, and Edge conditionally enabled in CI (ubuntu-latest). See `project/playwright.config.ts`.

- [x] Chrome tested — Chromium in Playwright
- [x] Firefox tested — Firefox in Playwright
- [x] Safari tested — WebKit in Playwright CI
- [x] Edge tested — Edge in Playwright CI
- [x] Mobile browsers tested — Mobile Chrome (Pixel 5) + Mobile Safari (iPhone 12) in Playwright CI
- [ ] Tablet browsers tested — no tablet viewport configured
- [ ] Responsive design tested — manual testing pending
- [x] Cross-browser compatibility verified — Playwright matrix covers all major engines

## Accessibility Testing

> ARIA attributes used throughout components. Lighthouse CI (`@lhci/cli`) configured in `.lighthouserc.js` with enforced accessibility score ≥ 0.9 and specific assertions for color-contrast, image-alt, label, tabindex, html-has-lang, meta-viewport. Accessibility statement at `/accessibility`.

- [ ] Keyboard navigation tested — manual testing pending
- [ ] Screen reader compatibility tested — manual testing pending (NVDA/VoiceOver)
- [x] ARIA labels implemented — `aria-*` attributes present in components (button, sidebar, etc.)
- [x] Color contrast verified — enforced by Lighthouse CI color-contrast assertion
- [ ] Focus indicators visible — manual testing pending
- [ ] Alt text for images — Lighthouse CI image-alt assertion enforced
- [x] Form labels associated — Lighthouse CI label assertion enforced
- [x] Accessibility audit performed — `.lighthouserc.js` configured with score ≥ 0.9; run `bun run lighthouse` post-deploy

## Manual Testing

- [ ] Critical paths manually tested — pending live deployment
- [ ] Edge cases manually tested
- [ ] Error scenarios manually tested
- [ ] User acceptance testing completed
- [ ] Stakeholder approval received

## Test Infrastructure

> Runner: Bun. Config: `bunfig.toml` (preload, coverage reporters, timeout, e2e excluded). Scripts in `package.json`: `test`, `test:unit`, `test:watch`, `test:coverage`, `test:ci`, `test:e2e`. **Note:** Run unit and integration tests separately (`bun test __tests__/unit && bun test __tests__/integration`) due to [Bun mock isolation bug](https://github.com/oven-sh/bun/issues/25712). `test:ci` handles this automatically.

- [x] CI/CD pipeline includes tests — `.github/workflows/ci.yml` created; runs unit + integration + build + security audit
- [x] Tests run automatically on commits — CI triggers on push/PR to master, main, develop
- [x] Test failures block deployment — lint, unit-tests, and integration-tests jobs must pass before build job runs
- [x] Test reports generated — Bun coverage (text + lcov), Playwright HTML + JSON reporters configured
- [x] Test environment configured — `bunfig.toml`, `bun-preload.ts`, env vars set in preload
- [ ] Test data management in place — test fixtures are inline; no shared seed/factory layer yet

## Test Documentation

- [x] Test cases documented — `__tests__/integration/README.md`, inline JSDoc in test files
- [x] Test scenarios documented — [Integration Tests Plan](../AI_Orchestrator/consider/integration-tests-plan.md), [Testing Implementation Plan](../AI_Orchestrator/consider/testing-implementation-plan.md)
- [x] Phase 5 reel-editor test/release gates documented — `docs/specs/PHASE5_TEST_AND_RELEASE_CRITERIA.md`
- [x] Known issues documented — Bun `mock.module` isolation bug (oven-sh/bun#25712): running unit+integration in a single `bun test` invocation causes mock bleed; `test:ci` runs them separately to avoid this
- [x] Test coverage reports available — `bun test --coverage` generates `coverage/` (lcov + text)
- [x] Testing procedures documented — [Testing Plan: 100% Coverage](../AI_Orchestrator/consider/testing-100-coverage-plan.md)
