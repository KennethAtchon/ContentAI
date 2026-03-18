
Here’s a concrete implementation plan aligned with your codebase (queue routes, `generated_content`, `queue_item`, chat “send to queue”, and queue UI where **Edit** only appears when `projectId` + `sessionId` exist).

---

## Goal (from TODO)

1. **Hands-off queue** — no manual “add to queue”; every relevant draft appears in the pipeline automatically.  
2. **Full visibility** — one place to see **all** pipeline stages (copy, video shots, voiceover, assembly, manual editor render, publish), including failures.  
3. **Jobs run to completion or explicit failure** — resilient workers + user-visible updates.  
4. **Edit** — opens a real **detail UI** with everything on `generated_content` (+ related jobs/assets), not only “open generate chat”.  
5. **Duplicate** — reliably clones content (and queue row behavior is clear).  

---

## Phase 0 — Product / data model decisions

| Decision | Options | Notes |
|----------|---------|--------|
| **Queue row lifecycle** | A) One `queue_item` per `generated_content` (upsert). B) One row per “attempt”. | A is simpler for “one card per draft”; use job tables for sub-states. |
| **Source of truth for “stages”** | Normalize a **`pipeline_state`** (JSON or columns) vs derive from `video_render_job`, `reel_assets`, `generated_metadata.phase4`, etc. | Deriving is accurate but heavy queries; a denormalized summary updated by workers scales better for the list view. |
| **Realtime** | Polling (React Query refetch) vs SSE vs WebSocket vs Firebase listener. | Fastest path: poll queue detail + job IDs; medium: SSE on `generated_contentId`. |

Lock these before large UI work.

---

## Phase 1 — Auto-enroll in queue (remove manual add)

**Backend**

1. **On `generated_content` create** (generation route, chat save, etc.): ensure a **`queue_item`** exists for that `(userId, generatedContentId)` — `INSERT … ON CONFLICT` or “select then insert” (add **unique** `(user_id, generated_content_id)` if you want one row per draft).  
2. Initial queue status: e.g. **`draft`** or new enum like **`pipeline`** until “ready to schedule”.  
3. **Backfill migration**: for every `generated_content` without a row, insert `queue_item`.  

**Frontend**

4. Remove **Add to queue** / **Send to queue** from chat, Draft detail, generation flows (`useSendToQueue`, `useQueueContent`, any CTAs).  
5. Invalidate queue queries when new content is created so the list updates without refresh.

**Acceptance:** Creating or saving a draft always shows it on `/studio/queue` without user action.

---

## Phase 2 — Pipeline status model (“show everything”)

**Define stages** (example — adjust to your actual jobs):

- Text/copy ready  
- Voiceover (TTS) queued / running / failed  
- Video shots (per-shot or batch)  
- Assembly  
- Manual editor / composition render (optional)  
- Ready for schedule  
- Scheduled / posted / publish failed  

**Backend**

1. **Single read model for list cards**: extend `GET /api/queue` (or add `GET /api/queue/:id/summary`) to return:
   - `generatedContent` snapshot (hook, caption, status, urls, metadata)  
   - **`stages[]`**: `{ id, label, status: pending|running|ok|failed, error?, updatedAt }`  
2. Populate stages by:
   - Reading **`generated_metadata`** (phase4 shots, errors),  
   - Joining **video jobs** (`video_render_job` / composition jobs),  
   - Checking **`reel_assets`** (voiceover, clips, assembled_video).  
3. Optionally maintain **`pipeline_summary` JSON** on `queue_item` or `generated_content`, updated whenever a job completes/fails (workers write once → list stays cheap).

**Frontend**

4. Queue card shows **multi-step strip** or **expandable breakdown** (video failed vs voice failed vs assembly failed).  
5. Filters: e.g. “has failures”, “in progress”, “ready”.

**Acceptance:** User can see *which* step failed without opening logs.

---

## Phase 3 — Jobs don’t silently stall; push updates to client

**Workers**

1. Audit job runners: ensure **retries** with backoff where transient; terminal **failed** with stable `error.code` / message.  
2. No “stuck running” without timeout → move to failed or retry.  

**Events → frontend**

3. Minimum: **poll** job status for in-focus items + refetch queue on interval when any item `running`.  
4. Better: **SSE** or **WebSocket** channel keyed by `userId` or `generatedContentId` pushing `{ contentId, stage, status }`.  
5. Optional: **Firebase** user doc or FCM for “your reel is ready” (if you want push).

**Acceptance:** When a job completes or fails, queue UI updates within N seconds without full page reload.

---

## Phase 4 — Edit: full `generated_content` detail UI

**UX**

1. **Edit** opens a **modal, drawer, or `/studio/queue/:queueItemId` detail route** (recommended for shareable URL).  
2. Sections (all from DB + related data):
   - Copy: hook, caption, script, clean script, scene description  
   - Metadata JSON (readable)  
   - Audio: voiceover / background URLs + status  
   - Video: thumbnail, final URL, list of clip assets / latest assembled  
   - Links: **Open in editor** (`/studio/editor/:generatedContentId`), **Open chat session** (if `sessionId` exists), **Regenerate** (where applicable)  
3. **Edit** can mean inline edit (PATCH content) vs read-only + deep links — scope explicitly (MVP: read-only + actions; v2: PATCH fields).

**Backend**

4. `GET /api/generated-content/:id` or `GET /api/queue/:id/detail` returning full row + jobs + assets (authorized).  

**Frontend**

5. Replace **Edit** `<a href={editHref}>` (only when project+session) with **always-on** entry to this detail view.  

**Acceptance:** Every queue row has **Edit** with full visibility; no dependency on `projectId`/`sessionId`.

---

## Phase 5 — Duplicate: make it actually work

**Backend**

1. Review **`POST /api/queue/:id/duplicate`**: today it copies a subset of columns; extend to **all meaningful fields** (`cleanScriptForAudio`, `sceneDescription`, `generatedMetadata`, audio URLs policy — clone vs clear assets).  
2. Decide: duplicate **only** `generated_content` + new queue row, or also **fork** compositions/assets (probably **new content row**, empty video pipeline).  
3. Return **`newQueueItemId`** + **`newGeneratedContentId`** for navigation.

**Frontend**

4. On success: toast + optional navigate to detail or highlight new card.  
5. Surface API errors (duplicate partial failure).

**Acceptance:** Duplicate creates a usable new draft that appears in queue and can run through the pipeline again.

---

## Phase 6 — Docs, analytics, cleanup

1. Update **`docs/architecture/domain/studio-system.md`** (queue = pipeline dashboard, not “add to schedule only”).  
2. Deprecate **`POST /api/generation/:id/queue`** and **`POST /api/queue`** for client-initiated create, or keep for admin/tools only.  
3. Metrics: stage failure rates, time-to-ready.

---

## Suggested order of work

1. Phase 0 decisions → Phase 1 (auto queue) — unlocks “hands free” immediately.  
2. Phase 4 detail API + Edit UI — fixes the biggest UX gap.  
3. Phase 2 + 3 in parallel (summary model + realtime).  
4. Phase 5 duplicate hardening.  
5. Phase 6.

---

## Risks

- **Duplicate unique constraint**: one queue row per content may break if you currently allow multiple `queue_item` rows per content — check DB and migrate.  
- **Performance**: full joins per list item — use summary JSON or a materialized view.  
- **Edit scope**: full inline editing touches generation/chat consistency; start read-only + deep links.

I can turn this into a checklisted file under `docs/plans/` or append a shortened version to `docs/TODO.md` if you want it tracked in-repo.