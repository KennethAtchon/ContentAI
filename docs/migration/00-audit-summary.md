# Migration Audit: CalcPro → ReelStudio AI

> **Status**: Audit complete. Implementation not yet started.
> **Goal**: Migrate every trace of the CalcPro financial calculator SaaS into a clean ReelStudio AI content platform — while keeping all SaaS infrastructure (auth, payments, subscriptions, admin, account).

---

## The Problem

The codebase is in a split state. The previous migration attempt touched some files but left the majority of the product presenting itself as **CalcPro** (financial calculators) while the new studio feature was bolted on. The result is:

- **Homepage** still shows mortgage/investment/loan/retirement calculator cards
- **Navbar** links to studio, but footer still links to "Calculators"
- **Backend constants** still say `APP_NAME = "CalcPro"` and `CORE_FEATURE_SLUG = "calculator"`
- **Backend calculator routes** (`/api/calculator/*`) still exist and are mounted
- **Translations** have 19+ calculator-specific keys and ~9 "CalcPro" brand mentions
- **Account dashboard** has a "Calculator" tab that is just a redirect stub
- **Admin dashboard** is untouched from the CalcPro template
- **Pricing, FAQ, About, Features, Support, API Docs** pages all have calculator content

---

## Files That Need Changes (Total Count)

| Area | File Count | Status |
|------|-----------|--------|
| Frontend routes | 20 files | Needs full content replacement |
| Frontend feature components | 12 files | Partial / needs update |
| Frontend shared (layout, nav, footer) | 5 files | Needs update |
| Frontend translations | 1 file (~60 keys) | Needs update |
| Frontend constants & utils | 6 files | Partially done |
| Backend constants | 1 file | Not started |
| Backend calculator feature | 6 files | Remove entirely |
| Backend routes (index.ts mount) | 1 file | Remove calculator mount |
| Backend permissions | 2 files | Partially done |
| **Total** | **~54 files** | |

---

## Non-Negotiables (Keep These)

These SaaS features must remain fully functional:
- Firebase Auth (sign-in, sign-up, password reset)
- Stripe subscriptions + checkout + webhooks
- Admin dashboard (customers, orders, subscriptions, settings, developer tools, contact messages)
- Account page (subscription management, profile, orders, usage)
- Email (Resend)
- Database (users, orders, subscriptions)

---

## Migration Document Index

| Doc | Description |
|-----|-------------|
| [01-frontend-public-routes.md](./01-frontend-public-routes.md) | Homepage, pricing, about, features, FAQ, contact, support, API docs, legal pages |
| [02-frontend-auth-routes.md](./02-frontend-auth-routes.md) | Sign-in, sign-up |
| [03-frontend-customer-routes.md](./03-frontend-customer-routes.md) | Account, checkout, payment success/cancel |
| [04-frontend-admin-routes.md](./04-frontend-admin-routes.md) | All admin pages |
| [05-frontend-studio-routes.md](./05-frontend-studio-routes.md) | Studio discover/generate/queue (already built, fix bugs) |
| [06-frontend-features.md](./06-frontend-features.md) | All feature components |
| [07-frontend-shared.md](./07-frontend-shared.md) | Navbar, footer, layouts, shared components |
| [08-frontend-translations.md](./08-frontend-translations.md) | Every translation key that needs updating |
| [09-frontend-constants-utils.md](./09-frontend-constants-utils.md) | Constants, permissions, redirect utils |
| [10-backend-migration.md](./10-backend-migration.md) | Backend constants, routes, calculator removal |
| [11-implementation-order.md](./11-implementation-order.md) | Exact implementation sequence |
