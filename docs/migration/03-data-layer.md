# 03 — Data Layer: DB Schema, API Routes, Reel Pipeline

## Goal

Build the backend data foundation: database tables for reels and analysis, REST endpoints the frontend consumes, and the data ingestion pipeline that populates those tables.

---

## Database Schema

Add to `backend/src/infrastructure/database/drizzle/schema.ts`:

### `reels` table

```typescript
export const reels = pgTable("reels", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").unique(),          // Instagram reel ID
  username: text("username").notNull(),
  niche: text("niche").notNull(),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  engagementRate: numeric("engagement_rate", { precision: 5, scale: 2 }),
  hook: text("hook"),                                 // first 2-3 seconds of text
  caption: text("caption"),
  audioName: text("audio_name"),
  audioId: text("audio_id"),
  thumbnailEmoji: text("thumbnail_emoji"),            // placeholder until real thumbnails
  thumbnailUrl: text("thumbnail_url"),
  videoUrl: text("video_url"),
  postedAt: timestamp("posted_at"),
  scrapedAt: timestamp("scraped_at").defaultNow(),
  isViral: boolean("is_viral").default(false),        // >100K views threshold
});
```

### `reel_analyses` table

```typescript
export const reelAnalyses = pgTable("reel_analyses", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id").references(() => reels.id).notNull(),
  hookPattern: text("hook_pattern"),         // e.g. "If You X, Stop Doing Y"
  hookCategory: text("hook_category"),       // Warning / Authority / Question / etc.
  emotionalTrigger: text("emotional_trigger"), // Fear, Curiosity, Aspiration, etc.
  formatPattern: text("format_pattern"),     // Fast-cut talking head, List, Story, etc.
  ctaType: text("cta_type"),                 // Save, Comment, Share, Tag
  captionFramework: text("caption_framework"), // Problem-Solution-Callout, etc.
  curiosityGapStyle: text("curiosity_gap_style"),
  remixSuggestion: text("remix_suggestion"),
  analysisModel: text("analysis_model"),     // which AI model ran the analysis
  analyzedAt: timestamp("analyzed_at").defaultNow(),
  rawResponse: jsonb("raw_response"),        // full AI response for debugging
});
```

### `generated_content` table

```typescript
export const generatedContent = pgTable("generated_content", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),         // Firebase UID
  sourceReelId: integer("source_reel_id").references(() => reels.id),
  prompt: text("prompt").notNull(),
  generatedHook: text("generated_hook"),
  generatedCaption: text("generated_caption"),
  generatedScript: text("generated_script"),
  model: text("model"),
  status: text("status").default("draft"),   // draft | queued | posted
  createdAt: timestamp("created_at").defaultNow(),
});
```

### `queue_items` table

```typescript
export const queueItems = pgTable("queue_items", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  generatedContentId: integer("generated_content_id").references(() => generatedContent.id),
  scheduledFor: timestamp("scheduled_for"),
  postedAt: timestamp("posted_at"),
  instagramPageId: text("instagram_page_id"),
  status: text("status").default("scheduled"), // scheduled | posted | failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

After schema changes, run:
```bash
cd backend && bun db:generate && bun db:migrate
```

---

## Backend API Routes

Mount all new routes under `/api/` in `backend/src/index.ts`.

### Route file: `backend/src/routes/reels.ts`

```
GET  /api/reels                 → list reels (paginated, filterable by niche)
GET  /api/reels/:id             → single reel with analysis
POST /api/reels/scan            → trigger a niche scan (queues background job)
```

#### `GET /api/reels`

Query params:
- `niche` (required) — e.g. `personal finance`
- `limit` (default 20, max 50)
- `offset` (default 0)
- `minViews` (default 100000)
- `sort` — `views | engagement | recent`

Response shape:
```typescript
{
  reels: Array<{
    id: number;
    username: string;
    views: number;
    likes: number;
    comments: number;
    engagementRate: number;
    hook: string;
    thumbnailEmoji: string;
    daysAgo: number;
    hasAnalysis: boolean;
  }>;
  total: number;
  niche: string;
}
```

#### `GET /api/reels/:id`

Returns full reel data + analysis if available:
```typescript
{
  reel: Reel;
  analysis: ReelAnalysis | null;
}
```

#### `POST /api/reels/scan`

Body: `{ niche: string }`
Auth: `requireAuth`

Queues a background job to scrape/fetch new reels for the niche. Returns immediately with a job ID. The job populates the `reels` table and runs AI analysis.

Response: `{ jobId: string; status: "queued" }`

### Route file: `backend/src/routes/analysis.ts`

```
POST /api/analysis/:reelId      → trigger AI analysis for a specific reel
GET  /api/analysis/:reelId      → get existing analysis
```

### Route file: `backend/src/routes/generation.ts`

```
POST /api/generation            → generate content from a reel + prompt
GET  /api/generation/history    → list user's generated content (paginated)
```

---

## Data Ingestion Pipeline

The `POST /api/reels/scan` endpoint queues a job. The job runs in the background using a Redis-backed queue (ioredis).

### Phase 1: Mock Data (Immediate)

Seed the database with the mock data from `ui-shop/ui-content/reels-analyzer/src/data/mockData.js`. This makes the frontend fully functional without a real scraper.

Create: `backend/src/scripts/seed-mock-reels.ts`

```bash
bun run backend/src/scripts/seed-mock-reels.ts
```

Seeds 8–10 mock reels for niches "personal finance" and "health & fitness".

### Phase 2: Real Data Ingestion

The scanner service lives at `backend/src/services/reel-scanner.ts`.

It supports two modes, selectable via env var `REEL_SOURCE`:

**Mode A: Instagram Graph API** (`REEL_SOURCE=instagram_api`)
- Requires Meta Business account + Graph API token
- Fetches public media from business accounts
- Most reliable but requires approval

**Mode B: Third-party aggregator** (`REEL_SOURCE=aggregator`)
- Uses a social media data API (e.g., RapidAPI social data endpoints)
- Less setup, works immediately
- Set API key as `SOCIAL_API_KEY` in env

**Mode C: Manual import** (`REEL_SOURCE=manual`)
- CSV upload via admin panel
- For bootstrapping before APIs are set up

Add to `backend/src/utils/config/envUtil.ts`:
```typescript
export const REEL_SOURCE = process.env.REEL_SOURCE ?? "manual";
export const SOCIAL_API_KEY = process.env.SOCIAL_API_KEY ?? "";
export const INSTAGRAM_API_TOKEN = process.env.INSTAGRAM_API_TOKEN ?? "";
export const VIRAL_VIEWS_THRESHOLD = Number(process.env.VIRAL_VIEWS_THRESHOLD ?? 100000);
```

---

## Query Keys (Frontend)

Add to `frontend/src/shared/lib/query-keys.ts`:

```typescript
reels: (niche: string) => ["reels", niche] as const,
reel: (id: number) => ["reel", id] as const,
reelAnalysis: (id: number) => ["reel-analysis", id] as const,
generationHistory: (userId: string) => ["generation-history", userId] as const,
```

---

## Acceptance Criteria

- [ ] `bun db:generate && bun db:migrate` runs without errors
- [ ] `GET /api/reels?niche=personal+finance` returns seeded mock data
- [ ] `GET /api/reels/:id` returns a reel with `analysis: null` before analysis runs
- [ ] `POST /api/reels/scan` returns `{ jobId, status: "queued" }` and auth is enforced
- [ ] Frontend `useQuery` for reels renders the left sidebar with real data
- [ ] All routes protected with `requireAuth` middleware
