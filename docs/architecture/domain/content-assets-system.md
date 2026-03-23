## Content-scoped assets (`/api/assets`)

This document explains the **content-scoped asset API**: how files are tied to a single piece of **generated content** (a draft / pipeline item), how that design fits the unified `asset` + `content_asset` model, and why behavior differs from the [user media library](./user-uploaded-media-system.md) and from platform-owned files such as the [music library](./music-library-system.md).

---

## Table of contents

1. [Problem and design goals](#problem-and-design-goals)
2. [Data model: one registry, many roles](#data-model-one-registry-many-roles)
3. [Why not only `/api/media`?](#why-not-only-apimedia)
4. [GET `/api/assets` — list with signed URLs](#get-apiassets--list-with-signed-urls)
5. [POST `/api/assets/upload` — attach upload to content](#post-apiassetsupload--attach-upload-to-content)
6. [PATCH `/api/assets/:id` — metadata merges](#patch-apiassetsid--metadata-merges)
7. [DELETE `/api/assets/:id` — links, rows, and R2](#delete-apiassetsid--links-rows-and-r2)
8. [How this connects to video and editor flows](#how-this-connects-to-video-and-editor-flows)
9. [Security model](#security-model)
10. [Limits, tradeoffs, and future considerations](#limits-tradeoffs-and-future-considerations)

---

## Problem and design goals

Historically, “things in R2 tied to a reel or draft” lived in purpose-specific tables. The current schema **consolidates every blob** into a single `asset` table and uses **`content_asset`** as a join: *this asset plays role X for generated content Y*.

**Goals of that consolidation:**

- **One place to reason about storage** — keys, MIME types, sizes, and optional `metadata` JSON live on `asset`. Downstream features (assembly, editor, chat attachments) all speak the same shape.
- **Referential integrity** — `content_asset.generated_content_id` is a real FK with `onDelete: cascade` from content, so when a content row is removed, links disappear predictably. `asset_id` uses `onDelete: restrict` so you cannot delete an asset that is still referenced without first removing links (prevents dangling R2 orphans in the DB layer).
- **Multiple roles per content** — the same logical “piece of work” can have voiceover, music, many `video_clip` rows (per shot), thumbnails, assembled output, etc. The **role** string disambiguates usage for FFmpeg, the editor, and the UI.

The **`/api/assets`** route module is the **HTTP surface** for “list / upload / patch / delete assets in the context of one `generatedContentId`,” with strict ownership checks. It is not the only writer to these tables (background jobs insert generated clips too), but it is the main **client-driven** path for uploads and metadata tweaks.

---

## Data model: one registry, many roles

Relevant tables (see `backend/src/infrastructure/database/drizzle/schema.ts`):

**`asset`**

- `id` (UUID), `user_id` (owner; nullable only for true platform assets).
- `type` — discriminates storage shape / pipeline meaning, e.g. `video_clip`, `image`, `voiceover`, `assembled_video`, etc.
- `source` — how the file entered the system: `uploaded`, `generated`, `tts`, `platform`, `export`, …
- `r2_key` (required), `r2_url`, `mime_type`, `size_bytes`, `duration_ms`, `metadata` (JSON).

**`content_asset` (join)**

- `generated_content_id` → `generated_content.id`
- `asset_id` → `asset.id`
- `role` — must align with how consumers expect to find things, e.g. `video_clip`, `voiceover`, `background_music`, `image`, `assembled_video`, `thumbnail`, `final_video`.

**Why a join instead of `generated_content_id` on `asset` alone?**

- An asset could theoretically be referenced in more than one context (re-use, migration, or future features). The join table keeps **“membership + role”** explicit.
- It matches the mental model: **asset = file**, **content_asset = usage of that file in this production**.

---

## Why not only `/api/media`?

| Concern | `/api/media` | `/api/assets` |
|--------|----------------|----------------|
| **Scope** | All library uploads for the user (`source = uploaded`, no content filter). | Assets linked to **one** `generatedContentId` via `content_asset`. |
| **Typical use** | Reusable bin: “my stock clips / audio / images.” | Production line: “shots and images for **this** draft.” |
| **Upload contract** | Infers type from MIME; caps tuned for a **library** (e.g. larger video ceiling). | Requires `assetType` `video_clip` \| `image`; stricter video cap (**100 MB**) tuned for **per-shot** replacement uploads. |
| **After upload** | Row exists; editor or other flows may still need to **reference** it on a timeline. | Upload **atomically** creates `asset` + `content_asset` so the pipeline sees the new clip immediately for that content id. |

**Why stricter video size on `/api/assets/upload`?**

Per-shot replacement uploads are expected to be short, editor-friendly files. The **500 MB** ceiling on `/api/media` is for a personal library (long B-roll, etc.). Allowing 500 MB per shot would invite abuse, slower assembly downloads, and worse failure modes in FFmpeg concat. The split is a **deliberate product/engineering tradeoff**, not an oversight.

---

## GET `/api/assets` — list with signed URLs

**Query parameters**

- `generatedContentId` (required) — integer primary key of `generated_content`.
- `type` (optional) — filters on `content_asset.role` (e.g. only voiceover-like rows when combined with how the UI calls it).

**Flow**

1. Resolve the authenticated user from `authMiddleware`.
2. Load `generated_content` by id **and** `user_id = auth.user.id`. If missing → **404**. This prevents enumeration of other users’ content ids.
3. Query `content_asset` inner-joined to `asset` for that `generated_content_id`, optionally filtered by `role`.
4. For each row with `r2_key`, generate a **signed GET URL** (TTL **3600 s**). Expose:
   - `mediaUrl` — general playback / preview.
   - `audioUrl` — duplicate of signed URL when `role` is `voiceover` or `background_music` (convenience for audio-specific UI).

**Why signed URLs instead of public R2 URLs?**

Same rationale as elsewhere in the platform: **objects are private in R2**; access is mediated by the API so **authorization is enforced in one place** (see [Video playback](./contentai-video-playback-technical-deep-dive.md)). The client never holds a permanent URL to another user’s object.

**Failure behavior**

If signing fails for one object, the handler still returns the row but with null URLs for that item, rather than failing the entire list — so the UI can show “asset exists but preview unavailable” instead of a hard 500 for unrelated key issues.

---

## POST `/api/assets/upload` — attach upload to content

**Multipart form fields**

- `file` (required)
- `generatedContentId` (required)
- `assetType`: **`video_clip`** or **`image`** only (Zod-enforced)
- `shotIndex` (optional) — stored in `asset.metadata` for ordering during assembly / editor

**Flow**

1. Validate content ownership (same as GET).
2. Validate MIME against `assetType` (mp4/mov for video; jpeg/png/webp for image).
3. Enforce size caps (video **100 MB**, image **10 MB**).
4. Generate UUID `assetId`, upload buffer to R2 under `media/uploads/{userId}/{assetId}.{ext}`.
5. Insert `asset` with `type = assetType`, `source = uploaded`, and metadata including `shotIndex`, `hasEmbeddedAudio` (true for video uploads), `useClipAudio` default **false** (assembly can mix clip audio vs mute — see [Reel generation](./reel-generation-system.md)).
6. Insert `content_asset` linking that asset to `generatedContentId` with `role = assetType`.

**Why `useClipAudio` defaults false?**

The default pipeline assumes **voiceover + optional music** as the primary audio bed; clip audio is opt-in per clip to avoid doubling noise or fighting the mix. The editor or API can flip this via PATCH metadata later.

---

## PATCH `/api/assets/:id` — metadata merges

**Body:** `{ "metadata": { ... } }` — shallow merge into existing `asset.metadata` (top-level keys in the request overwrite or add; nested objects are not deep-merged unless the service is extended to do so).

**Authorization:** asset must exist and `asset.user_id = auth.user.id`.

**Why PATCH instead of PUT?**

Timeline and pipeline code incrementally adjust flags (`useClipAudio`, trim hints, etc.) without resending the entire JSON blob. Merge semantics reduce race conditions between UI autosave and background jobs **as long as** different keys are touched.

---

## DELETE `/api/assets/:id` — links, rows, and R2

**Order of operations (important for FK constraints):**

1. Delete **`content_asset`** rows pointing at this `asset_id` first (`onDelete` on `asset` from join side would otherwise block or behave differently depending on migration).
2. Delete the **`asset`** row.

**R2 deletion policy**

- If `type === "voiceover"`, the handler attempts **`deleteFile(r2_key)`** — voiceovers are user-specific audio blobs; removing them should reclaim storage.
- **Other types** (e.g. `video_clip`, `image`) **do not** delete R2 in this handler in the current code — likely to avoid accidental removal of shared or re-used objects during partial unlinks. **Operational implication:** orphaned R2 objects may require periodic cleanup if deletes are frequent. When extending this, align with product rules (e.g. delete R2 for `source = uploaded` clips only).

---

## How this connects to video and editor flows

- **[Reel generation](./reel-generation-system.md)** — workers create `asset` rows with `source: generated` (or similar) and attach them with role `video_clip` and ordered `shotIndex` in metadata. The same GET `/api/assets` path is how the frontend discovers clips for assembly and status UIs.
- **[Manual editor](./manual-editor-system.md)** — timeline state references assets; uploads through this API seed or replace shots tied to the same `generatedContentId`.
- **[Audio & TTS](./audio-tts-system.md)** — voiceovers appear as assets with role `voiceover`; GET may filter by `type` / role depending on client.

---

## Security model

- **Authentication:** all routes use `authMiddleware("user")`.
- **Authorization:** every mutating path checks **Postgres ownership** (`generated_content.user_id` or `asset.user_id`), not just “valid JWT.”
- **CSRF:** required on POST upload, PATCH, DELETE — state-changing browser requests must present a token bound to the user (see [Security](../core/security.md)).
- **Rate limiting:** `rateLimiter("customer")` — aligns with other customer-tier mutating APIs.

---

## Limits, tradeoffs, and future considerations

- **Role vocabulary** is stringly typed — typos or drift between backend writers and the editor could cause “missing clip” bugs. Prefer central constants or enums when adding new roles.
- **Concurrent upload + assembly** — assembly jobs snapshot whatever assets exist at run time; uploading a new clip mid-assembly may require explicit user action to re-run (product decision).
- **Deduplication** — the same file uploaded twice creates two `asset` rows (two UUIDs). A future optimization could content-address or hash-dedupe for cost savings; today simplicity wins.

---

## Related documentation

- [User-uploaded media library](./user-uploaded-media-system.md)
- [Reel generation system](./reel-generation-system.md)
- [Manual editor system](./manual-editor-system.md)
- [Audio & TTS](./audio-tts-system.md)
- [Video playback](./contentai-video-playback-technical-deep-dive.md)
