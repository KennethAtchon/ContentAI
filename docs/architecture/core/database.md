# Database & Validation

## Overview

PostgreSQL database managed with **Drizzle ORM** (not Prisma). Zod schemas validate all API inputs server-side via dedicated middleware.

**Stack:**
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM (`drizzle-orm/pg-core`)
- **Schema location**: `backend/src/infrastructure/database/drizzle/schema.ts`
- **Migrations**: `bun db:generate` → `bun db:migrate` (from `backend/`)
- **Validation**: Zod — enforced by `validateBody()` / `validateQuery()` middleware

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Table Definitions](#table-definitions)
3. [Drizzle Client](#drizzle-client)
4. [Query Patterns](#query-patterns)
5. [Data Validation](#data-validation)
6. [Best Practices](#best-practices)

---

## Schema Overview

```
backend/src/infrastructure/database/drizzle/schema.ts

Tables:
  user              ← Accounts, roles, profile
  order             ← One-time purchases
  contact_message   ← Contact form submissions
  feature_usage     ← Usage history for feature tracking
  niche             ← Content niches
  reel              ← Instagram reel data
  reel_analysis     ← AI-generated analysis per reel
  generated_content ← AI-generated hooks, captions, scripts
  instagram_page    ← Connected Instagram pages
  queue_item        ← Content scheduling queue
```

**Note:** Subscriptions live in **Firestore**, not PostgreSQL. See [subscription-system.md](../domain/subscription-system.md).

---

## Table Definitions

### `user`
```typescript
export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firebaseUid: text("firebase_uid").unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  timezone: text("timezone").default("UTC"),
  role: text("role").notNull().default("user"),         // "user" | "admin"
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  lastLogin: timestamp("last_login"),
  hasUsedFreeTrial: boolean("has_used_free_trial").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

### `order`
```typescript
export const orders = pgTable("order", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status"),
  stripeSessionId: text("stripe_session_id").unique(),
  skipPayment: boolean("skip_payment").notNull().default(false),
  orderType: text("order_type").notNull().default("one_time"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  deletedBy: text("deleted_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("orders_user_id_idx").on(t.userId)]);
```

### `niche`
```typescript
export const niches = pgTable("niche", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
});
```

### `reel`
```typescript
export const reels = pgTable("reel", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").unique(),
  username: text("username").notNull(),
  nicheId: integer("niche_id").notNull().references(() => niches.id, { onDelete: "restrict" }),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  engagementRate: numeric("engagement_rate", { precision: 5, scale: 2 }),
  hook: text("hook"),
  caption: text("caption"),
  audioName: text("audio_name"),
  audioId: text("audio_id"),
  thumbnailEmoji: text("thumbnail_emoji"),
  thumbnailUrl: text("thumbnail_url"),
  videoUrl: text("video_url"),
  postedAt: timestamp("posted_at"),
  daysAgo: integer("days_ago"),
  isViral: boolean("is_viral").notNull().default(false),
  scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("reels_niche_id_idx").on(t.nicheId),
  index("reels_views_idx").on(t.views),
]);
```

### `reel_analysis`
```typescript
export const reelAnalyses = pgTable("reel_analysis", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id").notNull(),
  hookPattern: text("hook_pattern"),
  hookCategory: text("hook_category"),
  emotionalTrigger: text("emotional_trigger"),
  formatPattern: text("format_pattern"),
  ctaType: text("cta_type"),
  captionFramework: text("caption_framework"),
  curiosityGapStyle: text("curiosity_gap_style"),
  remixSuggestion: text("remix_suggestion"),
  analysisModel: text("analysis_model"),
  rawResponse: jsonb("raw_response"),
  analyzedAt: timestamp("analyzed_at").notNull().defaultNow(),
}, (t) => [index("reel_analyses_reel_id_idx").on(t.reelId)]);
```

### `generated_content`
```typescript
export const generatedContent = pgTable("generated_content", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  sourceReelId: integer("source_reel_id"),
  prompt: text("prompt").notNull(),
  generatedHook: text("generated_hook"),
  generatedCaption: text("generated_caption"),
  generatedScript: text("generated_script"),
  outputType: text("output_type").notNull().default("full"),  // "hook" | "caption" | "full"
  model: text("model"),
  status: text("status").notNull().default("draft"),          // "draft" | "queued" | "posted" | "failed"
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("generated_content_user_id_idx").on(t.userId),
  index("generated_content_source_reel_idx").on(t.sourceReelId),
]);
```

### `instagram_page`
```typescript
export const instagramPages = pgTable("instagram_page", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  pageId: text("page_id").notNull(),
  username: text("username").notNull(),
  accessToken: text("access_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### `queue_item`
```typescript
export const queueItems = pgTable("queue_item", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  generatedContentId: integer("generated_content_id"),
  scheduledFor: timestamp("scheduled_for"),
  postedAt: timestamp("posted_at"),
  instagramPageId: text("instagram_page_id"),
  status: text("status").notNull().default("scheduled"),  // "scheduled" | "posted" | "failed"
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("queue_items_user_id_idx").on(t.userId),
  index("queue_items_status_idx").on(t.status),
]);
```

### Relations
```typescript
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  featureUsages: many(featureUsages),
}));

export const nichesRelations = relations(niches, ({ many }) => ({
  reels: many(reels),
}));

export const reelsRelations = relations(reels, ({ one }) => ({
  niche: one(niches, { fields: [reels.nicheId], references: [niches.id] }),
}));
```

---

## Drizzle Client

**Location:** `backend/src/services/db/db.ts`

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../infrastructure/database/drizzle/schema";
import { DATABASE_URL } from "../../utils/config/envUtil";

const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle(pool, { schema });
```

Import and use in route/service files:
```typescript
import { db } from "../services/db/db";
import { users, reels, ... } from "../infrastructure/database/drizzle/schema";
import { eq, and, desc, asc, gte, lte, sql } from "drizzle-orm";
```

---

## Query Patterns

### Select (Read)
```typescript
// Single user by id
const [user] = await db.select().from(users).where(eq(users.id, userId));

// Multiple with filter
const activeReels = await db
  .select()
  .from(reels)
  .where(and(eq(reels.nicheId, nicheId), eq(reels.isViral, true)))
  .orderBy(desc(reels.views))
  .limit(20);

// With join
const reelsWithNiche = await db
  .select({
    id: reels.id,
    username: reels.username,
    views: reels.views,
    nicheName: niches.name,
  })
  .from(reels)
  .innerJoin(niches, eq(reels.nicheId, niches.id))
  .where(eq(niches.isActive, true));
```

### Insert (Create)
```typescript
const [newReel] = await db
  .insert(reels)
  .values({
    username: "@fitnessguru",
    nicheId: 3,
    views: 1_200_000,
    hook: "3 exercises you're doing WRONG...",
    isViral: true,
  })
  .returning();
```

### Upsert (Insert or Update)
```typescript
// Used in authMiddleware to create or refresh user on login
const [user] = await db
  .insert(users)
  .values({ firebaseUid, email, name, role: "user", isActive: true })
  .onConflictDoUpdate({
    target: users.firebaseUid,
    set: { email, name, lastLogin: new Date() },
  })
  .returning({ id: users.id, email: users.email, role: users.role });
```

### Update
```typescript
await db
  .update(reels)
  .set({ isViral: true, views: 5_000_000 })
  .where(eq(reels.id, reelId));
```

### Delete (Hard)
```typescript
await db.delete(reels).where(eq(reels.id, reelId));
```

### Soft Delete
```typescript
// Users and orders use soft delete pattern
await db
  .update(users)
  .set({ isDeleted: true, deletedAt: new Date() })
  .where(eq(users.id, userId));
```

### Pagination
```typescript
const limit = 20;
const offset = (page - 1) * limit;

const [{ total }] = await db
  .select({ total: sql<number>`count(*)::int` })
  .from(reels)
  .where(eq(reels.nicheId, nicheId));

const items = await db
  .select()
  .from(reels)
  .where(eq(reels.nicheId, nicheId))
  .orderBy(desc(reels.views))
  .limit(limit)
  .offset(offset);
```

### Studio-Specific Queries

```typescript
// Reels with analysis status for a niche
const reelsWithAnalysis = await db
  .select({
    reel: reels,
    hasAnalysis: sql<boolean>`CASE WHEN ${reelAnalyses.id} IS NOT NULL THEN true ELSE false END`,
  })
  .from(reels)
  .leftJoin(reelAnalyses, eq(reelAnalyses.reelId, reels.id))
  .where(eq(reels.nicheId, nicheId))
  .orderBy(desc(reels.views));

// User's generated content history
const history = await db
  .select()
  .from(generatedContent)
  .where(and(
    eq(generatedContent.userId, userId),
    eq(generatedContent.status, "draft"),
  ))
  .orderBy(desc(generatedContent.createdAt))
  .limit(50);

// Queue items for a user (with scheduled date filter)
const queue = await db
  .select()
  .from(queueItems)
  .where(and(
    eq(queueItems.userId, userId),
    eq(queueItems.status, "scheduled"),
    gte(queueItems.scheduledFor, new Date()),
  ))
  .orderBy(asc(queueItems.scheduledFor));
```

---

## Data Validation

All API inputs are validated by Zod middleware before the route handler executes. The validated data is available via `c.get("validatedBody")` and `c.get("validatedQuery")`.

### Middleware Usage
```typescript
import { validateBody, validateQuery } from "../middleware/protection";
import { z } from "zod";

const createGenerationSchema = z.object({
  sourceReelId: z.number().int().positive(),
  prompt: z.string().min(1).max(1000),
  outputType: z.enum(["full", "hook", "caption"]),
});

app.post(
  "/",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  validateBody(createGenerationSchema),
  async (c) => {
    const body = c.get("validatedBody") as z.infer<typeof createGenerationSchema>;
    // body.sourceReelId, body.prompt, body.outputType are type-safe
  }
);
```

### Common Validation Schemas

```typescript
// Reel discovery query
const reelQuerySchema = z.object({
  nicheId: z.string().optional(),
  limit: z.string().optional().transform(Number),
  offset: z.string().optional().transform(Number),
  minViews: z.string().optional().transform(Number),
  sort: z.enum(["views", "engagementRate", "createdAt"]).optional(),
});

// Queue item update
const queueUpdateSchema = z.object({
  scheduledFor: z.string().datetime().optional(),
  instagramPageId: z.string().optional(),
  status: z.enum(["scheduled", "posted", "failed"]).optional(),
});

// Admin niche upsert
const nicheSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});
```

---

## Best Practices

### Security
- ✅ Always use Drizzle parameterized queries — SQL injection is not possible
- ✅ Validate all inputs at the API boundary with `validateBody()` / `validateQuery()`
- ✅ Scope queries to `userId` for user-owned data — never let a user access another user's data

### Performance
- ✅ Use `index()` on frequently filtered columns (`nicheId`, `userId`, `status`, `views`)
- ✅ Select only needed columns (avoid `select *` in production queries where possible)
- ✅ Paginate all list endpoints
- ✅ Use `sql<number>` count aggregations instead of fetching all rows

### Data Integrity
- ✅ Use foreign key references (e.g., `reels.nicheId → niches.id`)
- ✅ Use soft delete (`isDeleted`, `deletedAt`) for user-visible data
- ✅ Use `$defaultFn(() => crypto.randomUUID())` for text primary keys
- ✅ Use `$onUpdateFn(() => new Date())` for `updatedAt` fields

---

## Related Documentation

- [API Architecture](./api.md) — Middleware composition
- [Studio System](../domain/studio-system.md) — Reel/generation data flows
- [Subscription System](../domain/subscription-system.md) — Firestore vs PostgreSQL split

---

*Last updated: March 2026*
