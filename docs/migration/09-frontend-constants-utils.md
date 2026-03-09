# Frontend Constants & Utilities Migration

---

## `src/shared/constants/app.constants.ts` ✅ DONE

Updated in this session. Current state:
```ts
APP_NAME = "ReelStudio"
APP_DESCRIPTION = "Discover viral reels, decode what works, and generate content that performs"
APP_TAGLINE = "Turn viral reels into your content strategy"
SUPPORT_EMAIL = "support@reelstudio.ai"
CORE_FEATURE_SLUG = "studio"
CORE_FEATURE_PATH = "/studio/discover"
CORE_FEATURE_API_PREFIX = "/api/reels"
```

**No further changes needed.**

---

## `src/shared/constants/subscription.constants.ts`

**Current state**: Defines the 3 subscription tiers (basic, pro, enterprise) with feature lists. Feature lists almost certainly list calculator types.

**What to read**: Open the file and find the `features: []` array for each tier.

**What to change**: Replace calculator feature lists with ReelStudio features:

```ts
// BEFORE (example)
basic: {
  features: ["Mortgage Calculator", "Basic PDF Export", "10 calculations/day"]
}

// AFTER
basic: {
  features: [
    "10 reel scans per day",
    "5 AI analyses per day",
    "3 content generations per day",
    "Queue up to 5 items"
  ]
}

pro: {
  features: [
    "Unlimited reel scans",
    "Unlimited AI analysis",
    "50 content generations per day",
    "Queue up to 25 items",
    "Advanced analytics",
    "Priority support"
  ]
}

enterprise: {
  features: [
    "Everything in Pro",
    "Unlimited content generation",
    "Unlimited queue",
    "Instagram publishing",
    "API access",
    "Team workspace",
    "Dedicated support"
  ]
}
```

---

## `src/shared/constants/stripe.constants.ts`

**Current state**: Stripe product IDs and price IDs. May also contain plan names/descriptions.

**What to read**: Open file and check for any product name strings.

**What to change**:
- Product names if hardcoded: "CalcPro Basic" → "ReelStudio Basic", etc.
- Price IDs: These come from Stripe dashboard — if they reference old product names in the variable names, rename the variables (e.g., `CALC_PRO_BASIC_PRICE_ID` → `REELSTUDIO_BASIC_PRICE_ID`)
- The actual Stripe price/product IDs (the `price_xxx` strings) stay the same — those are just identifiers

---

## `src/shared/constants/order.constants.ts`

**Current state**: Order status constants and possibly order type definitions.

**What to read**: Open file and check for calculator-specific order types.

**What to change**:
- If there's an `ORDER_TYPE = { CALCULATOR: "calculator_run" }` → remove or replace
- Order statuses (pending, completed, failed) stay the same

---

## `src/shared/constants/rate-limit.config.ts`

**Current state**: Rate limiting configuration.

**What to read**: Check if there are calculator-specific rate limit keys.

**What to change**:
- If there are limits like `calculator: { max: 10, window: 60000 }` → remove
- Studio rate limits should already be defined in backend — verify frontend config aligns
- No structural changes expected

---

## `src/shared/utils/permissions/core-feature-permissions.ts` ✅ MOSTLY DONE

**Current state**: Updated in previous migration. Now defines:
```ts
FeatureType = "studio" | "generation" | "queue" | "publishing"
FEATURE_TIER_REQUIREMENTS = {
  studio: null,       // free
  generation: null,   // free (rate-limited)
  queue: null,        // free (5-item cap)
  publishing: "pro"   // requires Pro
}
```

**What to verify**:
- Does the export include everything that `feature-gate.tsx` and `upgrade-prompt.tsx` need?
- Is `isFeatureFree()` working correctly for all 4 features?

**No changes expected** — just verification.

---

## `src/shared/utils/permissions/calculator-permissions.ts`

**Current state**: Stub file that re-exports from core-feature-permissions for backward compatibility. Created during previous migration.

**What to do**:
- Once all consumers of `calculator-permissions.ts` are removed, **delete this file**
- Check who imports from it: `grep -r "calculator-permissions" src/`
- After confirmed no consumers: delete

---

## `src/shared/utils/redirect/redirect-util.ts`

**Current state**: Contains `REDIRECT_PATHS` constant. Current state of the relevant key:

```ts
REDIRECT_PATHS = {
  HOME: "/",
  PRICING: "/pricing",
  ACCOUNT: "/account",
  CHECKOUT: "/checkout",
  DASHBOARD: "/account?tab=calculator",  // ← WRONG - references calculator tab
  SIGN_IN: "/sign-in",
  SIGN_UP: "/sign-up",
}
```

**What to change**:
- `REDIRECT_PATHS.DASHBOARD`: Change from `/account?tab=calculator` to `/studio/discover`
- Search for all usages of `REDIRECT_PATHS.DASHBOARD` to verify the change makes sense in context

**After-signup redirect**: Currently, after successful sign-up, users may be redirected to `DASHBOARD` which goes to the calculator tab. This should go to `/studio/discover` instead.

---

## `src/shared/utils/config/envUtil.ts` (Frontend)

**Current state**: Exposes environment variables from `import.meta.env` (VITE_ prefix).

**What to read**: Check what env vars are exposed.

**What to change**:
- Remove any `VITE_CALCULATOR_*` env vars if they exist
- Verify `VITE_API_URL` is correct
- No calculator-specific env vars expected here (calculators were server-side)

---

## `src/shared/services/seo/metadata.ts` (or similar)

**Current state**: Generates page metadata (title, description, OG tags).

**What to read**: Find the SEO service files and check for CalcPro references.

**What to change**:
- Site name: uses `APP_NAME` — already updated ✅
- Default description: uses `APP_DESCRIPTION` — already updated ✅
- Any hardcoded "financial calculator" strings → update to ReelStudio copy
- OG image: may reference a CalcPro-branded image → update to ReelStudio image (design asset needed)

---

## `src/shared/lib/query-keys.ts`

**Current state**: Defines all React Query cache keys. Updated in previous migration to add:
- `queryKeys.api.reels(niche, params)`
- `queryKeys.api.reel(id)`
- `queryKeys.api.reelAnalysis(id)`
- `queryKeys.api.generationHistory(params)`
- `queryKeys.api.queue(params)`

**What to check**:
- Are there still `queryKeys.api.calculator.*` keys? If so, remove them.
- Are all the new studio keys being used correctly?

---

## Summary

| File | Action | Priority |
|------|--------|----------|
| `app.constants.ts` | ✅ Done | — |
| `subscription.constants.ts` | Update tier feature lists | High |
| `stripe.constants.ts` | Check/update plan names | Medium |
| `order.constants.ts` | Check/remove calculator order types | Low |
| `rate-limit.config.ts` | Check/remove calculator rate limits | Low |
| `core-feature-permissions.ts` | Verify only | Low |
| `calculator-permissions.ts` | Delete when consumers removed | Medium |
| `redirect-util.ts` | Fix `DASHBOARD` path | High |
| `envUtil.ts` (frontend) | Check for calculator env vars | Low |
| SEO services | Check for hardcoded CalcPro copy | Medium |
| `query-keys.ts` | Remove calculator keys if present | Medium |
