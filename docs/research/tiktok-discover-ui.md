# TikTok-Style Discover Page — Implementation Research Plan

## Current State vs Target State

| Aspect | Current | Target |
|---|---|---|
| Layout | 3-column grid (sidebar + phone mockup + panel) | Full-screen vertical video feed |
| Video | Emoji placeholder, no playback | Actual video playing inline |
| Navigation | Click reel in list | Swipe/scroll up-down between videos |
| UI overlay | Separate analysis panel | Overlaid on video (TikTok style) |
| Controls | Separate toolbar | Inline on video |

---

## Gap Analysis — What's Missing

### 1. Video URLs Not Exposed in API (Backend — ~2h)

The DB schema already has `videoUrl`, `videoR2Key`, `audioR2Key`, and `thumbnailUrl` columns in the `reels` table. However:

- **`GET /api/reels`** (list) — does NOT return `videoUrl`, `thumbnailUrl`, or R2 keys
- **`GET /api/reels/:id`** (detail) — returns everything via `db.select()`, so these fields are included but the frontend types don't model them

**Work needed:**
- Add `videoUrl` and `thumbnailUrl` to the list endpoint's `.select({})` projection
- Add `videoUrl` and `thumbnailUrl` to the `Reel` and `ReelDetail` TypeScript interfaces
- Verify R2 signed URL generation — R2 keys require presigned URLs since the bucket isn't public; need a `/api/reels/:id/media-url` endpoint OR expose pre-signed URLs inline
- **Risk**: Many reels in DB may have `null` `videoUrl` if scraper hasn't downloaded them yet (check `scraping.service.ts` to confirm what % of reels have video stored)

### 2. Signed URL Strategy for R2 Videos (Backend — ~1–2h)

The R2 bucket is private. Two options:
- **Option A (simpler):** Expose `videoUrl` directly if it's the original Instagram CDN URL — works until CDN URLs expire (typically 24–48h)
- **Option B (robust):** Generate S3-compatible presigned URLs from R2 using `videoR2Key` — requires adding `getSignedUrl` logic to the reels endpoint
- **Recommendation:** Use Option A first since Instagram CDN URLs are already scraped; add R2 presigning later

### 3. TikTok-Style Feed Component (Frontend — ~8–12h, most of the work)

This is a full redesign of the center panel. Key subcomponents:

#### a. `TikTokFeed` — container
- Full-height scroll container (`height: 100vh` or fill available)
- CSS `scroll-snap-type: y mandatory` for snap-to-video scrolling
- Intersection Observer API to detect which video is in view → autoplay that one, pause others
- Virtualization: only render N videos in DOM at once (keep 3 visible, unload far ones)

#### b. `TikTokVideoCard` — per-video unit
- `scroll-snap-align: start`
- `<video>` element with `loop`, `playsInline`, muted by default
- Aspect ratio: 9:16, centered on screen
- Fallback: thumbnail image if no video URL

#### c. TikTok Overlay UI (within each card)
- **Bottom-left**: username (`@handle`), hook/caption text (expandable), audio name with music disc icon
- **Right side column**: avatar, like button + count, comment button + count, share button, bookmark
- **Bottom progress bar**: thin line showing video progress
- **Top-right**: mute/unmute toggle, possibly the niche tag
- Gradient overlay (`linear-gradient(transparent, rgba(0,0,0,0.7))`) on bottom third

#### d. Sound management
- Global muted state — once user unmutes, remember it
- Audio context reuse across videos

#### e. Side panel toggle
- Keep the Analysis Panel but make it a drawer/overlay that slides in from right when user clicks a button (e.g., the "Analyze" action icon on right column)
- Alternatively: keep the 3-column layout but replace the phone mockup center with the full-height feed

### 4. Layout Restructuring (Frontend — ~2–3h)

The current `discover.tsx` uses a rigid `gridTemplateColumns: "220px 1fr 300px"` layout. Options:

**Option A — Keep 3 columns, replace center**
- Left: niche selector + reel list (could become a minimal thumbnails list)
- Center: `TikTokFeed` fills available height
- Right: Analysis panel unchanged

**Option B — Full TikTok experience**
- Center takes full width
- Left sidebar becomes a floating overlay (click to open)
- Analysis panel becomes a slide-in drawer

**Recommendation:** Option A first — faster, preserves existing analysis workflow, still looks very TikTok-like

### 5. Video Playback UX Behaviors (Frontend — ~2h)

Standard TikTok behaviors to implement:
- Click/tap video → pause/resume toggle
- Scroll to next → pause current, play next (via Intersection Observer)
- Keyboard: arrow up/down navigates videos
- Initial load: first video autoplays muted; unmute button visible
- Loading state: skeleton/spinner while video buffers (use `waiting` and `canplay` events)
- Fallback: if no `videoUrl`, show thumbnail + "No video" badge

### 6. Left Sidebar — Thumbnail List Mode (Frontend — ~1h)

Replace the current text-based `ReelList` with thumbnail cards:
- Show `thumbnailUrl` as image background (or emoji fallback)
- Highlight currently playing reel
- Clicking a thumbnail jumps the feed to that video (via `scrollIntoView`)
- Pagination/infinite scroll still works

---

## Data Availability Concern (Critical Unknown)

**How many reels in the database actually have a `videoUrl` or `videoR2Key`?**

Check `scraping.service.ts` to see if the scraper:
1. Downloads actual video files to R2 (`videoR2Key` present) — can serve presigned URLs
2. Only stores CDN links (`videoUrl` only) — links may expire
3. Neither — no video data at all, only metadata scraped

If most reels have no video data, a TikTok-style feed with real video is blocked until scraping is enhanced or we fall back to showing thumbnails with stats overlay.

---

## Implementation Order

| Phase | Work | Files Changed | Est. Time |
|---|---|---|---|
| 1 | Audit DB: check % reels with video data | DB query / scraping service review | 0.5h |
| 2 | Backend: expose `videoUrl`/`thumbnailUrl` in API | `backend/src/routes/reels/index.ts` | 1h |
| 3 | Types: update Reel interfaces | `frontend/src/features/reels/types/reel.types.ts` | 0.5h |
| 4 | Build `TikTokFeed` + `TikTokVideoCard` components | New files in `frontend/src/features/reels/components/` | 6–8h |
| 5 | Restructure `discover.tsx` layout | `frontend/src/routes/studio/discover.tsx` | 2h |
| 6 | Update `ReelList` to thumbnail mode | `frontend/src/features/reels/components/ReelList.tsx` | 1h |
| 7 | Translations: add new i18n keys | `frontend/src/translations/en.json` | 0.5h |
| 8 | R2 presigned URL endpoint (if needed) | `backend/src/routes/reels/index.ts` | 1.5h |

**Total estimate: ~13–15h of focused implementation work**

---

## What We Need Before Starting

1. **Confirm video data availability** — run a DB count query to see how many reels have `videoUrl IS NOT NULL`
2. **Decide on layout option** — Option A (keep 3 columns, swap center) or Option B (full TikTok takeover)
3. **Confirm R2/CDN URL strategy** — are scraped video URLs usable directly, or do we need presigned R2 URLs?

---

## Key Packages (No new dependencies needed)

Everything can be built with:
- Native `<video>` element + `IntersectionObserver` API (no video library needed)
- Existing Tailwind CSS + Framer Motion (for transitions)
- Existing React Query hooks (already fetch reels)
- Scroll snap via pure CSS
