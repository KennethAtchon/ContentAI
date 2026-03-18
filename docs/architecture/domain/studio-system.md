# Studio System Architecture

## Overview

The ReelStudio workspace is the core product experience. It provides four integrated workflows:

1. **Discover** — Browse viral reels filtered by niche
2. **Analyze** — AI breakdown of why a reel performs
3. **Generate** — AI remix of hooks, captions, and scripts
4. **Queue** — Schedule generated content to Instagram
5. **Editor** — Manual timeline editor for a draft reel (`/studio/editor/:generatedContentId`); see **[Manual editor system](./manual-editor-system.md)** for composition init, autosave, validate, and render flows.

The Studio runs at `/studio/*` and is a protected (authenticated) workspace with its own dark-theme shell, completely separate from the public/customer route groups.

---

## System Architecture

```
Frontend: /studio routes (TanStack Router)
  ├── /studio          → redirect to /studio/discover
  ├── /studio/discover → 3-panel workspace (ReelList + PhonePreview + AnalysisPanel)
  ├── /studio/generate → Full-screen generation workspace
  └── /studio/queue    → Content queue management

             ↓ HTTPS + Firebase Auth

Backend: Hono API
  ├── GET  /api/reels                   → Reel discovery
  ├── GET  /api/reels/:id               → Reel detail + analysis
  ├── POST /api/reels/:id/analyze       → AI analysis (Claude Haiku)
  ├── POST /api/generation              → Content generation (Claude Sonnet)
  ├── GET  /api/generation              → Generation history
  ├── POST /api/generation/:id/queue    → Add to queue
  ├── GET  /api/queue                   → Queue list
  ├── PATCH /api/queue/:id              → Update queue item
  └── DELETE /api/queue/:id            → Remove from queue

             ↓

PostgreSQL (Drizzle)
  niche → reel → reel_analysis → generated_content → queue_item

             ↓ AI

Claude Haiku  → reel analysis
Claude Sonnet → content generation
```

---

## Frontend Components

### Route Structure

```
frontend/src/routes/studio/
├── index.tsx          → redirect to discover
├── discover.tsx       → 3-panel discovery workspace
├── generate.tsx       → full-screen generation page
└── queue.tsx          → queue management page
```

All studio routes are wrapped with `<AuthGuard authType="user">`.

### Feature Structure

```
frontend/src/features/
├── reels/
│   ├── components/
│   │   ├── ReelList.tsx          → Sidebar: reel cards with metrics
│   │   ├── PhonePreview.tsx      → Center: phone mockup with stats
│   │   └── AnalysisPanel.tsx     → Right: Analysis/Generate/History tabs
│   ├── hooks/
│   │   ├── use-reels.ts          → Fetch reel list (React Query)
│   │   └── use-reel-analysis.ts  → Fetch/trigger analysis
│   └── services/
│       └── reels.service.ts      → API calls for reel endpoints
│
├── generation/
│   ├── hooks/
│   │   ├── use-generate-content.ts    → POST /api/generation mutation
│   │   └── use-generation-history.ts  → GET /api/generation query
│   └── services/
│       └── generation.service.ts
│
└── studio/
    ├── components/
    │   └── StudioTopBar.tsx      → Navigation bar (Discover/Generate/Queue)
    └── layout.tsx                → Studio shell (dark theme, no PageLayout)
```

---

## Core Components

### 1. Reel Discovery

**Purpose:** Surface top-performing reels for a given niche.

**Layout:** 3-panel interface
- **Left panel** (`ReelList`): Scrollable list of reel cards showing username, views, engagement rate, and thumbnail emoji
- **Center panel** (`PhonePreview`): Phone mockup displaying the selected reel with floating stat cards (views, likes, comments)
- **Right panel** (`AnalysisPanel`): Tabs — Analysis | Generate | History

**Data Flow:**

```mermaid
sequenceDiagram
    participant User
    participant Studio UI
    participant React Query
    participant Backend

    User->>Studio UI: Select niche from dropdown (StudioTopBar)
    Studio UI->>React Query: useReels({ nicheId })
    React Query->>Backend: GET /api/reels?nicheId=3&sort=views&limit=50
    Backend-->>React Query: [{ id, username, views, engagementRate, thumbnailEmoji, ... }]
    React Query-->>Studio UI: Reel list cached

    User->>Studio UI: Click a reel
    Studio UI->>React Query: useReel(reelId)
    React Query->>Backend: GET /api/reels/7
    Backend-->>React Query: { reel, analysis | null }
    React Query-->>Studio UI: Reel detail in PhonePreview
    Studio UI->>Studio UI: If analysis exists, show in AnalysisPanel
```

**Backend endpoint:**
```
GET /api/reels
  Query: nicheId, limit, offset, minViews, sort (views|engagementRate|createdAt)
  Auth: user
  Response: { items: Reel[], total: number }

GET /api/reels/:id
  Auth: user
  Response: { reel: Reel, analysis: ReelAnalysis | null }
```

---

### 2. AI Analysis System

**Purpose:** Deconstruct why a reel is viral using Claude Haiku.

**UI:** When user clicks "Analyze this reel" in `AnalysisPanel`, triggers the analysis and shows the results in tag/badge format.

**Analysis tags displayed:**
- Hook Pattern (e.g., "Bold claim opener")
- Emotional Trigger (e.g., "Fear of missing out")
- Format Pattern (e.g., "Talking head")
- CTA Type (e.g., "Follow")
- Caption Framework
- Curiosity Gap Style
- Remix Suggestion

**Data Flow:**

```mermaid
sequenceDiagram
    participant User
    participant AnalysisPanel
    participant Backend
    participant Claude Haiku
    participant PostgreSQL

    User->>AnalysisPanel: Click "Analyze"
    AnalysisPanel->>Backend: POST /api/reels/7/analyze
    Backend->>PostgreSQL: SELECT * FROM reel WHERE id=7
    PostgreSQL-->>Backend: Reel data
    Backend->>Claude Haiku: Structured analysis prompt
    Claude Haiku-->>Backend: JSON { hookPattern, emotionalTrigger, ... }
    Backend->>PostgreSQL: INSERT INTO reel_analysis ...
    PostgreSQL-->>Backend: Saved analysis
    Backend-->>AnalysisPanel: { analysis }
    AnalysisPanel->>User: Display analysis tags + remixSuggestion
```

---

### 3. Content Generation System

**Purpose:** Generate original content inspired by a reel's AI analysis.

**UI:**
- Quick generation panel within `AnalysisPanel` (Generate tab)
- Full-screen `/studio/generate` page for detailed work

**Output types:**
- `"hook"` — 5 hook variations in different styles
- `"caption"` — Full caption (hook + body + CTA)
- `"full"` — Hook variations + caption + script notes

**Data Flow:**

```mermaid
sequenceDiagram
    participant User
    participant Studio UI
    participant Backend
    participant Claude Sonnet
    participant PostgreSQL

    User->>Studio UI: Type prompt + select output type + click Generate
    Studio UI->>Studio UI: Check tier limits (stripeRole from Firebase claim)
    Studio UI->>Backend: POST /api/generation { sourceReelId, prompt, outputType }
    Backend->>Backend: Check daily usage limit for tier
    Backend->>PostgreSQL: SELECT reel + reel_analysis WHERE reelId=7
    PostgreSQL-->>Backend: Reel + analysis context
    Backend->>Claude Sonnet: Remix generation prompt
    Claude Sonnet-->>Backend: { hook, caption, scriptNotes }
    Backend->>PostgreSQL: INSERT INTO generated_content (status: "draft")
    Backend-->>Studio UI: { content: GeneratedContent }
    Studio UI->>User: Display generated content with copy buttons
```

**Feature gating:**

| Tier | Daily Generations |
|------|-----------------|
| Free | 1 |
| Basic | 10 |
| Pro | 50 |
| Enterprise | Unlimited |

Limit enforced server-side. Client shows `UpgradePrompt` component when `429` is returned.

---

### 4. Content Queue System

**Purpose:** Schedule generated content to Instagram pages.

**UI:** `/studio/queue` page with status-based filters and a scheduling date picker.

**Queue States:**
| State | Meaning |
|-------|---------|
| `scheduled` | Waiting to be published |
| `posted` | Successfully published |
| `failed` | Publishing failed (errorMessage stored) |

**Data Flow:**

```mermaid
sequenceDiagram
    participant User
    participant Queue UI
    participant Backend
    participant PostgreSQL

    User->>Queue UI: Navigate to /studio/queue
    Queue UI->>Backend: GET /api/queue?status=scheduled
    Backend->>PostgreSQL: SELECT queue_items WHERE userId=uid AND status=scheduled
    PostgreSQL-->>Backend: Queue items with generated content
    Backend-->>Queue UI: { items, total }

    User->>Queue UI: Click "Schedule" on a generated content item
    Queue UI->>Backend: POST /api/generation/99/queue { scheduledFor, instagramPageId }
    Backend->>PostgreSQL: INSERT queue_item + UPDATE generated_content status="queued"
    Backend-->>Queue UI: Queue item created

    User->>Queue UI: Edit scheduled time
    Queue UI->>Backend: PATCH /api/queue/55 { scheduledFor: "2026-03-15T10:00:00Z" }
    Backend->>PostgreSQL: UPDATE queue_item SET scheduled_for=...
    Backend-->>Queue UI: Updated item

    User->>Queue UI: Remove from queue
    Queue UI->>Backend: DELETE /api/queue/55
    Backend->>PostgreSQL: DELETE queue_item + UPDATE generated_content status="draft"
    Backend-->>Queue UI: 200 OK
```

---

## Navigation Pattern

```
StudioTopBar
├── Logo / Home
├── [Discover]   ← /studio/discover (default)
├── [✦ Generate] ← /studio/generate
├── [Editor]     ← /studio/editor (pick draft → /studio/editor/:id)
└── [Queue]      ← /studio/queue
```

The Studio shell does **not** use the global `PageLayout` component. It has its own dark-themed layout with the `StudioTopBar` fixed at the top.

---

## Authentication Model

| Route | Guard | Redirect if unauthenticated |
|-------|-------|----------------------------|
| `/studio/*` | `AuthGuard authType="user"` | `/sign-in` |
| `/admin/*` | `AuthGuard authType="admin"` | `/sign-in` |

---

## Admin: Niche Management

Niches (the content categories driving discovery) are managed by admins via `GET/POST/PUT/DELETE /api/admin/niches`. Creating a niche and triggering a scrape scan populates the `reel` table with real Instagram content for that niche.

See [Scrape System](#scrape-system) below for the full technical breakdown of how scraping works, including Apify integration, job queue lifecycle, data mapping, and R2 storage fields.

---

## Scrape System

The scrape system populates the `reel` table with real Instagram reels for a given niche. It is admin-triggered, Apify-powered, and runs asynchronously via an in-memory/Redis job queue.

---

### Components

```
Admin UI
  └── POST /api/admin/niches/:id/scan
        └── QueueService.enqueue(nicheId, nicheName)
              └── QueueService.drain() [async, single worker]
                    └── ScrapingService.scrapeNiche(nicheId, nicheName)
                          ├── Apify Actor (Instagram Reel scraper)
                          └── ScrapingService.saveReels()  →  PostgreSQL (reel table)
```

**Files:**
```
backend/src/services/
  ├── scraping.service.ts   → Apify integration + DB persistence
  └── queue.service.ts      → Job lifecycle, Redis persistence
backend/src/routes/admin/
  └── niches.ts             → Admin endpoints for niche + scan management
```

---

### 1. Job Queue

**Architecture:** Single-worker, non-blocking, Redis-backed.

| Detail | Value |
|---|---|
| Storage | In-memory array + Redis (TTL 24h) |
| Concurrency | 1 job at a time (`running` flag) |
| Dispatch | `setTimeout(() => drain(), 0)` — never blocks HTTP response |
| Redis key (job) | `scrape_job:{jobId}` |
| Redis key (index) | `scrape_jobs_by_niche:{nicheId}` (max 100 entries) |

**Job lifecycle:**

```
enqueue()  →  status: "queued"
drain()    →  status: "running", startedAt set
               ↓ success
           →  status: "completed", completedAt set, result: { saved, skipped, durationMs }
               ↓ failure
           →  status: "failed", error message stored
```

**Job ID format:** `scan_${timestamp}_${random4hex}`

**Polling endpoint:**
```
GET /api/admin/niches/jobs/:jobId       → single job status
GET /api/admin/niches/:id/jobs          → last 50 jobs for a niche
```

---

### 2. Apify Integration

The scraper calls the **Apify Instagram Reel scraper actor** (`APIFY_ACTOR_ID` env var).

**Run flow:**

```mermaid
sequenceDiagram
    participant QueueWorker
    participant Apify API
    participant PostgreSQL

    QueueWorker->>Apify API: POST /v2/acts/{ACTOR_ID}/runs { hashtags: [nicheName], resultsLimit: 50 }
    Apify API-->>QueueWorker: { runId, datasetId }

    loop Poll every 3s (max 40 attempts ≈ 2 min)
        QueueWorker->>Apify API: GET /v2/actor-runs/{runId}
        Apify API-->>QueueWorker: { status: "RUNNING" | "SUCCEEDED" | "FAILED" | ... }
    end

    QueueWorker->>Apify API: GET /v2/datasets/{datasetId}/items?format=json&clean=true
    Apify API-->>QueueWorker: [ReelItem, ...]

    QueueWorker->>PostgreSQL: INSERT INTO reel ON CONFLICT (external_id) DO NOTHING
    PostgreSQL-->>QueueWorker: { saved, skipped }
```

**Apify actor input:**
```json
{ "hashtags": ["personalfinance"], "resultsLimit": 50 }
```

**Poll settings:**

| Setting | Value |
|---|---|
| Interval | 3 seconds |
| Max attempts | 40 (~2 min timeout) |
| Retry attempts | 3 (backoff: 2s → 4s → 8s) |
| Success statuses | `SUCCEEDED` |
| Failure statuses | `FAILED`, `ABORTED`, `TIMED-OUT` |

**Fallback:** If `SOCIAL_API_KEY` is not set, `scrapeNiche()` returns `{ saved: 0, skipped: 0 }` immediately — safe for local dev.

---

### 3. Data Mapping

Raw fields from Apify are mapped to the `reel` table as follows:

| Apify Field | DB Column | Notes |
|---|---|---|
| `id` | `external_id` | Unique — used for dedup |
| `ownerUsername` | `username` | |
| `videoViewCount` | `views` | Falls back to `videoPlayCount` |
| `likesCount` | `likes` | |
| `commentsCount` | `comments` | |
| `caption` (first line, 280 chars) | `hook` | Extracted as opening hook |
| `caption` (full) | `caption` | |
| `musicInfo.song_name` | `audio_name` | |
| `musicInfo.audio_id` | `audio_id` | |
| `thumbnailUrl` / `displayUrl` | `thumbnail_url` | |
| `videoUrl` | `video_url` | Source URL (not stored in R2 yet) |
| `takenAt` / `timestamp` | `posted_at` | |
| computed | `engagement_rate` | `((likes + comments) / views) * 100` |
| computed | `is_viral` | `views >= VIRAL_VIEWS_THRESHOLD` (default 100k) |

**R2 storage fields** (populated when media is downloaded):

| DB Column | Purpose |
|---|---|
| `video_r2_key` | R2 object key for the downloaded video file |
| `audio_r2_key` | R2 object key for the extracted audio file |

**Video metadata fields** (populated post-processing):

| DB Column | Purpose |
|---|---|
| `video_length_seconds` | Duration in seconds |
| `cut_frequency_seconds` | Average seconds per cut |

---

### 4. Deduplication

- **Insert-time:** `ON CONFLICT (external_id) DO NOTHING` — new scrapes skip reels already in the DB
- **Manual sweep:** `POST /api/admin/niches/:id/dedupe` runs a SQL window function that keeps the lowest `id` per `external_id` and deletes all duplicates

---

### 5. Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `SOCIAL_API_KEY` | No (degrades gracefully) | Apify API key |
| `APIFY_ACTOR_ID` | No (degrades gracefully) | Instagram scraper actor ID |
| `VIRAL_VIEWS_THRESHOLD` | No (default: 100000) | Min views to flag a reel as viral |

---

### 6. Admin Niche Endpoints (full reference)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/niches` | List all niches with reel counts |
| `POST` | `/api/admin/niches` | Create niche |
| `PUT` | `/api/admin/niches/:id` | Update niche name/description |
| `DELETE` | `/api/admin/niches/:id` | Delete (blocked if reels exist) |
| `POST` | `/api/admin/niches/:id/scan` | Enqueue scrape job |
| `GET` | `/api/admin/niches/jobs/:jobId` | Poll job status |
| `GET` | `/api/admin/niches/:id/jobs` | List last 50 jobs for niche |
| `GET` | `/api/admin/niches/:id/reels` | Paginated reels for niche |
| `POST` | `/api/admin/niches/:id/dedupe` | Remove duplicate reels |
| `DELETE` | `/api/admin/reels/:reelId` | Hard-delete a reel |

All admin endpoints require Firebase Admin JWT + CSRF token and are rate-limited at 30 req/min.

---

## Performance Considerations

### Frontend
- React Query caches reel lists, analyses, and generation history
- Analysis details lazily loaded only when a reel is selected
- Niche dropdown list is cached for 5 minutes (`staleTime: 300_000`)

### Backend
- Database indexes on `reels.nicheId`, `reels.views`, `reel_analyses.reelId`, `generated_content.userId`, `queue_items.userId + status`
- Redis rate limiting prevents AI endpoint abuse
- Claude Haiku used for analysis (cheaper, fast) vs Claude Sonnet for generation (higher quality)
- `scrapedAt` timestamp allows incremental scraping jobs

---

## Security Model

- All studio endpoints require Firebase JWT (`authMiddleware("user")`)
- All mutations require CSRF token (`csrfMiddleware()`)
- All data queries scoped to `userId` — cross-user access is structurally impossible
- Rate limiting applied per IP to all endpoints
- AI prompts include safety guidelines; `ANTHROPIC_API_KEY` absence causes 503 (not 500) to distinguish configuration from runtime errors

---

## Related Documentation

- [Generation System](./generation-system.md) — AI analysis and content generation details
- [API Architecture](../core/api.md) — Middleware patterns
- [Database](../core/database.md) — Drizzle schema and query patterns
- [Authentication](../core/authentication.md) — Auth guard and token flow
- [Admin Dashboard](./admin-dashboard.md) — Niche and reel management

---

*Last updated: March 2026*
