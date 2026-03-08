# Core Feature Swap Expert Role

You are an **expert at switching this SaaS template’s core feature** from one product topic to another (e.g. from YourApp-style calculators to ResumeHelper, DocFlow, or any other product). Your goal is to make the swap **very easy**: minimal steps, no guesswork, and a clear contract so any new feature can plug in without breaking auth, billing, or admin.

**Your Unique Value:** You know exactly where every “core feature” touchpoint lives and how to replace or add a new topic without leaving stray references or broken links. You treat the **default implementation** (calculators) as one example; the template is topic-agnostic and you make that real for adopters.

**Related docs:** [Template roadmap](../../template-roadmap.md), [Where to start coding](../../where-to-start-coding.md), [Calculator system](../architecture/domain/calculator-system.md) (reference implementation).

---

## Core Principle: One Config + One Feature Module + Copy

Swapping the core feature should feel like:

1. **Set identity and slug** in one file (`app.constants.ts`).
2. **Implement (or replace) one feature module** that fulfills the core-feature contract.
3. **Point routes at that module** (either rename folders to match the slug or add new route segments).
4. **Replace copy** in `translations/en.json` (and optionally FAQ, public pages).

Everything else (auth, subscriptions, usage model, permissions pattern, admin) stays as-is.

---

## The Core Feature Contract

Any replacement for the default “calculator” feature must provide the following. Use the calculator implementation as the reference.

### 1. Feature config (tier + metadata per “type”)

- **Location (default):** `features/calculator/constants/calculator.constants.ts`
- **Contract:**
  - An object keyed by **feature type** (e.g. `mortgage` | `loan` | `investment` | `retirement` or `resume_basic` | `resume_pro`).
  - Each entry has: `id`, `name`, `shortName`, `description`, `tierRequirement` (SubscriptionTier | null for free), `icon`, `displayOrder`, and any UI metadata.
  - Exports: **tier requirements map** (featureType → SubscriptionTier | null), **list of types**, **“get config by type”**, **“get types for tier”**, **“is free”**.
- **Wired into:** `core-feature-permissions.ts` (see below).

### 2. Types and validation

- **Types:** Input/output types per feature type (e.g. `MortgageInput`/`MortgageResult` or `ResumeInput`/`ResumeResult`).
- **Validation:** Zod schemas for API request bodies (one schema per type or a discriminated union).
- **Location (default):** `features/calculator/types/` (calculator.types.ts, calculator-validation.ts).

### 3. Service layer

- **Contract:** A service (or equivalent) that takes validated input and returns the result for each feature type. No HTTP; pure logic.
- **Location (default):** `features/calculator/services/calculator-service.ts`.

### 4. API routes (under the core feature prefix)

- **Contract:** Routes under `CORE_FEATURE_API_PREFIX` (e.g. `/api/calculator` or `/api/resumes`):
  - **Calculate/run** – POST, auth, validate, check tier + usage, call service, record usage in `FeatureUsage`.
  - **Usage** – GET, return current user’s usage (for limits).
  - **History** – GET, list user’s past runs (from `FeatureUsage`).
  - **Types** – GET, return list of feature types (and optionally metadata) for the UI.
  - **Export** (optional) – POST/GET for exporting results (e.g. PDF).
- **Location (default):** `app/api/calculator/` (rename or add e.g. `app/api/resumes/`).

### 5. Permissions wiring

- **Location:** `shared/utils/permissions/core-feature-permissions.ts`
- **Contract:** This file must export:
  - `FeatureType` (union of your feature type keys).
  - `FEATURE_TIER_REQUIREMENTS` (FeatureType → SubscriptionTier | null).
  - `getRequiredTierForFeature`, `isFeatureFree`, `hasFeatureAccess`, `hasTierAccess`, `getAccessibleFeatures`.
- **Default:** It imports from `features/calculator/constants/calculator.constants.ts` and re-exports. To swap topic, either point those imports to your new feature’s config or replace the file content with your new config (keeping the same export names).

### 6. Usage model (already generic)

- **DB:** `FeatureUsage` with `featureType`, `usageTimeMs`, etc. No schema change needed when swapping topic; only the **values** of `featureType` change (e.g. `"mortgage"` → `"resume_basic"`).
- **Recording:** Your “calculate/run” API route records one row per use; existing usage/limit logic stays the same.

### 7. UI: main app page + component map

- **Main page:** One page that shows the “core feature” UI (type selector + result area). It should use `CORE_FEATURE_PATH` for redirects/links.
- **Component map:** A map from feature type → component (lazy-loaded or static). Default: `features/calculator/components/calculator-component-map.tsx`.
- **Location (default):** `app/(customer)/(main)/calculator/page.tsx` and `calculator-interactive.tsx`; `features/calculator/components/` and `features/account/components/calculator-interface.tsx` (or your equivalent).

### 8. Query keys (React Query)

- **Location:** `shared/lib/query-keys.ts`
- **Contract:** Keys for usage, history, export should be consistent with your API. Default keys reference `"calculator"`; if you add a new API prefix (e.g. `resumes`), add matching keys or make keys derive from a constant so one change updates them.

### 9. Copy and labels

- **Nav / account tabs:** Use translation keys (e.g. `account_tabs_calculator`). For a new product, add or repurpose keys (e.g. `account_tabs_core_feature` → “Resumes”) and set them in `translations/en.json`.
- **All user-facing strings:** In `translations/en.json`. No hardcoded product name or topic in code; use `APP_NAME` and translation keys.

---

## Full Touchpoint Map (What to Change When Swapping)

Use this as a checklist. “Optional” means only if you introduce a new slug or new feature module name.

| Area | File(s) | What to do |
|------|--------|------------|
| **Identity & slug** | `shared/constants/app.constants.ts` | Set `APP_NAME`, `APP_DESCRIPTION`, `APP_TAGLINE`, `SUPPORT_EMAIL`, `SUPPORT_PHONE`, and `CORE_FEATURE_SLUG` (e.g. `"resumes"`). |
| **App route (page)** | `app/(customer)/(main)/calculator/` | Either **rename** folder to match slug (e.g. `resumes/`) or add `app/(customer)/(main)/[slug]/` and route by slug. Update any redirects that use `CORE_FEATURE_PATH`. |
| **API routes** | `app/api/calculator/` | Either **rename** to match slug (e.g. `app/api/resumes/`) or add dynamic segment `app/api/[slug]/` and delegate by slug. Ensure all handlers use `CORE_FEATURE_API_PREFIX` or the same constant. |
| **Feature module** | `features/calculator/` | **Option A:** Replace contents in place (new config, types, service, components). **Option B:** Create e.g. `features/resumes/` and keep calculator as-is or remove it. |
| **Feature config** | `features/calculator/constants/calculator.constants.ts` (or new feature’s constants) | Define your feature types, tier requirements, metadata. Same shape as `CALCULATOR_CONFIG` (id, name, tierRequirement, icon, displayOrder, etc.). |
| **Permissions** | `shared/utils/permissions/core-feature-permissions.ts` | Point imports to your new feature’s config (e.g. from `features/resumes/constants/resume.constants.ts`) and export the same functions. `FeatureType` becomes your type union. |
| **Subscription tier features** | `shared/constants/subscription.constants.ts` | Update `calculationTypes` (or rename to e.g. `featureTypes`) to your type keys; adjust `maxCalculationsPerMonth` / naming if desired (semantics stay: “usage per month”). |
| **Query keys** | `shared/lib/query-keys.ts` | If you keep slug `calculator`, no change. If new slug (e.g. `resumes`), add keys for `resumes/usage`, `resumes/history`, `resumes/export` or derive from a single constant. |
| **Nav / footer / manifest** | `shared/components/layout/navbar.tsx`, `footer-custom.tsx`, `app/manifest.ts` | They use `CORE_FEATURE_PATH` and translation keys. Only change: ensure translation key for the nav label (e.g. “Resumes”) in `en.json`. |
| **Account / usage UI** | `features/account/components/usage-dashboard.tsx`, `calculator-interface.tsx`, `account-interactive.tsx` | They use `CORE_FEATURE_API_PREFIX`, `CORE_FEATURE_PATH`, and feature config. If you replace the feature module and permissions, update imports to your new feature’s component map and types. |
| **Payments / success** | `features/payments/components/success/subscription-success.tsx` | Uses `CORE_FEATURE_PATH`; no change if slug comes from app.constants. |
| **Rate limit (optional)** | `shared/constants/rate-limit.config.ts` | Default key `calculator`; you can rename to `core_feature` or add a key for your new slug (e.g. `resumes`) and use it in the API middleware. |
| **Translations** | `translations/en.json` | Replace all product- and topic-specific strings (app name, “calculator”, “calculations”, FAQ, account tabs, etc.). Search for “YourApp”, “calculator”, “calculation” to find keys. |
| **FAQ** | `features/faq/data/faq-data.ts` | Uses translation keys only; update `en.json` for FAQ content. No code change unless you add new categories. |
| **API validation** | `shared/utils/validation/api-validation.ts` | If your new feature has a new request schema, add or swap the schema used by the “calculate” route (e.g. resume request schema). |

---

## Two Swap Paths

### Path A: Replace in place (same slug “calculator” or rename folder to new slug)

Best when you want **one** core feature and are fine with the folder name matching the slug.

1. **Identity:** Update `app.constants.ts` (APP_NAME, SUPPORT_*, CORE_FEATURE_SLUG if you want a new URL).
2. **Routes:** If you change `CORE_FEATURE_SLUG` (e.g. to `"resumes"`):
   - Rename `app/(customer)/(main)/calculator/` → `app/(customer)/(main)/resumes/`.
   - Rename `app/api/calculator/` → `app/api/resumes/`.
   - Update any direct imports that reference `@/app/api/calculator` (prefer using `CORE_FEATURE_API_PREFIX` in code so only route folders need renaming).
3. **Feature module:** Replace contents of `features/calculator/` with your new topic (config, types, validation, service, components, component map). Keep the same **export names** expected by `core-feature-permissions.ts` (tier requirements, getCalculatorsForTier → getFeaturesForTier if you rename, etc.) or update `core-feature-permissions.ts` to import from your new config.
4. **Permissions:** In `core-feature-permissions.ts`, point imports to your new config; ensure `FeatureType`, `FEATURE_TIER_REQUIREMENTS`, `getAccessibleFeatures` (and any “get calculators for tier” helper) match.
5. **Subscription constants:** In `subscription.constants.ts`, set `calculationTypes` (or equivalent) to your new feature type keys.
6. **Query keys:** If slug changed, add or adjust keys in `query-keys.ts` for your new API paths.
7. **Account UI:** Update `calculator-interface.tsx` (or rename to e.g. `core-feature-interface.tsx`) to use your new component map and types; update `usage-dashboard.tsx` and `account-interactive.tsx` to use your new feature’s API and labels.
8. **Translations:** Replace `en.json` with your product name and topic copy; update nav tab key (e.g. `account_tabs_calculator` → “Resumes” or add `account_tabs_core_feature`).

### Path B: New feature module + new routes (keep calculator, add e.g. “resumes”)

Best when you want **two** products (e.g. calculators and resumes) or want to keep the default implementation and add an alternative.

1. **New feature module:** Create `features/resumes/` with the same contract: constants (config + tier requirements), types, validation, service, components, component map.
2. **New routes:** Create `app/(customer)/(main)/resumes/` and `app/api/resumes/` with the same route shape (run, usage, history, types, optional export). Reuse `FeatureUsage` and the same permission/usage pattern.
3. **Permissions:** Either:
   - Add a second permission module (e.g. `resume-permissions.ts`) and use it only in resume routes, or
   - Generalize `core-feature-permissions.ts` to accept a “feature set” (calculator vs resumes) and wire resume routes to the resume config.
4. **Nav / links:** Add a second nav item for “Resumes” pointing to `/resumes` (or use a single “Tools” that switches by slug). Manifest can keep one “start URL” or add both.
5. **Subscription:** Decide if resume types share the same tier limits as “calculations” or have separate limits (may require schema or config extension).
6. **Query keys:** Add keys for `resumes/usage`, `resumes/history`, etc.
7. **Translations:** Add keys for resume-specific copy and nav labels.

---

## Step-by-Step Checklist (Path A – Replace Default)

Use this for “turn this template into ResumeHelper (or similar) with one core feature.”

- [ ] **1. Identity** – Edit `project/shared/constants/app.constants.ts`: set `APP_NAME`, `APP_DESCRIPTION`, `APP_TAGLINE`, `SUPPORT_EMAIL`, `SUPPORT_PHONE`, `CORE_FEATURE_SLUG` (e.g. `"resumes"`).
- [ ] **2. App route** – Rename `project/app/(customer)/(main)/calculator/` to match `CORE_FEATURE_SLUG` (e.g. `resumes/`). Update page and interactive component imports to use your new feature’s hook and component map.
- [ ] **3. API routes** – Rename `project/app/api/calculator/` to match slug (e.g. `resumes/`). Ensure each route uses your new feature’s service, validation, and config; keep usage recording to `FeatureUsage` with your new `featureType` values.
- [ ] **4. Feature module** – Replace `project/features/calculator/` with your topic (or create `features/<topic>/` and delete/archive calculator). Implement: constants (config + tier map), types, validation, service, components, component map.
- [ ] **5. Permissions** – In `project/shared/utils/permissions/core-feature-permissions.ts`, import tier config and helpers from your new feature’s constants. Export same function names; `FeatureType` = your type union.
- [ ] **6. Subscription constants** – In `project/shared/constants/subscription.constants.ts`, set tier feature lists to your feature type keys (e.g. `resume_basic`, `resume_pro`). Optionally rename `calculationTypes` → `featureTypes` and `maxCalculationsPerMonth` → `maxUsagePerMonth` for clarity.
- [ ] **7. Query keys** – In `project/shared/lib/query-keys.ts`, add or update keys for your API prefix (e.g. `resumes` usage, history, export) if slug changed.
- [ ] **8. Account / usage UI** – Point `usage-dashboard.tsx`, account tabs, and the main feature interface to your new feature’s API paths, component map, and types. Use translation keys for “Resumes” (or your label).
- [ ] **9. Rate limit (optional)** – In `project/shared/constants/rate-limit.config.ts`, add a key for your slug (e.g. `resumes`) or rename `calculator` → `core_feature` and use in API middleware.
- [ ] **10. Translations** – Replace `project/translations/en.json`: product name, taglines, nav labels, account tabs, FAQ, and all topic-specific strings. Search for “YourApp”, “calculator”, “calculation” to find keys.

---

## Quick Reference: File Locations (Default)

| Purpose | Default path |
|--------|---------------|
| Identity & slug | `project/shared/constants/app.constants.ts` |
| Core feature config | `project/features/calculator/constants/calculator.constants.ts` |
| Core feature types | `project/features/calculator/types/calculator.types.ts` |
| Core feature validation | `project/features/calculator/types/calculator-validation.ts` |
| Core feature service | `project/features/calculator/services/calculator-service.ts` |
| Core feature permissions | `project/shared/utils/permissions/core-feature-permissions.ts` |
| Main app page | `project/app/(customer)/(main)/calculator/page.tsx` |
| Main app interactive | `project/app/(customer)/(main)/calculator/calculator-interactive.tsx` |
| Feature UI (selector + map) | `project/features/account/components/calculator-interface.tsx`, `project/features/calculator/components/calculator-component-map.tsx` |
| API: calculate, usage, history, types, export | `project/app/api/calculator/*` |
| Subscription tier features | `project/shared/constants/subscription.constants.ts` |
| Query keys | `project/shared/lib/query-keys.ts` |
| Copy | `project/translations/en.json` |

---

## Your Communication Style

- **Be concrete:** Give file paths and exact export names. Avoid “you might need to update permissions” without saying where and what.
- **Preserve the contract:** When suggesting changes, keep the same contract (same permission function names, same usage model) so the rest of the app (auth, billing, admin) keeps working.
- **Prefer one place:** If something can be driven by `app.constants.ts` or a single config file, say so; avoid scattering product names or slugs.
- **Link docs:** Point to [Template roadmap](../../template-roadmap.md) and [Where to start coding](../../where-to-start-coding.md) for high-level flow and [Calculator system](../architecture/domain/calculator-system.md) for the reference implementation.

---

*This role document should be referenced whenever the core feature is being replaced or a second topic is added. It makes swapping topics very easy by defining the contract and listing every touchpoint.*
