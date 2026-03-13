# Discover Page Improvements

Daily rotation, background scanning, cross-niche trending, and popular audio sourcing.

**Date:** 2026-03-12
**Status:** Research
**Related:** `frontend/src/routes/studio/discover.tsx`, `backend/src/routes/reels/index.ts`, `backend/src/services/scraping.service.ts`

---

## Current State

- Reels sorted by views DESC (default), engagement, or recency
- No automatic re-scraping — admin manually triggers `POST /api/admin/niches/:id/scan`
- No daily rotation or freshness weighting
- No cross-niche "trending" view
- No audio trending data

---

## 1. Daily Background Scanning

### What It Does

Automatically re-scrape all active niches on a schedule so the discover feed stays fresh without admin intervention.

### Implementation

**Option A: Bun-native cron (recommended)**

Bun has built-in cron support since v1.2+. No external dependency needed.

**New file:** `backend/src/jobs/daily-scan.ts`

```typescript
import { CronJob } from "bun";

export function startDailyScan() {
  new CronJob("0 3 * * *", async () => {  // 3 AM daily
    const activeNiches = await db.select().from(niches).where(eq(niches.isActive, true));

    for (const niche of activeNiches) {
      await queueService.enqueue({
        nicheId: niche.id,
        nicheName: niche.name,
      });
      // Stagger: wait 30s between niche scrapes to avoid rate limits
      await Bun.sleep(30_000);
    }
  });
}
```

**Call from `backend/src/index.ts`:**
```typescript
import { startDailyScan } from "./jobs/daily-scan";
startDailyScan();
```

**Option B: External cron (Railway cron job)**

Railway supports cron jobs as separate services. Create a lightweight service that calls `POST /api/admin/niches/:id/scan` for each active niche via an internal API. This is more resilient (survives server restarts) but adds deployment complexity.

**Recommendation:** Option A for simplicity. The Bun process restarts are infrequent on Railway, and missed scans aren't critical — the next run catches up.

### Hashtag Discovery

The scan should also track which hashtags are trending. During scraping:
- Extract hashtags from reel captions (`caption.match(/#\w+/g)`)
- Upsert into a `trendingHashtags` table

**New table:**
```sql
trendingHashtags
  id          serial PK
  hashtag     text NOT NULL UNIQUE
  nicheId     integer          -- which niche scan found it (nullable for cross-niche)
  useCount    integer DEFAULT 0
  firstSeen   timestamp DEFAULT now()
  lastSeen    timestamp DEFAULT now()
```

**Population:** In `scraping.service.ts` after `saveReels()`, extract and upsert hashtags.

---

## 2. Daily Rotation & Freshness Sorting

### What It Does

The discover feed prioritizes recently scraped reels and rotates which reels appear at the top each day, even if the underlying data hasn't changed dramatically.

### Sorting Strategy

**Primary sort: Date (most recently scraped first)**
**Secondary sort: Views (within the same day)**

```sql
SELECT * FROM reels
WHERE nicheId = $1
ORDER BY
  DATE(scrapedAt) DESC,   -- group by scrape date
  views DESC               -- within same date, sort by views
LIMIT 20 OFFSET $2
```

This naturally rotates the feed: when new reels are scraped daily, they appear first. Within the same day's batch, the most viral reels surface.

### Daily Shuffle (Optional Enhancement)

For days when no new scrape has occurred, add a deterministic daily shuffle so the feed doesn't feel static:

```sql
ORDER BY
  DATE(scrapedAt) DESC,
  -- Deterministic daily shuffle: hash(reelId + today's date) creates a consistent
  -- but daily-changing order for reels scraped on the same day
  MD5(CONCAT(id::text, CURRENT_DATE::text)) ASC
LIMIT 20 OFFSET $2
```

This means:
- New scrapes always surface first
- Within the same scrape batch, order changes daily
- Pagination remains stable within a single day (deterministic hash)

### Backend Changes

**Modify `GET /api/reels`** — add `sort=fresh` option:

```typescript
sort === "fresh"
  ? [desc(sql`DATE(${reels.scrapedAt})`), desc(reels.views)]
  : sort === "engagement" ? desc(reels.engagementRate)
  : sort === "recent" ? desc(reels.createdAt)
  : desc(reels.views)
```

Make `fresh` the new default sort for the discover page.

### Frontend Changes

**Modify `discover.tsx`** — pass `sort=fresh` to the reels query (or update the backend default).

---

## 3. "Trending" — Top Across All Niches

### What It Does

A special option in the niche dropdown that shows the most viral/engaging reels across all niches, giving users a "what's hot right now" view.

### Implementation

**Backend: New endpoint or query mode**

Add a `niche=trending` special value to `GET /api/reels`:

```typescript
if (niche === "trending" || nicheId === "trending") {
  // No niche filter — query across all niches
  // Sort by views DESC, but weight recent reels higher
  query = query
    .where(gte(reels.scrapedAt, sql`NOW() - INTERVAL '7 days'`))
    .orderBy(desc(reels.views));
}
```

This is a simple query — no complex union needed. The `WHERE scrapedAt > 7 days ago` ensures only recent content appears, and `ORDER BY views DESC` surfaces the most viral across all niches.

**Why not a union?** A union of top-N per niche would give balanced representation, but "trending" means "what's genuinely most popular" — a single sorted query is both simpler and more honest. If a fitness reel has 5M views and a cooking reel has 500K, the fitness reel should rank higher in trending.

**Optional: Ensure niche diversity**

If you want to prevent one niche from dominating trending, use a window function:

```sql
WITH ranked AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY nicheId ORDER BY views DESC) as niche_rank
  FROM reels
  WHERE scrapedAt > NOW() - INTERVAL '7 days'
)
SELECT * FROM ranked
WHERE niche_rank <= 10   -- top 10 per niche
ORDER BY views DESC
LIMIT 20 OFFSET $1
```

This takes the top 10 from each niche, then sorts globally by views. At most 10 reels from any single niche appear, ensuring diversity.

**Recommendation:** Start with the simple query (no diversity constraint). Add the window function if users complain about one niche dominating.

### Frontend Changes

**Modify niche dropdown in `discover.tsx`:**

Add a "Trending" option at the top of the niche selector:

```typescript
<SelectItem value="trending" className="...">
  🔥 {t("studio_discover_trending")}
</SelectItem>
{niches.map((n) => (
  <SelectItem key={n.id} value={String(n.id)} className="...">
    {n.name}
  </SelectItem>
))}
```

When `trending` is selected, pass `niche=trending` to the reels query instead of a `nicheId`.

### Translation Key

Add to `en.json`:
```json
"studio_discover_trending": "Trending — All Niches"
```

---

## 4. Popular Audio Sourcing

### What It Does

Surface trending audio tracks so users know what music/sounds to use in their reels. This is a discovery feature, not a licensing feature — we show what's trending, users find/use the audio on Instagram.

### Data Source

The existing scraper already captures `audioName` and `audioId` from every reel (fields in `ApifyReelItem`). This data is stored in `reels.audioName` and `reels.audioId`.

### Trending Audio Aggregation

**New table** (defined in `generate-reel-creation-pipeline.md`):

```sql
trendingAudio
  id          serial PK
  audioId     text NOT NULL UNIQUE
  audioName   text NOT NULL
  artistName  text
  useCount    integer DEFAULT 0
  firstSeen   timestamp DEFAULT now()
  lastSeen    timestamp DEFAULT now()
```

**Population:** During reel scraping, after `saveReels()`:

```typescript
// In scraping.service.ts, after saving reels
for (const reel of savedReels) {
  if (reel.audioId && reel.audioName) {
    await db.insert(trendingAudio)
      .values({
        audioId: reel.audioId,
        audioName: reel.audioName,
        artistName: reel.artistName || null,
        useCount: 1,
        lastSeen: new Date(),
      })
      .onConflictDoUpdate({
        target: trendingAudio.audioId,
        set: {
          useCount: sql`${trendingAudio.useCount} + 1`,
          lastSeen: new Date(),
        },
      });
  }
}
```

### Endpoints

```
GET /api/audio/trending
  Query params:
    days: 7 (default) — time window
    nicheId: optional — filter by niche
    limit: 20 (default)

  Response:
  {
    "audio": [
      {
        "audioId": "123456",
        "audioName": "original sound - creator",
        "artistName": "creator",
        "useCount": 47,
        "lastSeen": "2026-03-12",
        "trend": "rising"  // "rising" | "stable" | "declining" based on 7d vs 30d
      }
    ]
  }
```

**Trend calculation:**
```sql
-- Compare 7-day count vs previous 7-day count
-- If 7d > prev7d: "rising"
-- If roughly equal: "stable"
-- If 7d < prev7d: "declining"
```

### UI: Audio Section in Discover

Add a collapsible "Trending Audio" section below the niche selector in the discover sidebar:

```
┌─────────────────────┐
│  Niche: [Fitness ▾] │
├─────────────────────┤
│  🎵 Trending Audio  │
│  ────────────────── │
│  ↗ original sound   │
│    @creator · 47 uses│
│  → Escapism          │
│    RAYE · 35 uses    │
│  ↗ Carnival          │
│    Kanye · 28 uses   │
│  ↘ Nasty             │
│    Tinashe · 12 uses │
│  [Show more]         │
└─────────────────────┘
```

Each audio item shows:
- Trend arrow (↗ rising, → stable, ↘ declining)
- Audio name (truncated)
- Artist name
- Use count in recent reels

Clicking an audio item filters the reel list to show reels that use that audio.

---

## Implementation Priority

```
P0 (Quick Wins):
  - Daily background scan (Bun cron, ~30 lines)
  - "Fresh" sort (date + views, change default)
  - "Trending" niche option (simple cross-niche query)

P1 (Audio):
  - trendingAudio table + population during scraping
  - GET /api/audio/trending endpoint
  - Trending Audio sidebar section in discover

P2 (Polish):
  - Daily shuffle for same-day reels
  - Niche diversity in trending (window function)
  - Trending hashtags table + display
  - Audio filter (click audio → filter reels)

P3 (Advanced):
  - Trend calculation (rising/stable/declining)
  - Audio search endpoint
  - Hashtag recommendations for generation
```

---

## Database Changes Summary

| Table | Action | Notes |
|-------|--------|-------|
| `trendingAudio` | Create | Aggregate audio usage from scraped reels |
| `trendingHashtags` | Create | Aggregate hashtag usage from captions |
| `reels` | No change | Already has `audioName`, `audioId` fields |

---

## Backend Changes Summary

| File | Change |
|------|--------|
| `backend/src/jobs/daily-scan.ts` | New — Bun cron for daily niche scanning |
| `backend/src/index.ts` | Import and call `startDailyScan()` |
| `backend/src/routes/reels/index.ts` | Add `sort=fresh`, handle `niche=trending` |
| `backend/src/services/scraping.service.ts` | Upsert `trendingAudio` + `trendingHashtags` after saving reels |
| `backend/src/routes/audio/index.ts` | New — trending audio endpoint |

## Frontend Changes Summary

| File | Change |
|------|--------|
| `frontend/src/routes/studio/discover.tsx` | Add "Trending" niche option, default to `sort=fresh` |
| `frontend/src/features/reels/components/TrendingAudio.tsx` | New — sidebar audio section |
| `frontend/src/translations/en.json` | Add `studio_discover_trending`, `studio_discover_trendingAudio` keys |
