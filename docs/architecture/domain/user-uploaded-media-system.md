## User-uploaded media library

This document describes the **personal media library**: end-user uploads that are stored for **reuse** across sessions (timeline editor, pickers, etc.), how they differ from **content-scoped** uploads and **platform** music, and the operational and security reasons behind the API shape.

---

## Table of contents

1. [What problem this solves](#what-problem-this-solves)
2. [Conceptual placement in the asset model](#conceptual-placement-in-the-asset-model)
3. [API reference](#api-reference)
4. [Upload pipeline (step by step)](#upload-pipeline-step-by-step)
5. [Why these MIME types and size limits](#why-these-mime-types-and-size-limits)
6. [R2 key layout and URL strategy](#r2-key-layout-and-url-strategy)
7. [Listing and signed URLs](#listing-and-signed-urls)
8. [Delete semantics](#delete-semantics)
9. [Frontend integration](#frontend-integration)
10. [Security, abuse, and cost](#security-abuse-and-cost)
11. [Comparison with `/api/assets`](#comparison-with-apiassets)

---

## What problem this solves

Users need a **durable, private stash** of files they control — B-roll, voice memos, logos, reference images — without tying every file to a single `generated_content` row up front. The product can then let them **pull from the library** into a project when needed, similar to a lightweight DAM (digital asset management) embedded in the app.

**Without this split**, every upload would have to target a specific draft id, or the schema would conflate “library” and “pipeline” state, making queries and cleanup harder.

---

## Conceptual placement in the asset model

All binary media ultimately lands in the unified **`asset`** table (`backend/.../schema.ts`):

| Field | Library uploads |
|-------|------------------|
| `source` | **`uploaded`** |
| `user_id` | Authenticated user (required for these rows) |
| `type` | Derived from MIME: **`video`**, **`audio`**, or **`image`** (coarser than `video_clip` on content assets) |
| `r2_key` | `media/library/{userId}/{uuid}.{ext}` |

**Important:** the list endpoint filters **`source = uploaded`** *and* **`user_id = current user`**. Rows created by TTS (`source: tts`), AI video (`source: generated`), or admin music (`source: platform`) **do not** appear here, even if the user “owns” the content link elsewhere. That keeps the library UI from turning into a dump of every system-generated blob.

---

## API reference

| Method | Path | Auth | CSRF |
|--------|------|------|------|
| GET | `/api/media` | User | No |
| POST | `/api/media/upload` | User | Yes |
| DELETE | `/api/media/:id` | User | Yes |

**Rate limiting:** `rateLimiter("customer")` — consistent with other customer APIs.

---

## Upload pipeline (step by step)

1. **Parse multipart form** — field `file` (required); optional `name` override for display (if the client sends a string; if `name` is accidentally a `File`, the implementation falls back to the original filename).
2. **Classify MIME** — map to `video` | `audio` | `image` or reject with 400. This prevents arbitrary executables or odd types from entering R2 under a media label.
3. **Enforce size** per class (see below).
4. **Generate UUID** primary key and deterministic **R2 key** under `media/library/...`.
5. **Upload** buffer to R2 via `uploadFile`; store returned public-style URL in `r2_url` if the helper provides it.
6. **Insert** `asset` row with `source: uploaded`, `metadata: {}`, `durationMs: null` (library path does not probe duration — avoids FFmpeg dependency on upload hot path).
7. **Respond** with the row plus **`mediaUrl`**: prefer **signed URL** (1 h); on signing failure, fall back to `r2_url` so the client still gets something in dev / misconfig scenarios.

---

## Why these MIME types and size limits

**Allowed types**

- **Video:** `video/mp4`, `video/quicktime` — broad player support; MOV covers many phone exports.
- **Audio:** `audio/mpeg`, `audio/wav`, `audio/mp4` — common interchange; `audio/mp4` covers typical AAC-in-MP4 containers used as “audio.”
- **Image:** `image/jpeg`, `image/png`, `image/webp` — web-safe raster; no SVG (XSS / policy surface) in this route.

**Size ceilings (current code)**

- Video **500 MB** — accommodates long single-file uploads for a personal library without blocking serious creators.
- Audio **50 MB** — far above typical voiceover length; still bounded for DoS protection.
- Image **10 MB** — high-res stills without opening the door to multi-hundred-MB “images.”

These numbers are **policy knobs**: they trade user friction vs storage cost, egress, and worst-case request memory (`Buffer.from(arrayBuffer)` loads the whole file). If you raise limits, consider streaming uploads or presigned **client → R2** flows to keep the API server out of the large-buffer path.

---

## R2 key layout and URL strategy

Pattern: **`media/library/{userId}/{uuid}.{ext}`**

**Why user id in the path?**

- **Namespace isolation** — easy operational audits (“list all objects for user X”).
- **Accidental key collision** — UUID already makes collision negligible; user prefix adds defense in depth and matches mental model of ownership.

**Why not content id in the path?**

Library files are **not** inherently tied to one draft; they may be attached to many compositions over time (depending on product rules). Keeping content id out of the key avoids rewriting objects when a user reuses a clip across projects.

---

## Listing and signed URLs

**GET `/api/media`** returns all library items **newest first** (`orderBy(desc(createdAt))`).

For each row, the handler signs **`r2_key`** with TTL **3600 seconds**. That matches a “working session” expectation: long enough for editing, short enough that leaked URLs expire. If the client keeps a page open for hours, it may need to **refetch** the list to refresh signing (same pattern as music previews in [Music library](./music-library-system.md)).

---

## Delete semantics

**DELETE `/api/media/:id`**

- Validates UUID param.
- Requires row with **matching `user_id`**, **`source = uploaded`**. Prevents deleting another user’s object or wiping a generated/platform asset through this route.
- **Best-effort R2 delete** — logs failures but still removes the DB row so the UI does not show a ghost entry. **Tradeoff:** rare orphan objects in R2 if delete fails; operations can reconcile with lifecycle rules.

---

## Frontend integration

Code lives under **`frontend/src/features/media/`** (modal, cards, upload zone, hooks). Patterns:

- Use **`useAuthenticatedFetch`** / established data-fetch patterns per project conventions in the repo root `CLAUDE.md` for mutations.
- Treat **`mediaUrl`** as **ephemeral**; re-query on long-lived views.

---

## Security, abuse, and cost

- **AuthZ:** Strict `user_id` match on list/delete; no cross-tenant reads.
- **CSRF** on mutations reduces cross-site posting from a victim’s browser when cookies/tokens are involved in the same-site model.
- **Cost:** Every upload consumes R2 storage and egress when played; every list signs **N URLs** (N crypto + R2 API calls). For power users with huge libraries, consider pagination (not present today — full list scan).

---

## Comparison with `/api/assets`

| | Media library | Content assets |
|---|----------------|----------------|
| Endpoint | `/api/media` | `/api/assets` |
| Tied to `generatedContentId` | No | Yes (on upload) |
| Typical video cap | 500 MB | 100 MB |
| `asset.type` values | `video` / `audio` / `image` | `video_clip` / `image` (upload path) |
| Primary use | Reusable bin | This draft’s production line |

See [Content-scoped assets](./content-assets-system.md) for the other side of this split.

---

## Related documentation

- [Content-scoped assets](./content-assets-system.md)
- [Music library](./music-library-system.md) (platform catalog, different `source`)
- [Video playback](./contentai-video-playback-technical-deep-dive.md)
- [Manual editor](./manual-editor-system.md)
