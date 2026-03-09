# Backend Migration Plan

---

## Critical: Brand Mismatch

The backend still identifies itself as **CalcPro**. This affects:
- Email templates (sent via Resend)
- API error messages
- Admin notifications
- Stripe webhook descriptions

**File**: `backend/src/constants/app.constants.ts`

```ts
// CURRENT (WRONG)
APP_NAME = "CalcPro"
APP_DESCRIPTION = "Professional financial calculators for modern businesses"
SUPPORT_EMAIL = "support@calcpro.com"
CORE_FEATURE_SLUG = "calculator"
CORE_FEATURE_PATH = "/calculator"
CORE_FEATURE_API_PREFIX = "/api/calculator"

// SHOULD BE
APP_NAME = "ReelStudio"
APP_DESCRIPTION = "Discover viral reels, decode what works, and generate content that performs"
SUPPORT_EMAIL = "support@reelstudio.ai"
CORE_FEATURE_SLUG = "studio"
CORE_FEATURE_PATH = "/studio/discover"
CORE_FEATURE_API_PREFIX = "/api/reels"
```

---

## Calculator Feature — What To Do

The calculator feature is a complete, working implementation:
- `backend/src/features/calculator/` — 6 files
- `backend/src/routes/calculator/index.ts` — mounted route
- Referenced in `backend/src/index.ts` as `app.route("/api/calculator", calculatorRoutes)`

### Decision: Remove or Keep?

**Recommendation: Remove entirely.**

Reasons:
1. No frontend UI for it (calculator-interface.tsx is a dead stub)
2. Confuses the product identity
3. The calculator API endpoints return data no frontend component consumes
4. Keeping dead code creates maintenance overhead

**Exception**: The `featureUsages` database table was used for calculator tracking. It's now generic enough to track ReelStudio usage too. Keep the TABLE but the calculator-specific usage data it contains can be ignored.

---

## Files to DELETE (Calculator)

```
backend/src/features/calculator/services/calculator-service.ts
backend/src/features/calculator/services/usage-service.ts
backend/src/features/calculator/types/calculator.types.ts
backend/src/features/calculator/types/calculator-validation.ts
backend/src/features/calculator/constants/calculator.constants.ts
backend/src/routes/calculator/index.ts
```

After deletion:
- Remove the directory: `backend/src/features/calculator/`
- Remove the directory: `backend/src/routes/calculator/`

---

## Files to UPDATE

### `backend/src/index.ts`

**What to change**:
- Remove: `import calculatorRoutes from "./routes/calculator"`
- Remove: `app.route("/api/calculator", calculatorRoutes)`
- Verify all 3 new routes are mounted:
  ```ts
  app.route("/api/reels", reelsRoutes);
  app.route("/api/generation", generationRoutes);
  app.route("/api/queue", queueRoutes);
  ```

---

### `backend/src/constants/app.constants.ts`

Update as shown above (brand mismatch fix).

---

### `backend/src/utils/permissions/core-feature-permissions.ts` ✅ DONE

**Current state**: Already updated to studio feature types.
```ts
FeatureType = "studio" | "generation" | "queue" | "publishing"
```
No further changes needed.

---

### `backend/src/utils/permissions/calculator-permissions.ts`

**Current state**: Stub re-exporting from core-feature-permissions.

**What to do**:
- Find all consumers: `grep -r "calculator-permissions" backend/src/`
- If no consumers remain after removing calculator routes: **delete this file**

---

### `backend/src/routes/analytics/index.ts`

**Current state**: Analytics endpoints — likely includes a calculator-specific analytics endpoint.

**What to read**: Open and audit all endpoints.

**What to change**:
- Remove: any `/api/analytics/calculator` or `/api/analytics/calculations` endpoints
- Ensure: the dashboard analytics endpoint returns ReelStudio metrics (reels scanned, content generated, etc.)
- The admin dashboard needs at least:
  - Total reels in DB
  - Total analyses performed
  - Total content generated
  - Active users (existing)
  - Revenue (existing)

---

### `backend/src/routes/public/index.ts`

**Current state**: Public endpoints — contact form, maybe a types endpoint.

**What to check**:
- Is there a `/api/public/calculator-types` or similar? If so, remove.
- The contact form endpoint `/api/public/contact` → keep

---

### `backend/src/constants/subscription.constants.ts`

**Current state**: Tier definitions. May have calculator-specific feature lists if they're used in API responses.

**What to check**:
- Are feature lists used in API responses? (e.g., what the `/api/subscriptions` endpoint returns about tier features)
- If yes: update feature lists to ReelStudio features (same changes as frontend subscription.constants.ts)

---

### `backend/src/utils/config/envUtil.ts` ✅ DONE (partially)

**Current state**: Added in previous migration:
- `ANTHROPIC_API_KEY`
- `ANALYSIS_MODEL` (default: `claude-haiku-4-5-20251001`)
- `GENERATION_MODEL` (default: `claude-sonnet-4-6`)
- `REEL_SOURCE`
- `SOCIAL_API_KEY`
- `INSTAGRAM_API_TOKEN`
- `VIRAL_VIEWS_THRESHOLD`

**What to verify**: No calculator-specific env vars remaining.

---

## New Backend Files (Already Created) ✅

These were created in the previous migration and should be working:

### Routes
- `backend/src/routes/reels/index.ts`
- `backend/src/routes/generation/index.ts`
- `backend/src/routes/queue/index.ts`

### Services
- `backend/src/services/reels/reel-analyzer.ts`
- `backend/src/services/reels/content-generator.ts`
- `backend/src/lib/claude.ts`

### Prompts
- `backend/src/prompts/reel-analysis.txt`
- `backend/src/prompts/remix-generation.txt`
- `backend/src/prompts/hook-writer.txt`

### Scripts
- `backend/src/scripts/seed-mock-reels.ts`

**What to verify for each**:
1. `backend/src/routes/reels/index.ts` — Are the routes properly authenticating? Does `GET /api/reels` work without ANTHROPIC_API_KEY (it should — listing doesn't need AI)?
2. `backend/src/routes/generation/index.ts` — Does it properly handle missing ANTHROPIC_API_KEY (should return 503, not crash)?
3. `backend/src/lib/claude.ts` — Does it fail gracefully if the API key is not set?

---

## Database Migration

### Current Schema (Tables already added)
The migration `0001_organic_captain_universe.sql` added:
- `reels`
- `reel_analyses`
- `generated_content`
- `instagram_pages`
- `queue_items`

**Status**: Migration generated. Still needs to be RUN against the database.

**Command**: `cd backend && bun db:migrate`

**Prerequisite**: Database must be running (Docker postgres service or local postgres).

### Tables to Verify (Existing)
- `feature_usages` — Used for calculator tracking. Now repurpose for general feature usage. The `featureType` column will now store "analysis", "generation", "queue" instead of "mortgage", "loan", etc.
- `users` — No changes needed
- `orders` — No changes needed
- `contact_messages` — No changes needed

---

## Backend `.env` File

**Current state**: `backend/.env` has placeholder values for:
```
ANTHROPIC_API_KEY=<MISSING>
R2_ENABLED=false
RESEND_API_KEY=re_xxxxx (placeholder)
```

**Required additions for ReelStudio to work**:
```env
ANTHROPIC_API_KEY=sk-ant-xxxx    # Required for AI analysis and generation
ANALYSIS_MODEL=claude-haiku-4-5-20251001
GENERATION_MODEL=claude-sonnet-4-6
```

**Optional (for real reel data)**:
```env
REEL_SOURCE=mock              # Keep as mock for now
INSTAGRAM_API_TOKEN=<token>   # For real Instagram reel fetching (future)
VIRAL_VIEWS_THRESHOLD=500000  # What counts as "viral"
```

---

## Summary Table

| File | Action | Priority |
|------|--------|----------|
| `constants/app.constants.ts` | Update brand | **Critical** |
| `index.ts` | Remove calculator route mount | High |
| `features/calculator/` (all 6 files) | Delete | High |
| `routes/calculator/index.ts` | Delete | High |
| `routes/analytics/index.ts` | Remove calculator analytics | Medium |
| `routes/public/index.ts` | Check for calculator endpoints | Low |
| `constants/subscription.constants.ts` | Update feature lists | Medium |
| `utils/permissions/calculator-permissions.ts` | Delete when unused | Medium |
| `backend/.env` | Add ANTHROPIC_API_KEY | **Critical** |
| Database migration | Run `bun db:migrate` | **Critical** |
| Seed script | Run `seed-mock-reels.ts` | High |
