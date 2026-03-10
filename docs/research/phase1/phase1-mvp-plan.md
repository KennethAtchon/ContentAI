# Phase 1 MVP Plan: Data Collection and Basic Outputs

> **Goal**: Wire up functional end-to-end data flow — ingest viral Reel data, store it, analyze it with AI, and export structured reports.
> **Timeline**: 2–4 weeks
> **Milestone**: `POST /api/reels/scan` collects real Reels for a given niche; `GET /api/reels` returns a queryable report; `POST /api/reels/:id/analyze` runs Claude analysis.

---

## 1. Current State (What Already Exists)

The backend is a **Hono app running on Bun**, using **Drizzle ORM** against **PostgreSQL**. The following is already built and wired up:

| Area | Status | Notes |
|---|---|---|
| `POST /api/reels/scan` | ⚠️ **Stub** | Returns a fake `jobId`; no real scraper connected |
| `GET /api/reels` | ✅ Working | Filters by niche, views, sorts, paginates |
| `GET /api/reels/:id` | ✅ Working | Returns reel + its AI analysis |
| `POST /api/reels/:id/analyze` | ✅ Working | Calls Claude via `reel-analyzer.ts` |
| `POST /api/generation` | ✅ Working | Generates hook/caption/full remix via Claude |
| `GET /api/generation` | ✅ Working | Returns user's generation history |
| `POST /api/generation/:id/queue` | ✅ Working | Schedules content for posting |
| `services/reels/reel-analyzer.ts` | ✅ Working | Claude `ANALYSIS_MODEL` → structured JSON analysis |
| `services/reels/content-generator.ts` | ✅ Working | Claude `GENERATION_MODEL` → hook/caption/full remix |
| DB schema (`reels`, `reelAnalyses`, `generatedContent`, `queueItems`) | ✅ Exists | Drizzle schema already defined |

**The missing piece for Phase 1**: real data in the `reels` table. `POST /api/reels/scan` is a stub — it needs a real ingestion pipeline.

---

## 2. What We're Building (Phase 1 Gap)

```
POST /api/reels/scan   ←── This needs to actually collect data
        │
        ▼
  Scraper / Ingestion Service
  (Apify actor OR manual seed script)
        │
        ▼
  reels table (PostgreSQL)
        │
   ┌────┴──────────────────────────────┐
   ▼                                   ▼
GET /api/reels                POST /api/reels/:id/analyze
(query + paginate)            (Claude AI → reelAnalyses table)
                                        │
                                        ▼
                              POST /api/generation
                              (remix → generatedContent)
```

---

## 3. Tech Stack (Actual)

| Layer | Technology |
|---|---|
| **Runtime** | Bun |
| **Framework** | Hono |
| **Language** | TypeScript |
| **ORM** | Drizzle ORM |
| **Database** | PostgreSQL |
| **Cache** | Redis |
| **AI Analysis** | Anthropic Claude (`ANALYSIS_MODEL` — haiku for speed) |
| **AI Generation** | Anthropic Claude (`GENERATION_MODEL` — sonnet for quality) |
| **Data Ingestion** | Apify (Phase 1 recommended) OR manual seed script |
| **Auth** | Firebase Auth |
| **Storage** | Cloudflare R2 |

---

## 4. Ingestion Strategy (Replacing the Stub)

### Option A: Apify Actor (Recommended for Phase 1)

Use Apify's Instagram Reels Scraper to collect data. Call it from the backend when a scan is triggered.

**Flow**:
1. `POST /api/reels/scan` → calls Apify REST API with niche keyword
2. Apify runs the scrape asynchronously
3. Webhook or polling endpoint receives results → inserts into `reels` table
4. Set `REEL_SOURCE=apify` in `.env`

**New file**: `backend/src/services/reels/ingestion/apify-scraper.ts`

```typescript
// Pseudocode — real implementation needed
export async function triggerApifyScan(niche: string): Promise<string> {
  const response = await fetch(`https://api.apify.com/v2/acts/apify~instagram-reel-scraper/runs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SOCIAL_API_KEY}` },
    body: JSON.stringify({ hashtags: [niche.replace(/ /g, '')], maxItems: 100 })
  });
  const { data } = await response.json();
  return data.id; // Apify run ID → stored as jobId
}
```

### Option B: Manual Seed Script (Fastest to Get Unblocked)

A Bun script that reads a CSV/JSON of manually curated Reels and bulk-inserts into the DB. Zero scraping risk, lets you validate the full pipeline immediately.

**New file**: `backend/src/scripts/seed-reels.ts`

```typescript
// Run with: bun run src/scripts/seed-reels.ts --file ./data/reels.json --niche "personal finance"
```

> **Recommendation**: Start with Option B to validate the AI + generation pipeline end-to-end. Add Option A in Week 2 once the pipeline is verified.

---

## 5. Files to Add / Modify

### New Files

| File | Purpose |
|---|---|
| `backend/src/services/reels/ingestion/apify-scraper.ts` | Apify API integration — triggers scan, maps response to DB shape |
| `backend/src/services/reels/ingestion/reel-mapper.ts` | Normalizes raw scraper output into the `reels` table schema |
| `backend/src/routes/reels/webhook.ts` | Apify webhook receiver — inserts scraped Reels into DB |
| `backend/src/scripts/seed-reels.ts` | Manual seed script for testing pipeline without live scraping |

### Modify

| File | Change |
|---|---|
| `backend/src/routes/reels/index.ts` | Replace `POST /scan` stub with real `triggerApifyScan()` call + job tracking |
| `backend/src/routes/reels/index.ts` | Add `GET /export` endpoint — returns CSV/JSON report for a niche |
| `backend/.env` + `.env.example` | Already have `SOCIAL_API_KEY`, `REEL_SOURCE`, `VIRAL_VIEWS_THRESHOLD` |

---

## 6. Output / Report Spec

### `GET /api/reels/export?niche=personal+finance&format=json`

Returns structured report based on DB records. No new scraping — just queries existing data.

```json
{
  "niche": "personal finance",
  "generatedAt": "2026-03-09T19:00:00Z",
  "totalReels": 87,
  "avgEngagementRate": 3.4,
  "topReels": [
    {
      "reelId": 42,
      "views": 1250000,
      "likes": 45000,
      "comments": 820,
      "engagementRate": 3.66,
      "hook": "5 financial rules you should know by 30",
      "caption": "Most people learn these too late...",
      "audioName": "original-audio-765760437225",
      "analysis": {
        "hookPattern": "Age milestone gate",
        "hookCategory": "fomo",
        "emotionalTrigger": "fear",
        "formatPattern": "slideshow",
        "remixSuggestion": "Adapt for recent grads: '5 money moves before 25'"
      }
    }
  ]
}
```

---

## 7. Engagement Rate Formula

Already stored in DB — calculated on insert:

```typescript
engagementRate = ((likes + comments) / views) * 100
```

---

## 8. Development Plan (Week by Week)

### Week 1 — Unblock the Pipeline
- [x] Write `seed-reels.ts` — insert 20–30 manually sourced Reels into DB
- [x] Verify `GET /api/reels` returns them correctly
- [x] Verify `POST /api/reels/:id/analyze` runs Claude against a seeded reel
- [x] Verify `POST /api/generation` generates a remix from that analysis
- [x] Add `GET /api/reels/export` route — JSON + CSV output

### Week 2 — Real Ingestion
- [ ] Build `apify-scraper.ts` — integrate Apify REST API
- [ ] Replace stub in `POST /api/reels/scan` with real Apify trigger
- [ ] Build `reel-mapper.ts` — normalize Apify response to DB schema
- [ ] Add webhook receiver or polling to handle Apify job completion
- [ ] Test: scan "personal finance" → collect 50+ Reels automatically

### Week 3 — Validation
- [ ] Run on personal finance niche, collect 50–100 Reels
- [ ] Manually validate 50 records (spot-check views/hooks against real Instagram)
- [ ] Run AI analysis on top 25 by views
- [ ] Review remix suggestions — assess quality
- [ ] Fix any schema or prompt issues found

### Week 4 — Polish
- [ ] Add `isViral` flag auto-set on insert based on `VIRAL_VIEWS_THRESHOLD`
- [ ] Add `daysAgo` calculation on insert
- [ ] Export a clean report and review in Google Sheets
- [ ] Document any scraping edge cases or failures

---

## 9. Success Criteria

- [ ] `POST /api/reels/scan` triggers real data collection (not a stub)
- [ ] 50+ Reels in DB for at least 1 niche
- [ ] 90%+ of records have valid `views`, `likes`, `comments`
- [ ] `POST /api/reels/:id/analyze` returns structured Claude analysis
- [ ] `POST /api/generation` produces quality remix suggestions
- [ ] `GET /api/reels/export` returns a CSV that opens cleanly in Google Sheets

---

## 10. What's Intentionally Deferred to Phase 2

- Scheduled daily re-scrapes (cron/queue)
- Multiple niches in parallel
- Upgrade from Apify to Instagram Graph API (requires Meta approval)
- PostgreSQL migration from SQLite (already on PostgreSQL — N/A)
- Frontend dashboard (frontend app handles this separately)
