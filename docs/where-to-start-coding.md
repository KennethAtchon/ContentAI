# Where to start coding

This doc points you to the places that matter when using the template: **product identity**, the **core feature** (your main product area), and how to **add or replace** feature types.

---

## 1. Product identity (one place)

**File:** `frontend/src/shared/constants/app.constants.ts`

Set these first so your app name and tagline appear everywhere (UI, SEO, manifest, emails):

- **APP_NAME** – Product name (e.g. "YourApp", "ResumeHelper", "DocFlow").
- **APP_DESCRIPTION** – Short description for metadata and listings.
- **APP_TAGLINE** – Tagline used in manifest and marketing.
- **SUPPORT_EMAIL** – Support/contact email.
- **SUPPORT_PHONE** – Support phone (SEO structured data and email template).
- **CORE_FEATURE_SLUG** – URL slug for the main app feature (default `"generator"`). Used to build `/generator` and `/api/generator/*`. Change to `"tools"`, `"documents"`, etc. if you build a different product.
- **CORE_FEATURE_PATH** – Derived: `/${CORE_FEATURE_SLUG}` (use for links).
- **CORE_FEATURE_API_PREFIX** – Derived: `/api/${CORE_FEATURE_SLUG}` (use for API calls).

No need to search the codebase for your product name; change this file and (where we use constants) it updates everywhere.

---

## 2. Core feature (where your main product lives)

The template ships with one **default implementation**: AI content generators.

**Location:** `frontend/src/features/generator/`

| Part | Path | Purpose |
|------|------|--------|
| **Config** | `features/generator/constants/generator.constants.ts` | Defines generator types, tier requirements, names, icons. Add or remove types here. |
| **Types** | `features/generator/types/generator.types.ts` | Input/output types per generator type. |
| **Validation** | `features/generator/types/generator-validation.ts` | Zod schemas for API validation. |
| **Service** | `features/generator/services/generator-service.ts` | Pure generation logic. |
| **Hook** | `features/generator/hooks/use-generator.ts` | Client-side: calls API, checks access, usage. |
| **Components** | `features/generator/components/` | UI for each generator (hook generator, caption generator, script generator, hashtag generator). |
| **Component map** | `features/generator/components/generator-component-map.tsx` | Maps generator type → component. |

**Routes (default slug `generator`):**

- App: `/generator` → `frontend/src/routes/(customer)/generator/`
- API: `/api/generator/*` → `backend/src/routes/generator.ts`

Permissions and usage limits are wired to this feature (see `project/shared/utils/permissions/` and subscription tier config).

---

## 3. Adding new “feature types” (same product)

Example: adding a new generator (e.g. “savings”) while keeping the same product concept.

1. **Config** – Add an entry in `generator.constants.ts` (`FEATURE_CONFIG`).
2. **Types** – Add input/output types in `generator.types.ts`.
3. **Validation** – Add a Zod schema in `generator-validation.ts`.
4. **Service** – Add a method in `generator-service.ts` and a branch in `performGeneration`.
5. **Component** – Add a component (e.g. `savings-generator.tsx`) and register it in `generator-component-map.tsx`.
6. **API** – The calculate route uses the config and validation; add a `case` for the new type in the route’s switch if needed.

Details: [Generator system – Adding new generators](AI_Orchestrator/architecture/domain/generator-system.md#adding-new-generators).

---

## 4. Replacing the core feature (different product)

**For a full step-by-step swap (e.g. to ResumeHelper), use the [Core Feature Swap Expert](AI_Orchestrator/roles/core-feature-swap-expert.md) role:** it lists every file to touch and the exact contract your new feature must fulfill.

If your product is not “generators” (e.g. document generator, image tools):

1. **Keep the same structure** – One feature module that provides:
   - A config of “feature types” (with tier requirements),
   - Types and validation,
   - A service or API layer,
   - Components and a component map (or equivalent).

2. **Option A – Replace in place**  
   - Reuse `features/generator/` (or rename the folder) and swap the config, types, service, and components for your product.  
   - Keep using the same routes (`/generator` and `/api/generator`) or change `CORE_FEATURE_SLUG` in `app.constants.ts` and add corresponding routes (e.g. `app/(customer)/(main)/tools/` and `app/api/tools/`).

3. **Option B – New feature module**  
   - Add e.g. `features/documents/` with its own config, types, service, and components.  
   - Add routes (e.g. `/tools`, `/api/tools`) and point nav and links to the new path.  
   - Reuse the same **usage and permissions** patterns: the template already has a usage model and tier-based limits; your feature just “consumes” them (see `project/shared/utils/permissions/` and subscription constants).

4. **Copy and UI** – Update `project/translations/en.json` and any hardcoded strings so the app speaks your product’s language (e.g. “documents” instead of “generations”).

---

## 5. Permissions and usage limits

- **Permissions:** `frontend/src/shared/utils/permissions/`  
  - Access to feature types is driven by subscription tier.  
  - The default implementation uses “generator” types; the same pattern applies if you add another feature (tier requirement per type, check in API and UI).

- **Usage limits:** Subscription tiers define “usage per month” (e.g. generations, documents).  
  - Config: `frontend/src/shared/constants/subscription.constants.ts` (tier features and limits).  
  - Usage is recorded in the database (usage model) and checked in the API before performing a gated action.

---

## 6. Quick reference

| I want to… | Go to… |
|------------|--------|
| Change app name / tagline / support email | `project/shared/constants/app.constants.ts` |
| Change the main app URL slug | `CORE_FEATURE_SLUG` in `app.constants.ts` |
| Add or edit a generator (or default feature) type | `features/generator/constants/generator.constants.ts` and the related types/service/components |
| Change subscription tiers or limits | `project/shared/constants/subscription.constants.ts` |
| Change marketing and UI copy | `project/translations/en.json` and public pages (see [i18n](#6-i18n-copy) below) |
| Understand the full template plan | [Template roadmap](template-roadmap.md) |

---

## 6. i18n (copy)

All user-facing strings should go through **translations** so you can switch copy per product or locale.

- **Translation file:** `frontend/src/translations/en.json`  
  Replace or add keys for your product name, tagline, feature names, and marketing copy. The template uses `react-i18next`; use `useTranslation()` in all components.
- **Product name in code:** Use `APP_NAME` and `APP_DESCRIPTION` from `app.constants.ts` instead of hardcoding; the rest can live in translations.
- **Topic-agnostic keys:** For a different product (e.g. “documents” instead of “generators”), add or replace keys such as `core_feature_title`, `core_feature_usage_label`, etc., and use them in components. The default keys are generator-oriented; you can keep them as the default set or duplicate and adapt for another topic.
