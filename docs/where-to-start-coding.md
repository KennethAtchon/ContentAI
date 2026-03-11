# Where to Start Coding

This doc guides you through the key entry points for ReelStudio. The product is already implemented — this is a map of the codebase, not a template setup guide.

---

## 1. Product Identity

**File:** `frontend/src/shared/constants/app.constants.ts`

Defines `APP_NAME`, `APP_DESCRIPTION`, `APP_TAGLINE`, `SUPPORT_EMAIL`, and related constants used across UI, SEO metadata, and email templates.

---

## 2. Core Feature: ReelStudio Workspace

**Location:** `frontend/src/features/` (reels, generation, studio)

The studio workspace has four pillars:

| Pillar | Frontend Feature | Backend Route |
|--------|-----------------|--------------|
| Discover | `features/reels/` | `/api/reels` |
| Analyze | `features/reels/` | `/api/reels/:id/analyze` |
| Generate | `features/generation/` | `/api/generation` |
| Queue | (queue route) | `/api/queue` |

**Key frontend files:**

| File | Purpose |
|------|---------|
| `features/reels/components/ReelList.tsx` | Reel discovery sidebar |
| `features/reels/components/PhonePreview.tsx` | Reel preview panel |
| `features/reels/components/AnalysisPanel.tsx` | Analysis/Generate/History tabs |
| `features/generation/hooks/use-generate-content.ts` | Mutation hook for POST /api/generation |
| `features/studio/components/StudioTopBar.tsx` | Studio navigation |

**Key backend files:**

| File | Purpose |
|------|---------|
| `backend/src/routes/reels/index.ts` | Reel discovery + analysis endpoints |
| `backend/src/routes/generation/index.ts` | Content generation endpoints |
| `backend/src/routes/queue/index.ts` | Queue management endpoints |
| `backend/src/services/reels/reel-analyzer.ts` | Claude Haiku analysis logic |
| `backend/src/services/reels/content-generator.ts` | Claude Sonnet generation logic |

---

## 3. Adding New Content Niches

Niches are managed by admins through the admin dashboard:

1. **Admin UI:** `/admin/niches` → Create/edit niches
2. **Backend:** `POST /api/admin/niches` → Writes to `niche` table
3. **Scraping:** `POST /api/admin/niches/:id/scan` → Queues a scrape job to populate reels for that niche

No code changes needed to add a new niche — it's purely data-driven.

---

## 4. Adding a New Generation Output Type

The current output types are `"hook"`, `"caption"`, and `"full"`.

To add a new type (e.g., `"hashtags"`):

1. **Backend validation:** Add `"hashtags"` to the `outputType` Zod enum in `routes/generation/index.ts`
2. **Generator service:** Add a new prompt branch in `services/reels/content-generator.ts` for the new output type
3. **Database:** The `generated_content` table already stores `output_type` as a text field — no migration needed
4. **Frontend:** Add the new type to the UI dropdown in the generation panel

---

## 5. Subscription Tiers & Feature Gating

**Server-side tier check:**
```typescript
const { firebaseUser } = c.get("auth");
const stripeRole = firebaseUser.stripeRole; // "basic" | "pro" | "enterprise" | undefined

const LIMITS = { free: 1, basic: 10, pro: 50, enterprise: Infinity };
const dailyLimit = LIMITS[stripeRole ?? "free"];
```

**Client-side gating:**
```typescript
import { useSubscription } from "@/features/subscriptions/hooks/use-subscription";
const { hasProAccess } = useSubscription();
```

**Feature gate component:**
```tsx
<FeatureGate requiredTier="pro">
  <ScriptGenerationPanel />
</FeatureGate>
```

Tier configuration: `backend/src/constants/stripe.constants.ts`

---

## 6. API Patterns

**Never use `fetch` directly.** Use the established utilities:

```typescript
// GET requests with caching (React Query)
const fetcher = useQueryFetcher();
const { data } = useQuery({
  queryKey: queryKeys.api.reels(nicheId),
  queryFn: () => fetcher(`/api/reels?nicheId=${nicheId}`),
});

// Authenticated mutations
const { authenticatedFetchJson } = useAuthenticatedFetch();
const result = await authenticatedFetchJson("/api/generation", {
  method: "POST",
  body: JSON.stringify({ sourceReelId, prompt, outputType }),
});
```

**Environment variables:**
```typescript
// Never do this:
const key = import.meta.env.VITE_API_KEY;

// Always do this:
import { API_KEY } from "@/shared/utils/config/envUtil";
```

---

## 7. Translations (i18n)

All user-facing strings must use `react-i18next`:

```typescript
import { useTranslation } from "react-i18next";
const { t } = useTranslation();
// Usage: {t("studio.generate.button")}
```

Translation keys live in `frontend/src/translations/en.json`. Check existing keys before adding new ones.

---

## 8. Quick Reference

| I want to… | Go to… |
|------------|--------|
| Add a new niche | Admin dashboard `/admin/niches` (no code change) |
| Change AI models | `ANALYSIS_MODEL` / `GENERATION_MODEL` env vars |
| Add a new generation output type | `services/reels/content-generator.ts` + `routes/generation/index.ts` |
| Change subscription limits | `backend/src/constants/stripe.constants.ts` |
| Change UI copy | `frontend/src/translations/en.json` |
| Add a new backend route | `backend/src/routes/<name>/index.ts` + mount in `index.ts` |
| Add a new frontend page | `frontend/src/routes/<path>.tsx` (TanStack Router auto-discovers) |
| Understand auth middleware | `backend/src/middleware/protection.ts` |
| Understand database schema | `backend/src/infrastructure/database/drizzle/schema.ts` |

---

## 9. Architecture Docs

| Topic | Doc |
|-------|-----|
| Full system overview | [architecture/overview.md](./architecture/overview.md) |
| Authentication | [architecture/core/authentication.md](./architecture/core/authentication.md) |
| API patterns | [architecture/core/api.md](./architecture/core/api.md) |
| Database (Drizzle) | [architecture/core/database.md](./architecture/core/database.md) |
| ReelStudio workspace | [architecture/domain/studio-system.md](./architecture/domain/studio-system.md) |
| AI generation | [architecture/domain/generation-system.md](./architecture/domain/generation-system.md) |
| Subscriptions | [architecture/domain/subscription-system.md](./architecture/domain/subscription-system.md) |
| Niche management | [Admin_Niches_Orchestration.md](./Admin_Niches_Orchestration.md) |

---

*Last updated: March 2026*
