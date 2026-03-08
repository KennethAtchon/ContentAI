# Template Roadmap: Making This a Proper Template

This document outlines the changes needed to turn the current **calculator-product template** (YourApp) into a **topic-agnostic SaaS template**. After these changes, the main product area (e.g. “calculators”) should be swappable for another subject (e.g. “document tools”, “image tools”) with minimal structural refactors—mainly config, copy, and one feature module.

**Priority:** The project must be **easy for users to pull and start working**. Common infrastructure (auth, billing, subscriptions, etc.) is already set up so teams can focus on **core features** and product identity.

---

## Goals & Success Criteria

- **Goal:** Any team can clone the repo, set product name + topic in config, and implement their own “core feature” (calculators, tools, generators, etc.) without renaming half the codebase.
- **Adopter experience:** Someone who pulls the template should be able to:
  1. **Clone and run** with minimal steps (env file, install, migrate, dev).
  2. **See clearly what’s already built** (auth, subscriptions, payments, admin, public pages) so they don’t rebuild it.
  3. **Know exactly where to code** their main product (one “core feature” area + branding).
  4. **Change identity in one place** (app name, tagline, support email) and have it reflect everywhere.
- **Success:**  
  - Product name and tagline come from a single config (no hardcoded “YourApp”).  
  - The “main app feature” is a **concept** (e.g. “core feature” / “tools”) with one **default implementation** (calculators).  
  - Routes, DB model, and permissions use generic names; only the default implementation is calculator-specific.  
  - Documentation describes the template first, then “Calculator example” as one implementation.  
  - README and a short “Using this template” guide make **pull → configure → run → build your feature** obvious.

---

## Adopter Experience: Pull and Start Working

### What adopters should do (target flow)

1. **Clone** the repo.
2. **Copy** `.env.example` → `.env` and fill in required values (database, Firebase, Stripe, etc.).
3. **Set product identity** in one file (e.g. `app.constants.ts` or a single “template config”): app name, tagline, support email.
4. **Run** `install`, `db:generate`, `db:migrate`, `dev` — app runs with default (calculator) implementation.
5. **Focus** on either (a) customizing the default core feature (e.g. change calculator types, copy) or (b) replacing it with their own feature (e.g. document tools) in the same place.

No need to set up auth, billing, subscriptions, admin, or public pages from scratch—that’s **common stuff** already in the template.

### What’s included (common stuff — already built)

| Area | What’s there | Adopter typically… |
|------|------------------|----------------------|
| **Auth** | Firebase Auth, sign-in/sign-up, session, role (user/admin) | Adds OAuth providers or custom claims if needed |
| **Subscriptions** | Stripe + Firebase Extension, tiers (Basic/Pro/Enterprise), checkout, portal | Adjusts tier names/limits or prices in config |
| **Payments** | Stripe Checkout (subscriptions + one-time), webhooks | Keeps as-is or adds payment types |
| **Orders** | One-time orders in PostgreSQL, admin order list | Keeps or extends for their product |
| **Admin** | Dashboard, customers, orders, subscriptions, contact messages, dev tools | Keeps and maybe adds tabs |
| **Public** | Landing, pricing, FAQ, contact, about, terms, privacy | Replaces copy and maybe layout; structure stays |
| **Usage & limits** | Per-user usage tracking, tier-based limits, usage dashboard | Keeps; core feature just “consumes” usage |
| **Infra** | DB (Prisma), Redis (rate limit/cache), env config, CSRF, rate limiting, error handling | Keeps; may add env vars |

Adopters **do not** need to implement these; they **configure** (env, Stripe products, Firebase) and **customize** (branding, copy, tiers).

### What adopters add or replace (core features)

| Area | What adopters do |
|------|-------------------|
| **Product identity** | Set app name, tagline, support email (and optionally topic/slug) in one config. |
| **Core feature** | Either keep the default (e.g. calculators) and edit types/copy, or replace the feature module with their own (e.g. document generator, image tools). One clear place: e.g. `features/calculator/` (default) or their new feature + config. |
| **Copy & UI** | Replace translations and marketing copy for their product; optionally replace landing/pricing content. |

The template should make **“where do I build my main product?”** obvious (one folder + one config).

---

## Making It Easy: Onboarding & Setup

So that “pull and start working” is real, the repo should include the following. Add these as roadmap deliverables where applicable.

| Deliverable | Purpose |
|-------------|---------|
| **README “Using this template” section** | Short steps: clone → env → config (app name) → install → migrate → dev. List “what’s included” and “where to add your feature.” Link to full docs. |
| **`.env.example`** | All required env vars with dummy/placeholder values and one-line comments (e.g. `DATABASE_URL`, Firebase, Stripe, Redis, `NEXT_PUBLIC_*`). No secrets. |
| **Single “template config”** | One place (e.g. `app.constants.ts` or `template.config.ts`) for `APP_NAME`, `APP_DESCRIPTION`, `SUPPORT_EMAIL`, and optionally `CORE_FEATURE_SLUG`. README says: “Change these first.” |
| **“Where to start coding” doc** | Short doc (e.g. in `docs/` or README) that points to: (1) the core feature module (e.g. `features/calculator/` or the config that defines it), (2) the config for product identity, (3) where to add new “feature types” or replace the feature. So adopters aren’t hunting. |
| **Optional: `bun run setup` or `scripts/setup.sh`** | If useful: create `.env` from example, run generate/migrate, print “Next: set APP_NAME in … and run `bun dev`.” |

These are in addition to the technical renames (generic usage model, permissions, etc.); they ensure that once the renames are done, adopters get a **smooth first run** and know where to focus.

---

## Current State (Summary)

| Area | Current | Template-ready? |
|------|---------|------------------|
| **Branding** | `APP_NAME = "YourApp"` in one place; many hardcoded “YourApp” in components | Partial |
| **Main feature** | Single feature: `features/calculator/` (calculator-only) | No |
| **Routes** | `/calculator`, `/api/calculator/*` | No (calculator-specific) |
| **Database** | `CalculatorUsage`, `calculator_usage` | No |
| **Permissions** | `calculator-permissions.ts`, “calculations per month” | No |
| **Copy** | 143+ keys reference YourApp/calculators/financial | No (needs topic-agnostic keys + example set) |
| **Docs** | “YourApp financial calculator SaaS” everywhere | No |

---

## Changes by Category

### 1. Branding & Product Identity

**Objective:** One source of truth for app name, description, support email; no hardcoded brand in UI.

| Task | Details |
|------|---------|
| **Expand app constants** | In `project/shared/constants/app.constants.ts`: add `APP_TAGLINE`, `SUPPORT_EMAIL`, and optionally `PRODUCT_TOPIC` (e.g. `"calculator"`). Keep defaults as YourApp so existing behavior is unchanged. |
| **Remove hardcoded brand** | Replace every literal `"YourApp"` (and product-specific taglines) with `APP_NAME` / `APP_DESCRIPTION` or translation keys that resolve from config. **Files to update:** `footer-custom.tsx`, `navbar.tsx`, `subscription-success.tsx`, `about/page.tsx`, `manifest.ts`, any other components that reference the product by name. |
| **Use constants in SEO/manifest** | Ensure `metadata.ts`, `structured-data.ts`, and `manifest.ts` use only `app.constants` (or i18n) for site name and descriptions. |

**Files to touch (examples):**

- `project/shared/constants/app.constants.ts`
- `project/shared/components/layout/footer-custom.tsx`
- `project/shared/components/layout/navbar.tsx`
- `project/features/payments/components/success/subscription-success.tsx`
- `project/app/(public)/about/page.tsx`
- `project/app/manifest.ts`
- `project/shared/services/seo/metadata.ts`
- `project/shared/services/seo/structured-data.ts`

---

### 2. Generic “Core Product” Concept

**Objective:** Introduce a generic concept (e.g. “core feature” or “app tools”) so the codebase and docs aren’t tied to the word “calculator.”

| Task | Details |
|------|---------|
| **Define template terminology** | Pick one term for the main product area used in code and docs, e.g. **“core feature”** or **“tools”**. Use it in new shared types, route config, and docs. The **default implementation** remains “calculator” (existing `features/calculator/`). |
| **Optional: feature slug config** | Add a constant or env (e.g. `CORE_FEATURE_SLUG`) with default `"calculator"` so the main app route and API prefix can be derived (e.g. `/${CORE_FEATURE_SLUG}`, `/api/${CORE_FEATURE_SLUG}/*`). This allows switching to `"tools"` or `"documents"` without renaming folders. |
| **Document the pattern** | In `docs/AI_Orchestrator/architecture/`, add a short doc: “Core feature / template topic” that explains this is the one swappable area and points to the calculator implementation as the default. |

**Decision:** Either (A) keep URL/API as `/calculator` and treat “calculator” as the default implementation name, or (B) introduce a configurable slug and route by config. (B) is more flexible but requires more refactors (see Routes below).

---

### 3. Data Model (Usage / History)

**Objective:** Rename usage/history so it’s not tied to “calculator”; keep one table for “feature usage” that can represent calculations, document runs, tool runs, etc.

| Task | Details |
|------|---------|
| **Rename model and table** | `CalculatorUsage` → e.g. `FeatureUsage` (or `ToolUsage`). Table: `calculator_usage` → `feature_usage`. Field `calculationType` → `featureType` (or keep name but document it as “feature/tool type”). |
| **Schema migration** | Add Prisma migration: rename model, table, and column; preserve indexes and relations. Update `User` relation from `CalculatorUsages` to e.g. `FeatureUsages`. |
| **Update all references** | Prisma client usage, API routes, admin queries, and any TypeScript types that reference `CalculatorUsage` / `calculationType`. |
| **Keep default semantics** | For the default (calculator) implementation, `featureType` values stay as `"mortgage"`, `"loan"`, `"investment"`, `"retirement"`. New topics would use their own type values. |

**Files to touch (examples):**

- `project/infrastructure/database/prisma/schema.prisma`
- `project/app/api/calculator/calculate/route.ts` (and other calculator API routes)
- `project/app/api/calculator/usage/route.ts`
- `project/app/api/calculator/history/route.ts`
- `project/app/api/calculator/export/route.ts`
- Any admin or reporting code that queries usage.

---

### 4. Routes & API Paths

**Objective:** Make the main app route and API prefix configurable or at least clearly “the core feature” so another topic can replace them without confusion.

| Task | Details |
|------|---------|
| **Option A – Keep `/calculator`** | Leave paths as-is. Document that “calculator” is the default core-feature slug; another topic would replace the feature module and optionally add a redirect or second route (e.g. `/tools`). Minimal change. |
| **Option B – Configurable slug** | Introduce `CORE_FEATURE_SLUG` (default `"calculator"`). Build main app route and API prefix from it: `app/(customer)/(main)/[slug]/`, `app/api/[slug]/`. Move current calculator pages and API routes under that dynamic segment. More refactor, maximum flexibility. |
| **Internal references** | Replace hardcoded `/calculator` and `/api/calculator` in code (e.g. manifest, links, `authenticatedFetch` URLs) with a shared constant or helper (e.g. `getCoreFeaturePath()`) so changing the slug only touches one place. |

**Recommended for v1:** Option A + a single constant for “main app path” and “api prefix” (e.g. in `app.constants.ts`) so links and API calls don’t scatter magic strings. Option B can be a later phase.

---

### 5. Permissions & Tier Limits

**Objective:** Generalize “calculator access” and “calculations per month” so tiers can gate “core feature” access and “usage per month” for any topic.

| Task | Details |
|------|---------|
| **Rename permission module** | `calculator-permissions.ts` → e.g. `core-feature-permissions.ts` (or `feature-permissions.ts`). Export functions with generic names, e.g. `hasFeatureAccess(tier, featureType)`, `isFeatureFree(featureType)`, and keep the same logic. |
| **Config-driven feature list** | Keep a single config (current `CALCULATOR_CONFIG` or a renamed `CORE_FEATURE_CONFIG`) that defines feature types, tier requirements, and metadata. For the template, this config is the “core feature” config; calculator is just the default content. |
| **Subscription constants** | In `subscription.constants.ts` and tier config, rename or document “calculations per month” as “usage units per month” or “core feature usage limit” so wording is topic-agnostic. Implementation can stay (limits applied the same way). |
| **Update call sites** | Replace `hasCalculatorAccess`, `isCalculatorFree`, and any “calculator” wording in permission call sites with the new function names and, where shown to users, with i18n keys. |

**Files to touch (examples):**

- `project/shared/utils/permissions/calculator-permissions.ts` (rename + generalize)
- `project/features/calculator/constants/calculator.constants.ts` (optional rename to `core-feature.constants.ts` or keep and document as “default implementation config”)
- `project/app/api/calculator/calculate/route.ts`
- `project/app/api/calculator/types/route.ts`
- `project/app/api/admin/subscriptions/route.ts`
- `project/features/calculator/hooks/use-calculator.ts`
- `project/features/account/components/usage-dashboard.tsx`
- Any component that shows “calculation limit” or “calculations per month” (use translation keys).

---

### 6. Feature Module Structure

**Objective:** Keep the default implementation as “calculator” but structure and name things so it’s clearly one implementation of the “core feature” concept.

| Task | Details |
|------|---------|
| **Keep or rename feature folder** | Either keep `features/calculator/` as the default implementation (recommended for v1) or rename to something like `features/core-feature/` with an internal `implementations/calculator/` or similar. Latter is a larger refactor. |
| **Document the contract** | Add a short doc (e.g. in `features/calculator/README.md` or under `docs/AI_Orchestrator/architecture/domain/`) that describes: what the core feature module must provide (config, types, service, API routes, permission checks), and that the calculator is the reference implementation. |
| **Shared component mapping** | The component map (e.g. `calculator-component-map.tsx`) can stay calculator-specific; document that “adding another topic” means providing a new config and component map for that topic (or a separate feature module that fulfills the same contract). |

**Recommendation:** Keep `features/calculator/` as-is for the roadmap; focus on generic naming in **shared** layer (permissions, usage model, constants) and in **docs**. A second topic can be added later as `features/documents/` or similar, reusing the same usage model and permission pattern.

---

### 7. Copy & Internationalization (i18n)

**Objective:** No product name or topic (“YourApp”, “calculator”, “financial”) hardcoded in UI; all from config or translations so a new topic only swaps config + translation set.

| Task | Details |
|------|---------|
| **Topic-agnostic keys** | Introduce generic keys where possible, e.g. `app.name`, `app.tagline`, `core_feature.title`, `core_feature.usage_limit_label`, `core_feature.usage_units` (e.g. “calculations” vs “documents” vs “exports”). Keep existing keys as the default (calculator) set. |
| **Use app constants in i18n** | If the build or i18n setup allows, inject `APP_NAME` / `APP_DESCRIPTION` into a small set of “brand” keys so one config change updates the whole app. Otherwise, document that “replace en.json with your topic’s copy” is the template workflow. |
| **Audit hardcoded strings** | Search for “YourApp”, “calculator”, “calculation”, “financial” in `project/` (TS/TSX/JSON) and replace with translation keys or constants. |
| **Example translation set** | Provide (or document) an example `en.calculator.json` or an “example topic” so new adopters can copy and adapt for their topic. |

**Files to touch (examples):**

- `project/translations/en.json` (and any other locales)
- Any component that still contains literal product or feature names.

---

### 8. Documentation

**Objective:** Docs describe the project as a **template** with a **default implementation** (calculator), not as “the YourApp product.”

| Task | Details |
|------|---------|
| **Overview & index** | In `docs/AI_Orchestrator/overview.md` and `index.md`: lead with “SaaS template” and “configurable core feature”; then “Default implementation: financial calculators (YourApp-style).” |
| **Architecture guide** | In `architecture-guide.md`: change “YourApp-specific” to “Template default / example implementation” or “Domain (example: calculator).” |
| **Domain docs** | In `architecture/domain/README.md` and domain docs: frame as “Example domain: calculator SaaS” and point to template roadmap for “how to change the topic.” |
| **Calculator system doc** | In `calculator-system.md`: add a short “Template context” section: “This describes the default core-feature implementation (calculators). For a different topic, replace this module and config; see [Template Roadmap](../template-roadmap.md).” |
| **Link roadmap** | Add a link to `docs/template-roadmap.md` from the main AI_Orchestrator index and from the architecture README. |

**Files to touch (examples):**

- `docs/AI_Orchestrator/index.md`
- `docs/AI_Orchestrator/overview.md`
- `docs/AI_Orchestrator/architecture-guide.md`
- `docs/AI_Orchestrator/architecture/domain/README.md`
- `docs/AI_Orchestrator/architecture/domain/calculator-system.md`
- `docs/AI_Orchestrator/architecture/README.md` (if it exists)

---

## Phases (Suggested Order)

| Phase | Focus | Outcome |
|-------|--------|---------|
| **0. Adopter onboarding** | README “Using this template,” `.env.example`, single template config, “Where to start coding” doc (or section in README) | Pull → configure → run is clear; adopters know where to build their feature |
| **1. Branding** | Single source of truth for app name/description; remove hardcoded “YourApp” from UI and metadata | One config to change product identity |
| **2. Docs** | Rewrite overview and architecture docs as “template + default implementation” | New adopters see it as a template |
| **3. Permissions & config** | Generic permission module and “core feature” config; optional `CORE_FEATURE_SLUG` | Tier/limits and feature list are topic-agnostic in naming |
| **4. Data model** | Rename `CalculatorUsage` → `FeatureUsage`, add migration, update all references | Usage/history works for any topic |
| **5. Routes (optional)** | Introduce path constants or configurable slug; centralize links/API base | Easier to add or rename main app route |
| **6. i18n** | Topic-agnostic keys, audit strings, example translation set | Copy can be swapped per topic |

Phase 0 can be done first (or in parallel with 1–2) so that even before all renames are done, new users get a clear path. Phases 1–2 and 3–4 can be done in parallel by different people; 5–6 can follow once 1–4 are stable.

---

## Checklist (High Level)

Use this to track progress.

- [x] **Adopter onboarding (pull and start working)**
  - [x] README has a “Using this template” section: clone → env → config → install → migrate → dev
  - [x] README or short doc lists “what’s included” (common stuff) and “where to add your feature”
  - [x] `.env.example` exists with all required vars, placeholders, and brief comments
  - [x] Single “template config” file for app name, tagline, support email (and optional slug); README points to it
  - [x] “Where to start coding” doc or README section: core feature module, identity config, how to add/replace feature types
- [x] **Branding**
  - [x] Expand `app.constants.ts` (name, description, tagline, optional topic/slug)
  - [x] Remove all hardcoded “YourApp” (and product taglines) from components and pages
  - [x] SEO/manifest use only constants or i18n
- [x] **Documentation**
  - [x] Overview and index describe project as template with default (calculator) implementation
  - [x] Architecture guide and domain README use “template / example domain” wording
  - [x] Calculator system doc references template roadmap; link roadmap from index
- [x] **Permissions**
  - [x] Generic permission module (`core-feature-permissions.ts`) and function names (`hasFeatureAccess`, `isFeatureFree`, etc.)
  - [x] All call sites updated to use core-feature-permissions
- [x] **Data model**
  - [x] Prisma: `CalculatorUsage` → `FeatureUsage`, table `feature_usage`, column `feature_type`, `usage_time_ms`
  - [x] Migration created (`20260214000000_rename_calculator_usage_to_feature_usage`); run `bun run db:migrate` after pull
  - [x] All Prisma and type references updated
- [x] **Routes**
  - [x] Main app path and API prefix from `app.constants.ts` (`CORE_FEATURE_PATH`, `CORE_FEATURE_API_PREFIX`)
  - [x] No hardcoded `/calculator` or `/api/calculator` in app code (links and API calls use constants)
- [x] **i18n**
  - [x] “Where to start coding” doc includes i18n section; app name from constants
  - [ ] Audit and replace remaining hardcoded topic/product strings in translations (optional)
  - [ ] Example translation set or instructions for new topic (optional)

---

## Double-check: 100% template-ready (Feb 2026)

A full pass was done to ensure the project can be switched from “YourApp” to another product (e.g. ResumeHelper) without leftover product-specific code:

| Area | Status | Notes |
|------|--------|--------|
| **app.constants.ts** | ✅ | Single place for APP_NAME, APP_DESCRIPTION, APP_TAGLINE, SUPPORT_EMAIL, SUPPORT_PHONE, CORE_FEATURE_SLUG. |
| **Components / pages** | ✅ | No hardcoded "YourApp" or support email; use constants or i18n. |
| **SEO / structured-data** | ✅ | Uses APP_NAME, SUPPORT_EMAIL, SUPPORT_PHONE; address is generic ("123 Example Street"). |
| **docker-compose.yml** | ✅ | Container/network names and default DB are generic (`template_*`, `POSTGRES_DB=template`). |
| **Order-confirmation email** | ✅ | HTML template uses `{{APP_NAME}}`, `{{SUPPORT_EMAIL}}`, `{{SUPPORT_PHONE}}`; resend.ts injects from app.constants. |
| **Routes / API paths** | ✅ | Use CORE_FEATURE_PATH and CORE_FEATURE_API_PREFIX; no hardcoded `/calculator` in app code. |
| **Translations (en.json)** | By design | Contains "YourApp" and calculator copy; adopters replace for their product. |
| **Docs** | ✅ | Describe project as template with default (calculator) implementation; [Quick swap](#quick-swap-your-app--resumehelper-or-any-product) section added. |

Result: one config file + translations + optional feature-module swap is enough to go from YourApp to ResumeHelper (or any product).

---

## Templatization audit (code complete)

Code-side branding and config are now driven by a single source of truth:

- **`app.constants.ts`** – Only place with default "YourApp" / support@your-app.com / support phone; all components and pages use `APP_NAME`, `APP_DESCRIPTION`, `APP_TAGLINE`, `SUPPORT_EMAIL`, `SUPPORT_PHONE`, `CORE_FEATURE_PATH`, `CORE_FEATURE_API_PREFIX` from here.
- **Components** – `contact-info.tsx`, `order-detail-modal.tsx`, terms/privacy/contact pages use `SUPPORT_EMAIL`; no hardcoded support email in code.
- **SEO** – `metadata.ts` uses `APP_NAME` for site/twitter; production fallback URL is `https://example.com`; adopters set `NEXT_PUBLIC_BASE_URL`. `structured-data.ts` uses `SUPPORT_PHONE` and `SUPPORT_EMAIL` from app.constants (no hardcoded phone/address).
- **CORS** – `envUtil.ts` default origins are `http://localhost:3000` and `https://example.com`; adopters set `CORS_ALLOWED_ORIGINS`.
- **Tests** – `jest.setup.js` uses DB name `template_test`; subscription.constants comment points to `core-feature-permissions.ts`.
- **Docker** – `docker-compose.yml` uses generic names: `template_db`, `template_redis`, `template_app`, `template-network`, default `POSTGRES_DB=template`. No product-specific container or network names.
- **Email** – `public/templates/order-confirmation.html` uses placeholders `{{APP_NAME}}`, `{{SUPPORT_EMAIL}}`, `{{SUPPORT_PHONE}}`; `resend.ts` injects them from `app.constants.ts`.

**Translations** (`en.json`) still contain "YourApp" and calculator copy by design; adopters replace or edit that file for their product.

---

## Quick swap: YourApp → ResumeHelper (or any product)

To turn this template into a different product (e.g. ResumeHelper, DocFlow) with minimal friction:

1. **Identity (one file)** – In `project/shared/constants/app.constants.ts` set: `APP_NAME`, `APP_DESCRIPTION`, `APP_TAGLINE`, `SUPPORT_EMAIL`, `SUPPORT_PHONE`. Optionally set `CORE_FEATURE_SLUG` (e.g. `"resumes"`) and add matching routes (see [Where to start coding](where-to-start-coding.md) §4).
2. **Copy** – Replace or edit `project/translations/en.json` with your product’s name, tagline, and feature copy. Search for "YourApp" / "calculator" in that file and update.
3. **Core feature** – Either keep the default calculator implementation and tweak it, or replace `features/calculator/` (or add a new feature module and wire routes). Reuse the same usage model and permissions; see [Where to start coding](where-to-start-coding.md) §4.

No need to hunt for brand strings in code: app constants and the email template are driven by `app.constants.ts`; the rest is translations and your feature module.

**For a full file-by-file checklist and the exact “core feature contract” (what to implement when replacing the default), see the [Core Feature Swap Expert](AI_Orchestrator/roles/core-feature-swap-expert.md) role in `docs/AI_Orchestrator/roles/`.**

---

## After the Roadmap

Once the above is done:

- **New team pulls the template:** They follow README → copy env, set app name in one file, run install/migrate/dev. They see a running app with common stuff (auth, billing, admin) ready and one obvious place to build their core feature.
- **To ship “YourApp” as-is:** Keep default config and calculator implementation; no further renames required.
- **To add a second topic:** Implement a new feature module (and optionally a new translation set), reuse `FeatureUsage`, shared permissions, and tier limits; add route(s) or swap the default slug if using Option B for routes.
- **To replace calculator entirely:** Swap the core-feature config and component map (or feature module), update translations and app constants, and optionally point the main route to the new module.

---

*Last updated: February 2026*
