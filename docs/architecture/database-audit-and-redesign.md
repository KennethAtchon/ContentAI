# Database Audit & Redesign

> **Status:** Dev reset approved. No backwards compatibility. Nuke it and fix it right.

---

## Verdict

The schema works, but it's accumulating debt fast. There are **5 structural problems** that will cause real pain as the product grows: fragmented asset storage, missing FK constraints, a polymorphic jsonb ref pattern that can't be queried properly, inconsistent ID strategies, and a denormalized URL anti-pattern that's already documented as a tension point in the code. None of these are catastrophic today. All of them will be.

This document proposes a reset-and-fix. Everything here can be implemented as a clean migration from scratch since we're in dev.

---

## Issues Found

### Issue 1 — Asset Fragmentation (Critical)

**Tables affected:** `reel_asset`, `media_item`, `generated_content`, `music_tracks`, `export_jobs`

There are **five** different places in the schema that store R2 file pointers. Each invented its own structure independently:

| Table | R2 fields | Owner |
|---|---|---|
| `reel_asset` | `r2Key`, `r2Url` | user, via generated content |
| `media_item` | `r2Key`, `r2Url` | user, direct upload |
| `generated_content` | `voiceover_url`, `background_audio_url`, `thumbnail_r2_key`, `video_r2_url` | user, denormalized |
| `music_tracks` | `r2_key` | platform/admin |
| `export_jobs` | `r2_key`, `r2_url` | user, job output |

This means:
- No single query tells you how much R2 storage a user is consuming
- No single place to garbage-collect orphaned files
- Adding a new asset type (e.g. subtitles, preview clips) means touching multiple tables
- `generated_content` has a code comment that literally says *"source of truth is reel_assets"* — meaning the data is already duplicated and acknowledged as such

**Fix:** Unified `assets` table. Everything else holds a FK or uses a join table. Details in [Redesign](#redesign).

---

### Issue 2 — Missing Foreign Key Constraints (High)

Half the `userId` columns in this schema are bare `text` fields with no FK reference to the `users` table. If a user is deleted, orphaned rows silently accumulate. Same goes for several cross-table relationships.

**Missing FK constraints:**

| Table | Column | Should reference |
|---|---|---|
| `orders` | `user_id` | `users.id` |
| `feature_usages` | `user_id` | `users.id` |
| `reel_analyses` | `reel_id` | `reels.id` |
| `generated_content` | `source_reel_id` | `reels.id` |
| `generated_content` | `parent_id` | `generated_content.id` (self) |
| `instagram_pages` | `user_id` | `users.id` |
| `queue_items` | `generated_content_id` | `generated_content.id` |
| `reel_assets` | `user_id` | `users.id` |
| `chat_messages` | `generated_content_id` | `generated_content.id` |

Additionally, `queue_items.instagram_page_id` is `text` but `instagram_pages.id` is `serial` (integer). **Type mismatch** — this FK can never be enforced at the DB level in its current form.

**Fix:** Add proper FK references on all of the above. Fix the type mismatch on `queue_items`.

---

### Issue 3 — jsonb Arrays as Unenforceable Foreign Keys (High)

**Tables affected:** `chat_messages`

```
reelRefs:  jsonb  -- "Array of reel IDs referenced in this message"
mediaRefs: jsonb  -- "Array of media_item IDs attached to this message"
```

This is the classic jsonb-as-FK anti-pattern. These arrays:
- Cannot have referential integrity enforced
- Cannot be indexed for reverse lookup ("which messages reference reel 42?")
- Cannot cascade on delete — if a reel or media item is deleted, stale IDs silently remain
- Require application-side parsing for any relational query

**Fix:** Replace with a proper `message_attachments` join table with an `entity_type` discriminator. See [Redesign](#redesign).

---

### Issue 4 — Inconsistent ID Strategy (Medium)

The schema uses two completely different primary key strategies with no apparent reasoning:

**`serial` (integer auto-increment):** `niches`, `reels`, `reel_analyses`, `trending_audio`, `instagram_pages`, `queue_items`, `music_tracks`, `generated_content`

**`text` (UUID):** `users`, `orders`, `contact_messages`, `feature_usages`, `projects`, `chat_sessions`, `chat_messages`, `reel_assets`, `media_items`, `edit_projects`, `export_jobs`, `system_config`, `user_settings`, `ai_cost_ledger`

This means cross-table joins require knowing which type a FK is, you can't build generic ID handling utilities, and serial IDs leak row counts to clients (a minor but real security info leak).

**Fix:** Standardize on UUID strings everywhere. The tables that currently use `serial` are mostly internal/admin (`niches`, `reels`, `reel_analyses`) — these have no client-facing exposure concern, but consistency matters for tooling.

---

### Issue 5 — `json` vs `jsonb` Inconsistency (Low)

`feature_usages.input_data` and `feature_usages.result_data` use `json` (plain text storage). Every other metadata column in the schema uses `jsonb` (binary, indexable). `json` cannot be indexed and parses on every read.

**Fix:** Change both to `jsonb`.

---

### Issue 6 — `generated_content` Is Doing Too Much (Medium)

This table mixes three concerns:
1. The AI-authored copy (hook, script, caption, metadata)
2. Asset URL pointers (voiceover, background audio, thumbnail, final video)
3. Version chain state (parentId, version, status)

The asset URL columns are the worst offenders — the code comment on line 223 already flags them as denormalized duplicates of `reel_assets`. This means writes have to update two places, and reads might see stale URLs.

**Fix:** With a unified `assets` table + `content_assets` join table, remove `voiceover_url`, `background_audio_url`, `thumbnail_r2_key`, and `video_r2_url` from `generated_content`. The version chain and status fields are fine where they are.

---

## Redesign

### New `assets` table

The single source of truth for every file stored in R2. Every other table either references it via FK or via a join table.

```ts
export const assets = pgTable(
  "asset",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    // nullable for platform assets (music tracks, system-generated)

    type: text("type").notNull(),
    // "video" | "image" | "audio" | "voiceover" | "thumbnail"

    source: text("source").notNull(),
    // "uploaded"  — user uploaded via media library
    // "generated" — produced by video render pipeline
    // "tts"       — produced by text-to-speech
    // "platform"  — admin-uploaded platform asset (music tracks)
    // "export"    — final render from an export job

    name: text("name"),         // original filename, null for generated assets
    mimeType: text("mime_type"),
    r2Key: text("r2_key").notNull(),
    r2Url: text("r2_url"),
    sizeBytes: integer("size_bytes"),
    durationMs: integer("duration_ms"),
    metadata: jsonb("metadata").default({}),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("assets_user_id_idx").on(t.userId),
    index("assets_type_idx").on(t.type),
    index("assets_source_idx").on(t.source),
  ],
);
```

### New `content_assets` join table

Replaces the denormalized URL columns on `generated_content` and replaces `reel_assets`.

```ts
export const contentAssets = pgTable(
  "content_asset",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    generatedContentId: integer("generated_content_id")
      .notNull()
      .references(() => generatedContent.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    // "voiceover" | "background_music" | "thumbnail" | "final_video" | "video_clip"
  },
  (t) => [
    index("content_assets_content_idx").on(t.generatedContentId),
    index("content_assets_asset_idx").on(t.assetId),
    uniqueIndex("content_assets_content_role_idx").on(t.generatedContentId, t.role),
    // unique constraint: one asset per role per content (e.g. one voiceover, one final video)
    // remove the uniqueIndex on role if a content item can have multiple clips
  ],
);
```

### `music_tracks` — keep, but reference assets

Music tracks are a platform catalog with domain-specific metadata (mood, genre, artist). They're not user assets. Keep the table, but strip the `r2_key` and make it reference an asset row instead.

```ts
export const musicTracks = pgTable("music_track", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  // changed from serial to UUID for consistency
  assetId: text("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  artistName: text("artist_name"),
  durationSeconds: integer("duration_seconds").notNull(),
  mood: text("mood").notNull(),
  genre: text("genre"),
  isActive: boolean("is_active").notNull().default(true),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### `export_jobs` — reference assets

Remove `r2_key`/`r2_url`, replace with `output_asset_id`:

```ts
outputAssetId: text("output_asset_id")
  .references(() => assets.id, { onDelete: "set null" }),
```

### New `message_attachments` join table

Replaces `chat_messages.reel_refs` (jsonb) and `chat_messages.media_refs` (jsonb):

```ts
export const messageAttachments = pgTable(
  "message_attachment",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    // "reel" | "asset" | "generated_content"
    reelId: integer("reel_id").references(() => reels.id, { onDelete: "set null" }),
    assetId: text("asset_id").references(() => assets.id, { onDelete: "set null" }),
    generatedContentId: integer("generated_content_id").references(
      () => generatedContent.id, { onDelete: "set null" }
    ),
  },
  (t) => [
    index("message_attachments_message_idx").on(t.messageId),
    index("message_attachments_asset_idx").on(t.assetId),
    index("message_attachments_reel_idx").on(t.reelId),
  ],
);
```

### `generated_content` — stripped

Remove the four denormalized asset URL columns:

```diff
- voiceoverUrl: text("voiceover_url"),
- backgroundAudioUrl: text("background_audio_url"),
- thumbnailR2Key: text("thumbnail_r2_key"),
- videoR2Url: text("video_r2_url"),
```

These are now queryable via `content_assets WHERE generated_content_id = ? AND role = 'voiceover'`.

For the fast-read concern: on the hot publish path, load the content row + a single `WHERE generated_content_id = ? AND role IN ('voiceover', 'background_music', 'final_video')` query. It's one extra JOIN, not a performance problem.

### Fix all missing FKs

```ts
// orders
userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),

// feature_usages
userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

// reel_analyses
reelId: integer("reel_id").notNull().references(() => reels.id, { onDelete: "cascade" }),

// generated_content
sourceReelId: integer("source_reel_id").references(() => reels.id, { onDelete: "set null" }),
parentId: integer("parent_id").references((): AnyPgColumn => generatedContent.id),

// instagram_pages
userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

// queue_items — also fix type: serial → text/UUID on instagram_pages, or integer here
generatedContentId: integer("generated_content_id").references(() => generatedContent.id, { onDelete: "cascade" }),
instagramPageId: integer("instagram_page_id").references(() => instagramPages.id, { onDelete: "set null" }),
// ^^^ was text — fix the type to match instagram_pages.id

// chat_messages
generatedContentId: integer("generated_content_id").references(() => generatedContent.id, { onDelete: "set null" }),
```

### Fix `json` → `jsonb`

```diff
- inputData: json("input_data").notNull(),
- resultData: json("result_data").notNull(),
+ inputData: jsonb("input_data").notNull(),
+ resultData: jsonb("result_data").notNull(),
```

### Standardize IDs to UUID

Tables to migrate from `serial` to `text` UUID:
- `niches` — referenced by `reels.niche_id`
- `reels` — referenced by `reel_analyses`, `generated_content`, `message_attachments`
- `reel_analyses` — standalone
- `trending_audio` — standalone
- `instagram_pages` — referenced by `queue_items`
- `queue_items` — standalone
- `music_tracks` — already touched above
- `generated_content` — referenced heavily; this one has the biggest blast radius, but we're resetting anyway

---

## Tables Overview After Redesign

| Table | Change |
|---|---|
| `assets` | **NEW** — central R2 file registry |
| `content_assets` | **NEW** — replaces `reel_assets` + denormalized URL cols |
| `message_attachments` | **NEW** — replaces jsonb `reel_refs` + `media_refs` |
| `reel_assets` | **DELETED** — replaced by `content_assets` |
| `media_items` | **DELETED** — replaced by `assets` with `source = "uploaded"` |
| `music_tracks` | **MODIFIED** — drops `r2_key`, gains `asset_id` FK |
| `export_jobs` | **MODIFIED** — drops `r2_key`/`r2_url`, gains `output_asset_id` FK |
| `generated_content` | **MODIFIED** — drops 4 denormalized URL cols |
| `chat_messages` | **MODIFIED** — drops `reel_refs`/`media_refs` jsonb |
| All serial ID tables | **MODIFIED** — migrate to UUID |
| All missing FK tables | **MODIFIED** — add FK constraints + fix type mismatch |
| `feature_usages` | **MODIFIED** — `json` → `jsonb` |

---

## How to Implement

Since we're resetting the dev database:

1. Update `schema.ts` with all changes above
2. Delete all existing migration files in `drizzle/migrations/`
3. Run `bun db:generate` to generate a single fresh migration
4. Run `bun db:migrate` against a fresh database
5. Update all service/query files that reference the dropped tables/columns

**Code touchpoints to update after schema changes:**
- Any service importing `ReelAsset` / `MediaItem` types → switch to `Asset`
- `chat-tools.ts` — likely building `mediaRefs`/`reelRefs` jsonb arrays
- `generatedContent` service — remove URL field writes, use `content_assets` instead
- Media library routes — switch from `media_items` table to `assets` with `source = "uploaded"`
- Export job routes — write `output_asset_id` instead of `r2_key`/`r2_url`
- Music track admin routes — create an `asset` row first, then create `music_track` with the FK
