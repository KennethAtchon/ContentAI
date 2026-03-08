# Template Guide: Make This Your Own

This is the master reference for understanding where everything lives in the template and exactly what to change to turn it into your product. Read this top-to-bottom once; then use the quick-reference tables to find what you need.

---

## Table of Contents

1. [The 5-minute version](#1-the-5-minute-version)
2. [What's already built (don't rebuild this)](#2-whats-already-built-dont-rebuild-this)
3. [Project layout](#3-project-layout)
4. [Where to make it yours](#4-where-to-make-it-yours)
   - [Step 1 — Identity (one file)](#step-1--identity-one-file)
   - [Step 2 — Copy and marketing text](#step-2--copy-and-marketing-text)
   - [Step 3 — Environment variables](#step-3--environment-variables)
   - [Step 4 — Subscription tiers and limits](#step-4--subscription-tiers-and-limits)
   - [Step 5 — Your core feature](#step-5--your-core-feature)
5. [Full project map](#5-full-project-map)
   - [App routes](#app-routes)
   - [Feature modules](#feature-modules)
   - [Shared layer](#shared-layer)
   - [Infrastructure](#infrastructure)
   - [Public assets and email templates](#public-assets-and-email-templates)
6. [Maintaining the project](#6-maintaining-the-project)
   - [Adding a new feature type](#adding-a-new-feature-type)
   - [Replacing the core feature entirely](#replacing-the-core-feature-entirely)
   - [Adding a new public page](#adding-a-new-public-page)
   - [Adding a new admin page](#adding-a-new-admin-page)
   - [Database changes](#database-changes)
   - [Adding environment variables](#adding-environment-variables)
   - [Translations / i18n](#translations--i18n)
   - [API calls and data fetching](#api-calls-and-data-fetching)
7. [Documentation map](#7-documentation-map)
8. [Quick-reference table](#8-quick-reference-table)

---

## 1. The 5-minute version

```bash
git clone <this-repo> your-project
cd your-project

# Frontend
cd frontend && cp .env.example .env && bun install && cd ..

# Backend
cd backend && cp .env.example .env && bun db:generate && bun db:migrate && cd ..

# Start both servers
cd frontend && bun dev   # http://localhost:3000
cd backend && bun dev    # http://localhost:3001
```

Then open three files:

| File | What to do |
|------|-----------|
| `frontend/src/shared/constants/app.constants.ts` | Set `APP_NAME`, `APP_TAGLINE`, `SUPPORT_EMAIL`, `SUPPORT_PHONE`, and optionally `CORE_FEATURE_SLUG` |
| `frontend/src/translations/en.json` | Replace "YourApp", "CalcPro", "calcpro.com" with your product name and copy |
| `frontend/src/features/calculator/` | Keep, edit, or replace with your core feature |

That's it for a working branded product. Everything else — auth, subscriptions, payments, admin, public pages — is already wired up.

---

## 2. What's already built (don't rebuild this)

| Area | What's there | Where it lives |
|------|-------------|----------------|
| **Auth** | Firebase Auth sign-in/sign-up, session cookies, role-based access (user/admin) | `project/features/auth/`, `project/app/(customer)/(auth)/`, `project/app/api/auth/` |
| **Subscriptions** | 3-tier Stripe subscriptions (Basic/Pro/Enterprise), checkout, customer portal, webhook handling, usage gating | `project/features/subscriptions/`, `project/app/api/subscriptions/`, `project/app/(customer)/(main)/checkout/` |
| **Payments** | Stripe Checkout for subscriptions and one-time orders, webhook processing | `project/features/payments/`, `project/app/api/stripe-webhook/` |
| **Orders** | One-time order creation and storage in PostgreSQL, order history | `project/features/orders/`, `project/app/api/customer/orders/` |
| **Admin panel** | Dashboard, customer list, orders, subscriptions, contact messages, dev tools | `project/app/admin/`, `project/features/admin/` |
| **Public pages** | Landing, pricing, FAQ, contact, about, terms, privacy, accessibility, features, support, API docs | `project/app/(public)/` |
| **Usage tracking** | Per-user usage recording against subscription tier limits | `project/app/api/calculator/usage/`, `project/shared/utils/permissions/core-feature-permissions.ts` |
| **Usage dashboard** | In-app usage stats and limit indicators | `project/features/account/components/usage-dashboard.tsx` |
| **Rate limiting** | Redis-backed per-route rate limits | `project/shared/services/rate-limit/` |
| **CSRF protection** | Token generation and validation on all mutation routes | `project/shared/services/csrf/` |
| **SEO** | Metadata generation, structured data (JSON-LD), sitemap, robots, manifest | `project/shared/services/seo/`, `project/app/sitemap.ts`, `project/app/robots.ts`, `project/app/manifest.ts` |
| **Email (transactional)** | Order confirmation emails via Resend | `project/shared/services/email/resend.ts`, `project/public/templates/order-confirmation.html` |
| **Error handling** | Centralized API error handling, structured error types | `project/shared/utils/error-handling/` |
| **Storage (R2)** | Cloudflare R2 file storage integration (optional, toggled by `R2_ENABLED`) | `project/shared/services/storage/` |

Configure these via environment variables and Stripe/Firebase setup. You don't need to rewrite them — only customize branding and copy.

---

## 3. Project layout

```
WebsiteTemplate2/                    ← repo root
├── README.md                        ← getting started (clone → env → run)
├── CLAUDE.md                        ← AI coding rules (patterns to follow)
├── docker-compose.yml
│
├── docs/                            ← all documentation
│   ├── README.md                    ← documentation hub (start here)
│   ├── TEMPLATE_GUIDE.md            ← THIS FILE — master reference
│   ├── where-to-start-coding.md     ← points to exact files to edit
│   ├── template-roadmap.md          ← plan for making the template topic-agnostic
│   ├── architecture/                ← system design docs
│   │   ├── overview.md              ← full tech stack + system overview
│   │   ├── core/                    ← reusable patterns (auth, API, DB, security, etc.)
│   │   └── domain/                  ← default implementation docs (calculator, subscriptions, etc.)
│   ├── adr/                         ← Architecture Decision Records
│   ├── runbooks/                    ← operational runbooks (deploy, rollback, incidents, DB, security)
│   ├── checklists/                  ← pre-launch checklists (security, perf, compliance, testing)
│   ├── troubleshooting/             ← step-by-step fixes for common problems
│   └── guides/                      ← AI role definitions and architecture proposals
│
├── frontend/                        ← React SPA (Vite + TanStack Router)
│   └── src/
│       ├── routes/                  ← file-based pages
│       │   ├── (public)/            ← public marketing pages
│       │   ├── (auth)/              ← sign-in, sign-up
│       │   ├── (customer)/          ← authenticated user pages
│       │   └── admin/               ← admin dashboard
│       ├── features/                ← feature modules (domain-driven)
│       │   ├── account/
│       │   ├── admin/
│       │   ├── auth/
│       │   ├── calculator/          ← DEFAULT core feature (swap this for your product)
│       │   ├── contact/
│       │   ├── faq/
│       │   ├── payments/
│       │   └── subscriptions/
│       └── shared/                  ← cross-cutting concerns
│           ├── components/          ← layout, marketing, saas, UI primitives
│           ├── constants/           ← app.constants.ts (identity), subscription.constants.ts
│           ├── contexts/            ← React context providers
│           ├── hooks/               ← shared React hooks
│           ├── lib/                 ← TanStack Query client and query keys
│           ├── services/            ← API, Firebase, SEO, storage, etc.
│           ├── translations/
│           │   └── en.json          ← ALL user-facing strings (react-i18next)
│           └── utils/               ← envUtil, error handling, permissions, validation
│
├── backend/                         ← Hono API server (Bun runtime)
│   └── src/
│       ├── index.ts                 ← entry point, mounts all routes
│       ├── routes/                  ← API handlers (mounted at /api/<resource>)
│       ├── middleware/              ← requireAuth, requireAdmin
│       ├── services/                ← business logic
│       └── infrastructure/
│           └── database/
│               └── prisma/          ← schema and migrations
│
└── e2e/                             ← Playwright E2E tests
```

---

## 4. Where to make it yours

### Step 1 — Identity (one file)

**File:** `frontend/src/shared/constants/app.constants.ts`

This is the single source of truth for your product identity. Change it first.

```typescript
export const APP_NAME = "YourProduct";           // appears in UI, SEO, manifest, emails
export const APP_DESCRIPTION = "...";            // short description for metadata
export const APP_TAGLINE = "...";                // tagline for manifest and marketing
export const SUPPORT_EMAIL = "support@you.com";  // contact info, GDPR export, emails
export const SUPPORT_PHONE = "+1-555-0100";      // structured data and email templates

export const CORE_FEATURE_SLUG = "calculator";   // URL slug: /calculator and /api/calculator
                                                  // change to "tools", "documents", etc.
```

`CORE_FEATURE_PATH` and `CORE_FEATURE_API_PREFIX` are derived automatically from `CORE_FEATURE_SLUG`. Use them for all links and API calls in your code — never hardcode `/calculator`.

---

### Step 2 — Copy and marketing text

**File:** `frontend/src/translations/en.json`

All user-facing strings live here. Search for:
- `"CalcPro"` / `"YourApp"` / `"calcpro.com"` — replace with your product name and domain
- `"calculator"` / `"calculation"` — replace with your feature noun if applicable
- Landing page headline and subheadline
- Pricing page tier descriptions
- FAQ questions and answers
- Footer links and social URLs

The template uses `react-i18next`. Use `useTranslation()` in all components. Never hardcode user-facing strings — always add a key here.

---

### Step 3 — Environment variables

**File:** `project/.env.example` (copy to `project/.env`)

| Category | Key variables | Notes |
|----------|--------------|-------|
| App | `APP_ENV`, `NODE_ENV`, `NEXT_PUBLIC_APP_ENV` | `development` / `production` |
| Database | `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Replace `template` with your DB name |
| Redis | `REDIS_URL`, `REDIS_HOST`, `REDIS_PORT` | Used for rate limiting and caching |
| Firebase (client) | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, etc. | From Firebase Console |
| Firebase (admin) | `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | From Firebase service account |
| Security | `CSRF_SECRET`, `ENCRYPTION_KEY`, `ADMIN_SPECIAL_CODE_HASH` | Generate strong random values |
| Stripe | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard |
| Email | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO_EMAIL` | From Resend dashboard |
| Storage (optional) | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `R2_ENABLED` | Cloudflare R2; set `R2_ENABLED=false` to skip |
| CORS | `CORS_ALLOWED_ORIGINS` | Your production domain(s), comma-separated |
| SEO | `NEXT_PUBLIC_BASE_URL` | Your full production URL (e.g. `https://yourapp.com`) |
| Testing | `E2E_BASE_URL`, `CI` | Test runner config |

**Rule:** Never use `process.env` directly. Add new env vars to `project/shared/utils/config/envUtil.ts` and access them through that module.

---

### Step 4 — Subscription tiers and limits

**File:** `frontend/src/shared/constants/subscription.constants.ts`

Defines your three tiers (Basic, Pro, Enterprise): names, prices, feature flags, and usage limits. Update:
- Tier names and descriptions
- Monthly usage limits (e.g. "calculations per month" → "documents per month")
- Which features are gated per tier
- Stripe price IDs (from your Stripe dashboard)

Stripe product and price IDs must match what you create in the Stripe Dashboard. Create products for each tier and paste the price IDs here.

---

### Step 5 — Your core feature

The default core feature is a **financial calculator** (`frontend/src/features/calculator/`). You have three options:

#### Option A — Keep calculators, add/edit types

Add a new calculator type (e.g. "savings") by editing:
1. `features/calculator/constants/calculator.constants.ts` — add config entry
2. `features/calculator/types/calculator.types.ts` — add input/output types
3. `features/calculator/types/calculator-validation.ts` — add Zod schema
4. `features/calculator/services/calculator-service.ts` — add calculation logic
5. `features/calculator/components/` — add a component and register it in `calculator-component-map.tsx`

See [Where to start coding §3](where-to-start-coding.md#3-adding-new-feature-types-same-product) for the step-by-step.

#### Option B — Replace the core feature (same folder)

Swap out the calculator module for your product while keeping the same folder:
1. Change `CORE_FEATURE_SLUG` in `app.constants.ts`
2. Replace the contents of `features/calculator/` with your feature's config, types, service, components, and component map
3. Update `translations/en.json` for your product's copy

#### Option C — New feature module (clean separation)

1. Create `project/features/your-product/` with config, types, service, and components
2. Add App Router pages: `project/app/(customer)/(main)/your-slug/`
3. Add API routes: `project/app/api/your-slug/`
4. Wire usage tracking and permissions (reuse `FeatureUsage` and `core-feature-permissions.ts`)
5. Update `CORE_FEATURE_SLUG` and nav links

For a full file-by-file checklist for Options B and C, see the [Core Feature Swap Expert](AI_Orchestrator/roles/core-feature-swap-expert.md).

---

## 5. Full project map

### App routes

```
app/
├── (public)/                  ← no auth required
│   ├── page.tsx               ← landing page (/)
│   ├── pricing/               ← pricing page (/pricing)
│   ├── faq/                   ← FAQ (/faq)
│   ├── contact/               ← contact form (/contact)
│   ├── about/                 ← about page (/about)
│   ├── features/              ← features overview (/features)
│   ├── support/               ← support center (/support)
│   ├── api-documentation/     ← public API docs (/api-documentation)
│   ├── terms/                 ← terms of service (/terms)
│   ├── privacy/               ← privacy policy (/privacy)
│   ├── cookies/               ← cookie policy (/cookies)
│   └── accessibility/         ← accessibility statement (/accessibility)
│
├── (customer)/
│   ├── (auth)/
│   │   ├── sign-in/           ← sign in page (/sign-in)
│   │   └── sign-up/           ← sign up page (/sign-up)
│   └── (main)/                ← requires authentication
│       ├── calculator/        ← core feature UI (/calculator) — YOUR FEATURE GOES HERE
│       ├── account/           ← account + usage dashboard (/account)
│       ├── checkout/          ← subscription checkout (/checkout)
│       └── payment/           ← payment result (/payment/success, /payment/cancel)
│
└── admin/                     ← requires admin role
    ├── page.tsx               ← admin dashboard (/admin)
    ├── customers/             ← customer list (/admin/customers)
    ├── orders/                ← order list (/admin/orders)
    ├── subscriptions/         ← subscription list (/admin/subscriptions)
    ├── contactmessages/       ← contact form submissions (/admin/contactmessages)
    ├── developer/             ← dev tools (/admin/developer)
    └── settings/              ← admin settings (/admin/settings)
```

**API routes** (`app/api/`):

| Route | Purpose |
|-------|---------|
| `api/auth/session/` | Session cookie management |
| `api/calculator/` | Core feature: calculate, usage, history, types, export |
| `api/customer/` | Customer profile and order endpoints |
| `api/admin/` | Admin-only endpoints (customers, orders, subscriptions, contact, analytics) |
| `api/subscriptions/` | Subscription status and management |
| `api/stripe-webhook/` | Stripe webhook handler |
| `api/contact/` | Contact form submission |
| `api/users/` | User management (admin) |
| `api/health/` | Health check (`/api/health/live`, `/api/health/ready`) |
| `api/csrf/` | CSRF token endpoint |

---

### Feature modules

| Module | Location | What it contains |
|--------|----------|-----------------|
| `account` | `features/account/components/` | Usage dashboard, subscription management, profile editor, order history modal |
| `admin` | `features/admin/components/` | Dashboard stats, customer/order/subscription table views and modals |
| `auth` | `features/auth/` | Auth guard (HOC), user button, `useAuthenticatedFetch` hook, Firebase middleware, session types |
| `calculator` | `features/calculator/` | **Default core feature**: config, types, Zod validation, service (pure logic), hook, components, component map |
| `contact` | `features/contact/components/` | Contact form, page client, contact info block, thank-you dialog |
| `customers` | `features/customers/types/` | Customer type definitions |
| `faq` | `features/faq/` | FAQ accordion, categories, hero, page client, search, FAQ data |
| `orders` | `features/orders/types/` | Order type definitions |
| `payments` | `features/payments/` | Checkout page, payment success/cancel, Stripe checkout service, payment service |
| `subscriptions` | `features/subscriptions/` | Feature gate component, manage subscription button, upgrade prompt, subscription hooks |

---

### Shared layer

| Area | Location | Purpose |
|------|----------|---------|
| **Components — layout** | `shared/components/layout/` | Navbar, footer, page shell, sidebar |
| **Components — marketing** | `shared/components/marketing/` | Landing page sections, hero, CTA, feature cards |
| **Components — SaaS** | `shared/components/saas/` | Pricing cards, tier badges, subscription UI |
| **Components — UI** | `shared/components/ui/` | Base components (button, card, dialog, input, etc.) — built on Radix UI + Tailwind |
| **App constants** | `shared/constants/app.constants.ts` | **Product identity** — name, tagline, email, feature slug |
| **Subscription constants** | `shared/constants/subscription.constants.ts` | Tier definitions, limits, Stripe price IDs |
| **Query keys** | `shared/lib/query-keys.ts` | All React Query cache keys — use when adding `useQuery` calls |
| **Permissions** | `shared/utils/permissions/core-feature-permissions.ts` | `hasFeatureAccess()`, `isFeatureFree()` — tier-based gating |
| **Environment config** | `shared/utils/config/envUtil.ts` | All `process.env` access — never import env vars directly |
| **Error handling** | `shared/utils/error-handling/` | API error types, error formatters |
| **Security utils** | `shared/utils/security/` | CSRF, token, hash helpers |
| **Validation utils** | `shared/utils/validation/` | Shared Zod helpers |
| **API service** | `shared/services/api/authenticated-fetch.ts` | `authenticatedFetchJson()` for server-side authenticated calls |
| **DB service** | `shared/services/db/prisma.ts` | Prisma client singleton |
| **Email service** | `shared/services/email/resend.ts` | Send transactional emails via Resend |
| **Firebase service** | `shared/services/firebase/` | Firebase admin and client SDK setup |
| **Rate limit service** | `shared/services/rate-limit/` | Redis-backed rate limiters |
| **SEO service** | `shared/services/seo/` | `generateMetadata()`, structured data (JSON-LD) |
| **Session service** | `shared/services/session/` | Session cookie read/write |
| **Storage service** | `shared/services/storage/` | Cloudflare R2 file upload/download |
| **CSRF service** | `shared/services/csrf/` | CSRF token generation and validation |

---

### Infrastructure

| File | Purpose |
|------|---------|
| `infrastructure/database/prisma/schema.prisma` | Prisma data model — `User`, `Order`, `FeatureUsage`, `ContactMessage` |
| `infrastructure/database/prisma/migrations/` | All database migrations (auto-generated by Prisma) |

---

### Public assets and email templates

| Path | Purpose |
|------|---------|
| `public/` | Static assets: favicon, OG images, icons |
| `public/templates/order-confirmation.html` | Order confirmation email HTML — uses `{{APP_NAME}}`, `{{SUPPORT_EMAIL}}`, `{{SUPPORT_PHONE}}` placeholders |

---

## 6. Maintaining the project

### Adding a new feature type

Example: add a "savings calculator" to the existing calculator feature.

1. `features/calculator/constants/calculator.constants.ts` — add entry to `CALCULATOR_CONFIG`
2. `features/calculator/types/calculator.types.ts` — add input/output types
3. `features/calculator/types/calculator-validation.ts` — add Zod schema
4. `features/calculator/services/calculator-service.ts` — add logic and a branch in `performCalculation`
5. `features/calculator/components/` — create component, register in `calculator-component-map.tsx`
6. `translations/en.json` — add translation keys for the new type name/labels

---

### Replacing the core feature entirely

See [Where to start coding §4](where-to-start-coding.md#4-replacing-the-core-feature-different-product) and [Core Feature Swap Expert](AI_Orchestrator/roles/core-feature-swap-expert.md).

Short version:
1. Update `CORE_FEATURE_SLUG` (and identity constants) in `app.constants.ts`
2. Replace or rewrite `features/calculator/` for your product
3. The API routes under `app/api/calculator/` need to be updated to match your feature's logic
4. The app page at `app/(customer)/(main)/calculator/` renders the feature — point it to your new component
5. Update `translations/en.json` copy
6. Reuse `FeatureUsage` (DB model), `core-feature-permissions.ts` (tier gating), and subscription constants

---

### Adding a new public page

1. Create a folder under `project/app/(public)/your-page/`
2. Add `page.tsx` (server component)
3. Use `getTranslations()` for strings and `generateMetadata()` from `shared/services/seo/metadata.ts` for SEO
4. Add a link in the navbar or footer if needed (`shared/components/layout/`)
5. Add translation keys in `translations/en.json`

---

### Adding a new admin page

1. Create a folder under `project/app/admin/your-section/`
2. Add `page.tsx` — the layout already applies admin auth guard
3. Add any needed API routes under `project/app/api/admin/your-section/`
4. Add a nav link in the admin sidebar (`shared/components/layout/` or admin layout)

---

### Database changes

1. Edit `project/infrastructure/database/prisma/schema.prisma`
2. Run `bun run db:generate` to update the Prisma client
3. Run `bun run db:migrate` to create and apply a migration
4. Commit the new migration file in `infrastructure/database/prisma/migrations/`

**Rules:**
- Never edit migration files after they've been applied
- Add indexes for any column you'll query by
- Use soft deletes (add `deletedAt DateTime?`) rather than hard deletes for user data

---

### Adding environment variables

1. Add the variable to `project/.env.example` with a placeholder value and a one-line comment
2. Add an accessor to `project/shared/utils/config/envUtil.ts`
3. Import from `envUtil` — never use `process.env.YOUR_VAR` directly anywhere else

---

### Translations / i18n

All user-facing strings live in `project/translations/en.json`.

- **Client components:** `const t = useTranslations("namespace"); t("key")`
- **Server components:** `const t = await getTranslations("namespace"); t("key")`
- **New keys:** Add to `en.json` first, then use in components
- **Never hardcode** visible text strings — always use a translation key

For the full workflow, see the i18n section in [Where to start coding](where-to-start-coding.md#6-i18n-copy).

---

### API calls and data fetching

| When | Use |
|------|-----|
| GET with caching (client) | React Query `useQuery` + `useQueryFetcher` hook |
| Authenticated mutations (client) | `useAuthenticatedFetch` from `features/auth/hooks/` |
| Server-side authenticated calls | `authenticatedFetchJson` from `shared/services/api/authenticated-fetch` |

**Never use `fetch` directly.** Follow the patterns above. See [CLAUDE.md](../CLAUDE.md) for code examples.

Query cache keys go in `shared/lib/query-keys.ts`. Always add a new key there rather than writing inline query key arrays.

---

## 7. Documentation map

| Document | What it covers |
|----------|---------------|
| [README.md](../README.md) | Clone → env → run → build. Entry point for new users. |
| [docs/README.md](README.md) | Documentation hub — links to everything |
| [docs/TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md) | **This file.** Full map + make-it-yours steps. |
| [docs/where-to-start-coding.md](where-to-start-coding.md) | Detailed guide: identity, core feature structure, adding/replacing types |
| [docs/template-roadmap.md](template-roadmap.md) | Plan and checklist for making the repo fully topic-agnostic |
| [docs/architecture/overview.md](architecture/overview.md) | Full project overview: tech stack, API routes, DB, security |
| [docs/architecture/core/](architecture/core/) | Reusable patterns: auth, API, DB, security, error handling, etc. |
| [docs/architecture/domain/](architecture/domain/) | Default implementation docs: calculator, subscriptions, payments, admin |
| [docs/guides/ai-roles/core-feature-swap-expert.md](guides/ai-roles/core-feature-swap-expert.md) | Step-by-step: swap the core feature to a different product |
| [docs/guides/ai-roles/security-engineer.md](guides/ai-roles/security-engineer.md) | Security best practices and implementation |
| [docs/troubleshooting/](troubleshooting/) | Fixes for Stripe, subscription, translation issues |
| [docs/adr/](adr/) | Architecture Decision Records (why we chose Firebase, PostgreSQL, Stripe, Bun, etc.) |
| [docs/runbooks/](runbooks/) | Operational runbooks: deploy, rollback, DB, incidents, monitoring |
| [docs/checklists/](checklists/) | Pre-launch checklists: security, performance, compliance, testing |
| [CLAUDE.md](../CLAUDE.md) | AI coding rules: fetch patterns, i18n, env vars |

---

## 8. Quick-reference table

| I want to… | File / location |
|-----------|----------------|
| Change the app name, tagline, email | `project/shared/constants/app.constants.ts` |
| Change the main feature URL (e.g. `/calculator` → `/tools`) | `CORE_FEATURE_SLUG` in `app.constants.ts` |
| Change marketing copy, page text, pricing descriptions | `project/translations/en.json` |
| Add/edit a calculator type (or default feature type) | `features/calculator/constants/calculator.constants.ts` + types + service + component |
| Replace the calculator with a different product | [Core Feature Swap Expert](AI_Orchestrator/roles/core-feature-swap-expert.md) |
| Change subscription tier names, limits, prices | `project/shared/constants/subscription.constants.ts` |
| Add a new env variable | `project/.env.example` + `project/shared/utils/config/envUtil.ts` |
| Add a public marketing page | `project/app/(public)/your-page/page.tsx` |
| Add an admin page | `project/app/admin/your-section/page.tsx` |
| Add a database table or column | `infrastructure/database/prisma/schema.prisma` → `bun run db:migrate` |
| Find where auth is handled | `project/features/auth/`, `project/app/(customer)/(auth)/`, `project/app/api/auth/` |
| Find where Stripe webhooks are processed | `project/app/api/stripe-webhook/` |
| Add a translation key | `project/translations/en.json` → use `useTranslations()` / `getTranslations()` |
| Make an authenticated API call from the client | `useAuthenticatedFetch` from `features/auth/hooks/` |
| Make a cached GET query from the client | `useQuery` + `useQueryFetcher` (React Query) |
| Find the Prisma DB client | `project/shared/services/db/prisma.ts` |
| Find the email sending service | `project/shared/services/email/resend.ts` |
| Change the order confirmation email template | `project/public/templates/order-confirmation.html` |
| Understand the subscription vs. orders split | `docs/AI_Orchestrator/architecture/domain/subscription-system.md` |
| Run the app locally | `cd project && bun run dev` |
| Reset the database | `bun run db:reset` (⚠️ destructive) |
| Run all tests | `bun run test` |
| Check pre-launch readiness | `docs/checklists/production-readiness.md` |
