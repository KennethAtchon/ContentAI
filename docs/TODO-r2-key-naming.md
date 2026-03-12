# TODO: R2 Key Naming Inconsistency

## Problem

The `videoR2Key` and `audioR2Key` columns in the `reels` table store **full public URLs** (e.g. `https://pub-xxx.r2.dev/testing/video/3819327235434856877.mp4`), not raw R2 object keys (e.g. `video/3819327235434856877.mp4`).

This is because `r2.uploadFile()` returns the constructed public URL, and the scraping service stores that return value directly into the "R2Key" columns.

### Why it's a problem

- Column name says "key" but value is a URL — misleading for any developer reading the schema
- Every consumer must call `extractKeyFromUrl()` before passing to `getFileUrl()` or `deleteFile()` to avoid double-prefixing the `testing/` path
- The `media-url` endpoint already hit this bug (presigned URL pointed at wrong object)

## Options

### Option A: Rename columns to reflect reality

Rename `videoR2Key` → `videoR2Url` and `audioR2Key` → `audioR2Url` across:

- [ ] `backend/src/infrastructure/database/drizzle/schema.ts` — column definitions
- [ ] `backend/src/services/scraping.service.ts` — where values are written
- [ ] `backend/src/routes/reels/index.ts` — where values are read
- [ ] `frontend/src/features/reels/types/reel.types.ts` — TypeScript interface
- [ ] Drizzle migration (`bun db:generate && bun db:migrate`)

### Option B: Store raw keys instead of URLs

Change `scraping.service.ts` to store just the key (strip the URL after upload):

- [ ] After `r2.uploadFile()` returns, call `extractKeyFromUrl()` on the result before saving to DB
- [ ] Update `media-url` endpoint to pass key directly to `getFileUrl()` (remove `extractKeyFromUrl` call)
- [ ] Backfill existing rows: `UPDATE reels SET video_r2_key = regexp_replace(video_r2_key, '^https?://[^/]+/', '') WHERE video_r2_key IS NOT NULL;` (and same for `audio_r2_key`)
- [ ] Handle `testing/` prefix stripping in the backfill if running in dev

### Recommendation

**Option B** is cleaner long-term — columns named "key" should store keys. Option A is less work but perpetuates the confusion.

## Current Workaround

The `GET /api/reels/:id/media-url` endpoint calls `extractKeyFromUrl(reel.videoR2Key)` before passing to `getFileUrl()`. This works but is fragile.
