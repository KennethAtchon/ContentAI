# Unified Backend & Data Layer Plan

**Date:** 2026-03-21
**Status:** Proposal
**Author:** Product (internal)

---

## 1. The Core Idea

Two editing surfaces. One data layer. Changes made in either place flow to the other automatically.

- **AI Workspace** (`/studio/generate`) — fast, chat-driven assembly. Pick a reel, generate copy, trigger voiceover and clips, hit "Assemble." The AI does the heavy lifting.
- **Manual Editor** (`/studio/editor`) — precise, timeline-based editing. Trim clips, add transitions, fine-tune timing. Full NLE control.

These are intentionally different tools for different moments in the creative process. We are **not** merging them. What we are fixing is that right now they are two disconnected silos pointing at the same database entity (`generated_content`) but not actually talking to each other. A new assembly in the AI workspace does not update what the editor shows. An edit made in the editor is invisible to the queue and the workspace.

The fix is a clean, shared backend layer: one canonical representation of timeline state, one assembly pipeline, one asset registry, and reactive queries so each surface always shows current data.

---

## 2. Current System Map

### Two Surfaces, Theoretically One Entity

Both surfaces ultimately operate on the same database record — `generated_content` — but they were built independently and share almost no backend logic.

#### Surface A: AI Workspace (`/studio/generate`)

1. User chats with AI → AI saves drafts as `generated_content` rows
2. `ContentWorkspace` side panel (380px) handles: Drafts, Audio generation, Video clip generation
3. User clicks "Assemble" in `VideoWorkspacePanel`
4. `use-assemble-reel.ts` calls `POST /api/video/assemble`
5. Backend runs FFmpeg assembly → creates `assembled_video` asset → **also** upserts an `edit_project` → returns a redirect URL
6. Frontend navigates to `/studio/editor?contentId=X`

**Key files:**
- `frontend/src/features/video/components/VideoWorkspacePanel.tsx`
- `frontend/src/features/video/hooks/use-assemble-reel.ts`
- `backend/src/routes/video/index.ts` (assemble handler ~line 1936)

#### Surface B: Manual Editor (`/studio/editor`)

1. User opens or creates an `edit_project`
2. `EditorLayout` loads with Timeline, MediaPanel, PreviewArea, Inspector
3. `MediaPanel` fetches assets via `GET /api/assets?generatedContentId=X`
4. User edits → auto-save debounces to `PATCH /api/editor/:id`
5. Export via `POST /api/editor/:id/export`

**Key files:**
- `frontend/src/features/editor/components/EditorLayout.tsx`
- `frontend/src/features/editor/hooks/useEditorStore.ts`
- `backend/src/routes/editor/index.ts`
- `backend/src/routes/editor/services/build-initial-timeline.ts`

#### The Queue (`/studio/queue`)

Pipeline dashboard for all `generated_content`. Shows stages: Copy → Voiceover → Video Clips → Assembly → Manual Edit. "Open in Editor" and "Open in Chat" links. Currently a read-only observer — it does not receive updates from either surface.

### Data Model (Current)

```
generated_content (serial PK)
  |-- userId, prompt, generatedHook, generatedScript, generatedCaption
  |-- status: draft -> queued -> processing -> published | failed
  |-- parentId (version chain)
  |
  |-- content_asset (join table)
  |     |-- assetId -> asset
  |     |-- role: voiceover | background_music | video_clip | assembled_video | image
  |
  |-- edit_project (1:1 per user+content, optional)
  |     |-- tracks (JSONB timeline state)
  |     |-- status: draft | published
  |     |-- export_job (1:many)
  |
  |-- queue_item (1:1)
  |     |-- status, scheduledFor, postedAt
  |
  |-- chat_message (backref via generatedContentId)
```

This schema is correct. We are not changing it. We are fixing the backend logic that sits on top of it.

---

## 3. What's Actually Broken

### Problem 1: Two Parallel Assembly Pipelines

There are two separate code paths that both build a timeline and produce a video from the same source assets:

**Pipeline A** — `POST /api/video/assemble` in `backend/src/routes/video/index.ts`:
- Runs FFmpeg server-side concatenation
- Creates an `assembled_video` asset directly
- Has its own `_buildInitialTimeline` function (line 428) that produces a `TimelinePayload` schema
- Also upserts an `edit_project` and calls `_convertTimelineToEditorTracks` to bridge the schemas
- Returns a redirect URL to the editor

**Pipeline B** — `POST /api/editor/:id/export` in `backend/src/routes/editor/index.ts`:
- Reads `edit_project.tracks` JSONB
- Resolves asset URLs
- Runs a render job via `export_job` table
- Stores result in `assets` table

These are supposed to produce the same result. Instead they produce different schemas, different asset types, and different database state. The `_convertTimelineToEditorTracks` conversion function in the video route is the evidence — it exists because the two pipelines drifted apart.

**Root cause:** `buildInitialTimeline` is implemented twice:
- `backend/src/routes/video/index.ts` line 428 (`_buildInitialTimeline`) — produces `TimelinePayload`
- `backend/src/routes/editor/services/build-initial-timeline.ts` — produces editor track format

Only one should exist.

### Problem 2: Assembly Does Not Update the Editor's Timeline

When the user clicks "Assemble" in the AI workspace and is redirected to the editor, the editor loads whatever is in `edit_project.tracks`. If the user then goes back to the workspace, generates a new voiceover, and reassembles — the editor does not automatically get the new timeline. The user has to manually refresh or navigate again.

There is no mechanism for the assembly pipeline to write the new timeline back to `edit_project.tracks` in a way the editor will pick up reactively. The editor's React Query cache is never invalidated by server-side assembly events.

### Problem 3: Video Job State Is in localStorage

`ContentWorkspace.tsx` (lines 42–48) stores the active video generation job ID in `localStorage`. This means:
- Job state is lost if the user clears storage or opens a second tab
- The editor has no visibility into whether a video job is in progress
- The queue cannot show real-time job progress
- `use-video-job.ts` already exists as a server-polling hook but is not used as the canonical state source

### Problem 4: The Queue Cannot See Editor State

The queue's pipeline tracker shows stages up through "Assembly" and "Manual Edit." But it does not query `edit_project` for actual status (draft/published), does not show export job state, and does not update when the editor publishes or exports. The queue sees the world as of asset creation time and goes blind after that.

### Problem 5: Blank Editor Projects Exist Outside the Pipeline

When a user creates a blank editor project (no `generatedContentId`), the resulting export is not linked to any `generated_content` row. It never appears in the queue. It can't be scheduled. Manual-only creators are second-class citizens in their own content pipeline.

---

## 4. The Fix: Unified Backend & Data Layer

### Design Principles

1. **One canonical timeline builder.** `backend/src/routes/editor/services/build-initial-timeline.ts` is the single implementation. The video route uses it. No conversion functions.

2. **Assembly writes through the editor.** When the AI workspace triggers assembly, the backend upserts the `edit_project` with the new timeline, then notifies the frontend to invalidate its editor cache. The editor always shows the latest assembled state.

3. **Server-side job tracking everywhere.** Video generation job state lives in the database (`video_jobs` table, already exists). The frontend polls it via `use-video-job.ts`. No localStorage.

4. **Queue reads live state.** The queue's pipeline stage computation JOINs `edit_projects` and `export_jobs` so it reflects real state, not snapshot state.

5. **Every editor export produces a `generated_content` link.** Blank projects get a `generated_content` row on first export.

### Unified Data Flow

```
AI Workspace                          Manual Editor
     |                                      |
     | "Assemble"                           | "Export"
     v                                      v
POST /api/video/assemble              POST /api/editor/:id/export
     |                                      |
     | upserts edit_project.tracks          | reads edit_project.tracks
     | (via build-initial-timeline)         | renders to asset
     |                                      |
     +-----------> edit_project <-----------+
                       |
                       | queried by both surfaces
                       | invalidated on write
                       v
                  queue_item (live status)
```

Both surfaces read and write through the same `edit_project` row. The AI workspace writes to it (assembly → timeline upsert). The editor writes to it (user edits → auto-save, export → publish). The queue reads from it. React Query invalidation ensures all surfaces stay in sync.

---

## 5. Implementation Plan

### Phase 1: Single Timeline Builder (Backend, Complexity: S)

**What:** Delete `_buildInitialTimeline` from `backend/src/routes/video/index.ts` and replace the call with an import from `backend/src/routes/editor/services/build-initial-timeline.ts`. Delete `_convertTimelineToEditorTracks`.

**Why first:** Everything else depends on both assembly paths producing identical `edit_project.tracks` shape. This is the prerequisite.

**Changes:**
- `backend/src/routes/video/index.ts`: Delete `_buildInitialTimeline` (line 428). Delete `_convertTimelineToEditorTracks`. Import `buildInitialTimeline` from editor services. Adjust types to match.
- `backend/src/routes/editor/services/build-initial-timeline.ts`: Verify it handles all asset role types the video route was handling (add any missing role mappings).

**What does NOT change:** Frontend. No UX change. Schema unchanged.

**Files affected:**
- `backend/src/routes/video/index.ts`
- `backend/src/routes/editor/services/build-initial-timeline.ts`

---

### Phase 2: Assembly Writes to edit_project (Backend, Complexity: M)

**What:** Make `POST /api/video/assemble` the canonical "build a timeline from assets and save it to edit_project" endpoint. Remove the FFmpeg assembly from this path — its only job is to upsert `edit_project.tracks` using `buildInitialTimeline` and return the project ID. Video rendering happens only via the editor's export pipeline.

**Why:** The FFmpeg direct assembly produces a video that bypasses the editor entirely. Users should assemble in the AI workspace → go to editor → export from there. The assembly step should mean "build my timeline from AI-generated assets," not "produce a final video."

**Changes:**
- `backend/src/routes/video/index.ts` assemble handler:
  - Remove FFmpeg concatenation logic
  - Remove `assembled_video` asset creation from this path
  - Keep: upsert `edit_project`, call `buildInitialTimeline`, return `{ editorProjectId, redirectUrl }`
  - On re-assembly (project already exists): update `edit_project.tracks` with fresh timeline from current assets, set status back to `draft`
- `backend/src/routes/editor/index.ts`: No change — export is already the canonical render path.

**Files affected:**
- `backend/src/routes/video/index.ts`

---

### Phase 3: Editor Cache Invalidation on Assembly (Frontend, Complexity: S)

**What:** After assembly completes, invalidate the editor's React Query cache so the editor (if open in another tab, or when navigated to) picks up the new `edit_project.tracks` automatically.

**Why:** Without this, re-assembly in the workspace silently updates the database but the editor still shows the old timeline. This is the "data layer stays in sync" requirement.

**Changes:**
- `frontend/src/features/video/hooks/use-assemble-reel.ts`: In `onSuccess`, call `queryClient.invalidateQueries({ queryKey: queryKeys.api.editorProject(contentId) })` before navigating.
- `frontend/src/shared/lib/query-keys.ts`: Ensure `editorProject` key exists and matches what `EditorLayout` uses.
- If the user is already on the editor page: the invalidation triggers a refetch and the timeline refreshes in-place without a page reload.

**Files affected:**
- `frontend/src/features/video/hooks/use-assemble-reel.ts`
- `frontend/src/shared/lib/query-keys.ts`

---

### Phase 4: Replace localStorage Job Tracking (Frontend, Complexity: S)

**What:** Remove `localStorage` video job state from `ContentWorkspace.tsx`. Use `use-video-job.ts` as the single job state source everywhere.

**Why:** localStorage state is invisible to the editor and queue. Server-polled state is shared across all surfaces.

**Changes:**
- `frontend/src/features/chat/components/ContentWorkspace.tsx`: Delete `localStorage` reads/writes for job state (lines 42–48). Replace with `useVideoJob(generatedContentId)` hook.
- `frontend/src/features/video/hooks/use-video-job.ts`: Confirm it handles the "no active job" case gracefully (returns `null` status).
- `frontend/src/routes/studio/queue.tsx`: Add `useVideoJob(item.generatedContentId)` to the DetailPanel to show live generation progress inline.

**Files affected:**
- `frontend/src/features/chat/components/ContentWorkspace.tsx`
- `frontend/src/features/video/hooks/use-video-job.ts`
- `frontend/src/routes/studio/queue.tsx`

---

### Phase 5: Queue Reads Live editor_project + export_job State (Backend + Frontend, Complexity: M)

**What:** The queue's pipeline stage computation should JOIN `edit_projects` and `export_jobs` to show real-time editor state. When the editor exports and the export job completes, the queue reflects it automatically on its next poll.

**Why:** The queue is the user's pipeline dashboard. Without this, it goes dark after assembly.

**Changes:**
- `backend/src/routes/queue/` pipeline stage query: LEFT JOIN `edit_projects` on `generatedContentId`. LEFT JOIN `export_jobs` on `editProjectId` (latest). Include `editProjectStatus`, `latestExportStatus`, `latestExportUrl` in the response.
- `backend/src/routes/editor/index.ts` publish handler: On publish, update linked `queue_item.status` to `"ready"` if currently `"queued"` or `"processing"`.
- `frontend/src/routes/studio/queue.tsx` DetailPanel: Render "Edit: draft/published" and "Export: idle/rendering/complete" stages using the new fields.

**Files affected:**
- `backend/src/routes/queue/` (pipeline stage query)
- `backend/src/routes/editor/index.ts` (publish handler)
- `frontend/src/routes/studio/queue.tsx`

---

### Phase 6: Blank Editor Projects Auto-Create generated_content (Backend, Complexity: M)

**What:** On first export of a blank editor project (no `generatedContentId`), the backend creates a `generated_content` row (status: `draft`, prompt: null), links it to the edit project, and creates a `queue_item`. The editor project is no longer an orphan.

**Why:** Manual creators need their work in the pipeline. Without this, exported videos from blank projects can't be scheduled or tracked.

**Changes:**
- `backend/src/routes/editor/index.ts` export handler: Check if `project.generatedContentId` is null. If so, INSERT a `generated_content` row (allow nullable `prompt` — see schema note below), INSERT a `queue_item` for it, UPDATE `edit_project.generatedContentId`.
- `backend/src/infrastructure/database/drizzle/schema.ts`: Relax `prompt` column to nullable on `generated_content` to support editor-originated content.
- `bun db:generate && bun db:migrate` required.

**Files affected:**
- `backend/src/routes/editor/index.ts`
- `backend/src/infrastructure/database/drizzle/schema.ts`
- New migration file (auto-generated)

---

### Phase 7: Editor Gallery Shows Content Context (Backend + Frontend, Complexity: S)

**What:** The editor project list includes `generatedHook` from the linked `generated_content`. Cards show the hook text instead of a scissors emoji.

**Why:** Users need to identify their projects. This is a data layer problem — the backend just needs to JOIN the extra field.

**Changes:**
- `backend/src/routes/editor/index.ts` GET `/`: LEFT JOIN `generated_content` on `generatedContentId`. Include `generatedHook`, `generatedCaption` in list response.
- `frontend/src/routes/studio/editor.tsx` project cards: Use `project.generatedHook` as title. Fallback to `"Untitled Project"` for blank projects.

**Files affected:**
- `backend/src/routes/editor/index.ts`
- `frontend/src/routes/studio/editor.tsx`

---

## 6. What Stays Separate (Intentionally)

### The Two Editing UIs

The AI workspace (`ContentWorkspace` side panel) and the manual editor (`EditorLayout`) remain separate pages with separate components. We are not merging them. They serve different purposes:

- **Workspace** = quick assembly. The AI builds the timeline from generated assets. Fast, opinionated.
- **Editor** = manual control. The user adjusts every clip, transition, and overlay. Precise, flexible.

Navigation from workspace → editor continues to work via URL redirect. We may add a `returnTo` param later to improve back-navigation, but that is a UX enhancement, not part of this plan.

### The `generated_content` Schema

Well-designed. Version chain via `parentId` is clean. Only change: relax `prompt` to nullable (Phase 6).

### The `assets` + `content_assets` Split

Correct pattern. No changes.

### The `edit_projects` Schema

JSONB tracks, 1:1 constraint, draft/publish model — all correct. No schema changes.

### The Editor's `useEditorReducer`

Reducer pattern with undo/redo, auto-save debounce, and local-first editing is solid. Not touched.

### The Chat Streaming Architecture

SSE streaming, optimistic messages, tool-call-based draft saving — working correctly. Not touched.

### The Queue's Polling Model

6-second auto-refresh for in-progress items is the right approach. No WebSockets needed.

---

## 7. Priority Summary

| # | Change | Complexity | Impact |
|---|--------|-----------|--------|
| 1 | Single timeline builder | S | Prerequisite for everything else — kills schema drift |
| 2 | Assembly writes to edit_project only | M | One assembly pipeline; editor is the canonical render path |
| 3 | Editor cache invalidation on assembly | S | AI workspace changes automatically appear in the editor |
| 4 | Replace localStorage job tracking | S | Job state visible everywhere; no fragile client-side storage |
| 5 | Queue reads live editor + export state | M | Queue becomes a real dashboard instead of a half-blind observer |
| 6 | Blank projects auto-create generated_content | M | Manual creators enter the pipeline; nothing is orphaned |
| 7 | Editor gallery shows content context | S | Projects become identifiable |

Phases 1–4 are backend-heavy and can ship together as a single PR. They share no UI surface area and are non-breaking. Phases 5–7 follow in a second pass once the data layer is clean.
