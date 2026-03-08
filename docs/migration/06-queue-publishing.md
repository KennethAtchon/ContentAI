# 06 — Queue & Publishing System

## Goal

Let users schedule generated content for posting, manage a queue of upcoming posts, and (eventually) automate publishing to Instagram pages. Also sets up the performance feedback loop.

---

## Queue Tab UI

The `/studio/queue` route renders a content queue — a list of scheduled posts with status badges.

### Layout

```
┌──────────────────────────────────────────────────┐
│  QUEUE HEADER: "Content Queue"  [+ Add Post]     │
├──────────────────────────────────────────────────┤
│  Filter: All | Scheduled | Posted | Failed       │
├──────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐    │
│  │  📊 @financeflips adaptation             │    │
│  │  Hook: "You're leaving $400/month..."   │    │
│  │  Scheduled: Mon Mar 9, 10:00 AM          │    │
│  │  Page: @mymoneymoves     [Edit] [Delete] │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │  ✂️ Subscription audit remix              │    │
│  │  Status: POSTED ✓  Mar 7, 9:00 AM        │    │
│  │  Views: 14.2K  Likes: 890                │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

### Components to Build

**`frontend/src/features/queue/components/QueueView.tsx`** — top-level route component

**`frontend/src/features/queue/components/QueueCard.tsx`** — single post card with status, hook preview, schedule time, action buttons

**`frontend/src/features/queue/components/ScheduleModal.tsx`** — modal to set post date/time and target Instagram page

---

## Backend: Queue Routes

**`backend/src/routes/queue.ts`**

```
GET    /api/queue              → list user's queue items (paginated, filterable)
POST   /api/queue              → add a generated content item to queue
PATCH  /api/queue/:id          → update schedule time or page
DELETE /api/queue/:id          → remove from queue
POST   /api/queue/:id/post-now → immediately trigger posting (manual)
```

All routes: `requireAuth`.

### `POST /api/queue`

```typescript
{
  generatedContentId: number;
  scheduledFor: string;           // ISO timestamp
  instagramPageId: string;        // which page to post to
}
```

Validates:
- `generatedContentId` belongs to the authenticated user
- `scheduledFor` is in the future
- `instagramPageId` is registered to the user

Updates `generated_content.status` to `"queued"`.
Creates `queue_items` record.

---

## Instagram Pages

Users register Instagram pages they control. Store in a `instagram_pages` table:

```typescript
export const instagramPages = pgTable("instagram_pages", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  pageId: text("page_id").notNull(),          // Instagram page/account ID
  username: text("username").notNull(),
  accessToken: text("access_token"),          // encrypted Instagram Graph API token
  tokenExpiresAt: timestamp("token_expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**`backend/src/routes/pages.ts`**
```
GET    /api/pages       → list user's connected Instagram pages
POST   /api/pages       → connect a new page (store access token)
DELETE /api/pages/:id   → disconnect a page
```

For the initial MVP, connecting a page is manual (user enters access token). Later, add OAuth flow via Instagram Graph API.

---

## Publishing Worker

The queue system needs a background worker that checks for items due for posting.

**`backend/src/workers/queue-processor.ts`**

Runs on a cron schedule: every 5 minutes.

```typescript
async function processQueue() {
  // Fetch queue_items where scheduledFor <= now AND status = 'scheduled'
  const dueItems = await db.select().from(queueItems)
    .where(and(
      lte(queueItems.scheduledFor, new Date()),
      eq(queueItems.status, "scheduled")
    ));

  for (const item of dueItems) {
    await postToInstagram(item);
  }
}
```

### `postToInstagram(item)`

Phase 1 — Manual/notification only:
- Mark as `posted` in DB
- Send email notification via Resend: "Your post is due — post it now!"
- Include hook text and caption in the email

Phase 2 — Automated via Instagram Graph API:
- Upload media to Instagram container
- Publish container to feed
- Store post ID and fetch initial metrics

Add to `backend/src/utils/config/envUtil.ts`:
```typescript
export const INSTAGRAM_GRAPH_BASE = "https://graph.facebook.com/v21.0";
```

---

## Feedback Loop: Performance Tracking

After a post goes live, the platform tracks its performance over time.

### `post_metrics` table

```typescript
export const postMetrics = pgTable("post_metrics", {
  id: serial("id").primaryKey(),
  queueItemId: integer("queue_item_id").references(() => queueItems.id),
  instagramPostId: text("instagram_post_id"),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  reach: integer("reach").default(0),
  savedCount: integer("saved_count").default(0),
  retentionRate: numeric("retention_rate", { precision: 5, scale: 2 }),
  recordedAt: timestamp("recorded_at").defaultNow(),
});
```

**`backend/src/workers/metrics-collector.ts`**

Runs every 6 hours for the first 48 hours after posting, then daily.

Fetches from Instagram Insights API and upserts into `post_metrics`.

### Insights Display in Queue Tab

For `status: "posted"` items, show a mini performance summary:
- Views, likes, engagement rate
- Performance badge: "🔥 Viral" (>100K views) / "📈 Growing" / "📉 Low"

---

## Subscription Gate

Queue and publishing features are subscription-gated. Use existing Stripe subscription check:
- Free tier: 5 items in queue max, no automated posting
- Pro tier: unlimited queue, automated posting enabled

The `requireAuth` middleware already validates the Firebase token. Add a `requireSubscription` middleware for Pro features:

**`backend/src/middleware/subscription.ts`**
```typescript
export async function requirePro(c: Context, next: Next) {
  // Check user's subscription tier from DB
  // Return 403 if not Pro
}
```

---

## Acceptance Criteria

- [ ] `GET /api/queue` returns user's queue items filtered by status
- [ ] `POST /api/queue` creates a queue item; validates ownership and future date
- [ ] Queue tab renders scheduled items with status badges
- [ ] ScheduleModal lets user pick date/time and target page
- [ ] "Add to Queue" button in GeneratePanel routes to queue flow
- [ ] Queue processor runs (can be triggered manually for testing)
- [ ] Posted items show performance metrics if available
- [ ] Free tier enforces 5-item queue cap (403 on exceeded)
