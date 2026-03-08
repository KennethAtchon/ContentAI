# E2E Testing Plan (Playwright)

## Purpose

End-to-end tests verify complete user flows through a real browser against a running Next.js dev server. They complement unit and integration tests by catching UI regressions, navigation issues, and full-stack interactions that can't be tested in isolation.

**Related:** [Integration Tests Plan](./integration-tests-plan.md), [Testing Checklist](../../checklists/testing.md), [Testing Implementation Plan](./testing-implementation-plan.md).

---

## Infrastructure Already in Place

| Item | Status | Location |
|------|--------|----------|
| Playwright installed | ✅ | `project/node_modules` |
| `playwright.config.ts` | ✅ | `project/playwright.config.ts` |
| `test:e2e` npm script | ✅ | `project/package.json` |
| Browsers: Chromium, Firefox, Mobile Chrome | ✅ | Playwright config (WebKit/Mobile Safari disabled — requires Debian/Ubuntu system libs, not available on Fedora/RHEL) |
| HTML + JSON reporters | ✅ | Playwright config |
| Traces/screenshots/video on failure | ✅ | Playwright config |
| `__tests__/e2e/` directory | ✅ | Created with all phase subdirs |
| `__tests__/helpers/global-setup.ts` | ✅ | Created |
| `__tests__/helpers/global-teardown.ts` | ✅ | Created |
| `__tests__/helpers/auth-helpers.ts` | ✅ | Created — storageState login helpers |
| `__tests__/helpers/fixtures.ts` | ✅ | Created — `authenticatedPage`, `adminPage` fixtures |
| Test user seed / auth state | ❌ | Requires running app + real Firebase to generate |

---

## Scope

### In scope
- **Public marketing pages** — load, render, navigation
- **Authentication flows** — sign-in, sign-up, sign-out, protected page redirect
- **Calculator** — input, calculate, view history, export
- **Checkout & payment** — pricing page → checkout → Stripe redirect → success/cancel
- **Account management** — profile update, subscription portal
- **Contact form** — submission, validation errors
- **Admin flows** — dashboard, orders, subscriptions, customers, settings

### Out of scope
- **Real Stripe payments** — use Stripe test mode or mock the redirect
- **Real Firebase auth** — use a seeded test account or Playwright's `storageState` to inject an auth cookie
- **Real email delivery** — not verified; only form submission confirmation UI
- **Unit/integration logic** — covered separately by Bun tests

---

## Test File Structure

```
project/__tests__/e2e/
├── public/
│   ├── homepage.spec.ts
│   ├── marketing-pages.spec.ts
│   └── contact-form.spec.ts
├── auth/
│   ├── sign-in.spec.ts
│   ├── sign-up.spec.ts
│   └── protected-redirect.spec.ts
├── customer/
│   ├── calculator.spec.ts
│   ├── account.spec.ts
│   └── payment.spec.ts
├── admin/
│   ├── dashboard.spec.ts
│   ├── orders.spec.ts
│   ├── subscriptions.spec.ts
│   └── customers.spec.ts
└── shared/
    └── navigation.spec.ts

project/__tests__/helpers/
├── global-setup.ts       # Start server, seed test users
├── global-teardown.ts    # Clean up test data
├── auth-helpers.ts       # storageState login helpers
└── fixtures.ts           # Shared Playwright fixtures
```

---

## Phases

### Phase 1 — Infrastructure & Helpers ✅
Set up the test scaffolding before writing any specs.

- [x] Create `__tests__/e2e/` directory
- [x] Create `__tests__/helpers/global-setup.ts` — waits for dev server, optionally seeds a test user
- [x] Create `__tests__/helpers/global-teardown.ts` — cleans up any seeded data
- [x] Create `__tests__/helpers/auth-helpers.ts` — helper to log in and save `storageState` for reuse
- [x] Create `__tests__/helpers/fixtures.ts` — shared Playwright fixtures (`authenticatedPage`, `adminPage`)
- [x] Fixed `playwright.config.ts` to use `process.env` directly instead of `envUtil` (avoids requiring all Firebase vars just to list tests)
- [ ] Generate auth storageState files — requires a running app + real Firebase test account

---

### Phase 2 — Public Pages ✅
Fastest to write; no auth required.

**File:** `e2e/public/homepage.spec.ts`
| Test | Assertion |
|------|-----------|
| Homepage loads | Status 200, `<h1>` visible |
| CTA button navigates to sign-up | URL contains `/sign-up` |
| Pricing section visible | Pricing cards rendered |

**File:** `e2e/public/marketing-pages.spec.ts`
| Test | Assertion |
|------|-----------|
| `/about` loads | Page title visible |
| `/features` loads | Feature sections visible |
| `/pricing` loads | Plan names visible |
| `/faq` loads | Accordion items visible |
| `/privacy` loads | Content visible |
| `/terms` loads | Content visible |
| `/support` loads | Content visible |
| `/api-documentation` loads | Content visible |

**File:** `e2e/public/contact-form.spec.ts`
| Test | Assertion |
|------|-----------|
| Contact form renders | All fields visible |
| Submit with empty fields | Validation errors shown |
| Submit with invalid email | Email error shown |
| Submit with XSS content | Rejected (error message) |
| Valid submission | Success message shown |

---

### Phase 3 — Authentication ✅
Uses Firebase. Strategy: create a dedicated test account in Firebase Emulator or use `storageState` to inject a pre-authenticated session.

**File:** `e2e/auth/sign-in.spec.ts`
| Test | Assertion |
|------|-----------|
| Sign-in page renders | Email + password fields visible |
| Submit with empty fields | Validation errors shown |
| Submit with wrong password | Error message shown |
| Valid credentials | Redirected to `/calculator` or `/account` |
| "Forgot password" link visible | Link present |

**File:** `e2e/auth/sign-up.spec.ts`
| Test | Assertion |
|------|-----------|
| Sign-up page renders | All fields visible |
| Submit with mismatched passwords | Error shown |
| Submit with existing email | Error shown |
| Valid new user registration | Redirected to onboarding or dashboard |

**File:** `e2e/auth/protected-redirect.spec.ts`
| Test | Assertion |
|------|-----------|
| `/calculator` unauthenticated | Redirected to `/sign-in` |
| `/account` unauthenticated | Redirected to `/sign-in` |
| `/admin/dashboard` as regular user | Redirected or 403 page |
| Sign-out | Redirected to `/sign-in`, session cleared |

---

### Phase 4 — Calculator (Authenticated) ✅
Uses saved `storageState` from Phase 3 to skip login.

**File:** `e2e/customer/calculator.spec.ts`
| Test | Assertion |
|------|-----------|
| Calculator page loads | Input form visible |
| Select calculator type | Type selector works |
| Fill inputs and calculate | Result displayed |
| Invalid input | Validation error shown |
| View calculation history | History list renders |
| Export results (if tier allows) | Download triggered or paywall shown |

---

### Phase 5 — Account & Subscription ✅
**File:** `e2e/customer/account.spec.ts`
| Test | Assertion |
|------|-----------|
| Account page loads | Profile fields visible |
| Update display name | Success toast shown |
| Subscription section visible | Current plan shown |
| "Manage subscription" opens Stripe portal | New tab or redirect (can assert URL) |

---

### Phase 6 — Payment Flow ✅
Stripe test mode required. Use Stripe's test card numbers.

**File:** `e2e/customer/payment.spec.ts`
| Test | Assertion |
|------|-----------|
| Pricing page → click upgrade | Redirected to `/checkout` |
| Checkout page renders | Order summary visible |
| Stripe Checkout redirect | Redirected to Stripe hosted page |
| Payment success page (`/payment/success`) | Success message visible |
| Payment cancel page (`/payment/cancel`) | Cancel message, back link visible |

> **Note:** Real Stripe redirects leave the app domain. Options:
> - Assert the redirect URL contains `stripe.com` and stop there.
> - Use Stripe's test mode + `stripe.com/testing` webhook simulator.
> - Mock the checkout redirect in test env via `E2E_MOCK_STRIPE=true`.

---

### Phase 7 — Admin Flows ✅
Uses a separate `adminPage` fixture (admin `storageState`).

**File:** `e2e/admin/dashboard.spec.ts`
| Test | Assertion |
|------|-----------|
| Admin dashboard loads | Stats cards visible |
| Navigation sidebar renders | All admin links present |

**File:** `e2e/admin/orders.spec.ts`
| Test | Assertion |
|------|-----------|
| Orders list loads | Table visible, pagination present |
| Search orders | Filtered results shown |
| View order detail | Order info modal or page opens |
| Create order (form) | Success message shown |

**File:** `e2e/admin/subscriptions.spec.ts`
| Test | Assertion |
|------|-----------|
| Subscriptions list loads | Table visible |
| View subscription detail | Subscription info shown |
| Update subscription tier | Success message shown |

**File:** `e2e/admin/customers.spec.ts`
| Test | Assertion |
|------|-----------|
| Customers list loads | Table visible |
| Search customers | Filtered results shown |
| View customer profile | User details shown |

---

### Phase 8 — Navigation & Shared ✅
**File:** `e2e/shared/navigation.spec.ts`
| Test | Assertion |
|------|-----------|
| Public nav links work | Each page loads without error |
| 404 page renders | Custom 404 shown for unknown route |
| Mobile nav menu opens (Pixel 5) | Hamburger menu functional |
| Authenticated nav shows correct links | Dashboard/account links present |
| Admin nav shows admin links | Admin-only links visible to admin |

---

## Auth Strategy

Two options — choose based on Firebase Emulator availability:

### Option A: Firebase Emulator (preferred for CI)
1. Start Firebase Emulator in global-setup
2. Seed a test user: `auth.createUser({ email: "e2e@test.com", password: "test1234" })`
3. Sign in via UI in a one-time setup, save `storageState` to `test-results/auth/user.json`
4. Reuse `storageState` in all authenticated tests (skip login UI on every test)
5. Tear down emulator in global-teardown

### Option B: Real Firebase (dev project)
1. Create a dedicated `e2e-test@yourdomain.com` Firebase account manually
2. Sign in via UI once, save `storageState`
3. Reuse across tests
4. Do NOT delete/modify real data — tests should use isolated test data

---

## Running E2E Tests

```bash
# Run all E2E tests (headed)
bun run test:e2e

# Run specific file
npx playwright test e2e/auth/sign-in.spec.ts

# Run in headed mode (see the browser)
npx playwright test --headed

# Run on a specific browser
npx playwright test --project=chromium

# Debug mode (step through)
npx playwright test --debug

# Show last HTML report
npx playwright show-report
```

---

## Priority Order

| Priority | Phase | Reason |
|----------|-------|--------|
| 1 | Phase 1 — Infrastructure | Unblocks everything else |
| 2 | Phase 2 — Public pages | Zero auth complexity, quick wins |
| 3 | Phase 3 — Auth flows | Core user journey |
| 4 | Phase 4 — Calculator | Primary product feature |
| 5 | Phase 7 — Admin | Operational risk |
| 6 | Phase 5 — Account | Lower risk |
| 7 | Phase 6 — Payment | Most complex (Stripe dependency) |
| 8 | Phase 8 — Navigation | Lower risk, broad coverage |

---

## Stability Guidelines

- **Use data-testid attributes** for selectors, not CSS classes or text content that changes.
  ```tsx
  <button data-testid="submit-calculator">Calculate</button>
  ```
- **Avoid `page.waitForTimeout`** — use `page.waitForSelector` or `expect(locator).toBeVisible()` instead.
- **Use `storageState` for auth** — never re-login via UI in every test; it's slow and fragile.
- **Isolate test data** — each test should create/clean its own data or use read-only fixtures.
- **Retries in CI** — Playwright config already sets `retries: 2` in CI (`IS_CI=true`).
- **Parallel runs** — default workers on local; `workers: 1` in CI to avoid flakiness from shared state.
