# HLD & LLD: Unified Backend & Data Layer
## Document 06 — Editor Studio Architecture Series

**Date:** 2026-03-21
**Status:** Design
**Plan source:** `docs/plans/unified-content-editor-plan.md`
**Covers phases:** 1 – 7

---

## Part 1: High-Level Design (HLD)

### 1.1 System Context

The system has two editing surfaces and one pipeline dashboard that currently operate as independent silos despite sharing the same database entities.

```
┌──────────────────────────┐       ┌──────────────────────────┐
│  AI Workspace            │       │  Manual Editor           │
│  /studio/generate        │       │  /studio/editor          │
│                          │       │                          │
│  ContentWorkspace.tsx    │       │  EditorLayout.tsx        │
│  VideoWorkspacePanel.tsx │       │  useEditorStore.ts       │
│  use-assemble-reel.ts    │       │  useEditorReducer        │
└──────────┬───────────────┘       └──────────┬───────────────┘
           │ POST /api/video/assemble          │ PATCH /api/editor/:id
           │ (upserts edit_project.tracks)     │ (auto-save timeline)
           │                                   │
           │           ┌───────────────────────┤
           │           │                       │ POST /api/editor/:id/export
           └──────────►│   edit_project        │ (render → export_job)
                       │   (JSONB tracks)      │
                       │   (1:1 per user+content)◄──────────────────────────┐
                       └──────────┬────────────┘                            │
                                  │                          ┌───────────────┴──────────┐
                                  │ LEFT JOIN                │  Queue                   │
                                  └─────────────────────────►│  /studio/queue           │
                                                             │  /api/queue/             │
                                                             │  (pipeline dashboard)    │
                                                             └──────────────────────────┘
```

**After this fix, the invariant is:** every editor surface always reads from `edit_project.tracks`; both the AI assembly flow and the manual editor creation flow perform a find-or-create on `edit_project` keyed by `(userId, generatedContentId)` so they always share the same instance; the assembly endpoint only writes to `edit_project.tracks`; the queue reads from `edit_projects` and `export_jobs` via JOINs. No surface maintains independent state.

### 1.2 Current State of the Two Broken Pipelines

Two distinct code paths currently produce a video from the same source assets:

**Pipeline A** (`POST /api/video/assemble`, video route):
- Defines `_buildInitialTimeline` locally at line 428, producing a `TimelinePayload` with `{ schemaVersion, fps, durationMs, tracks: { video[], audio[], text[], captions[] } }`.
- Calls `_convertTimelineToEditorTracks` (line 1829) to bridge from `TimelinePayload` into the editor's track array format before writing to `edit_project.tracks`.
- The bridge function exists precisely because the two schemas drifted apart.

**Pipeline B** (`buildInitialTimeline` in editor services):
- Defined in `backend/src/routes/editor/services/build-initial-timeline.ts`, returning `{ tracks: TimelineTrack[], durationMs }` directly in the editor's native format.
- Already used by `POST /api/editor` (create project) when `generatedContentId` is supplied.
- The authoritative implementation.

The existence of `_convertTimelineToEditorTracks` is the evidence of drift. It will be deleted.

### 1.3 Unified Data Flow (After Fix)

```
AI Workspace "Assemble"
        │
        ▼
POST /api/video/assemble
        │
        │  import buildInitialTimeline from editor/services/
        │  → produces editor-native TimelineTrack[]
        │  → upserts edit_project.tracks + durationMs
        │  → resets edit_project.status = "draft"
        │
        ▼
    edit_project
  (single source of truth)
        │
        ├──────────────────────────────────────────────────────────────────────┐
        │  React Query invalidation                                            │
        │  queryKeys.api.editorProject(contentId)                             │
        │  queryKeys.api.editorByContent(contentId)                           │
        ▼                                                                      │
  Editor loads fresh tracks                                          Queue reads via JOIN
  (no manual refresh needed)                                   (editProjectStatus, latestExportStatus)
```

### 1.4 Key Design Decisions by Phase

**Phase 1 — Single timeline builder:**
The editor service's `buildInitialTimeline` is chosen as the canonical implementation because: (a) it is already used by `POST /api/editor`, (b) it produces the editor's native track format directly with no conversion step, (c) it handles all four asset roles (`video_clip`, `final_video`, `voiceover`, `background_music`, `image`) cleanly. The video route's `_buildInitialTimeline` is a subset of this functionality with an incompatible output schema.

**Phase 2 — Assembly endpoint responsibility (create-only):**
`POST /api/video/assemble` changes its contract from "build and render a video" to "initialise the editor for this generated content if it does not yet exist, and redirect." FFmpeg rendering is removed from this path. **The editor is the source of truth.** Assembly initialises `edit_project.tracks` only on first creation. If a project already exists for this `(userId, generatedContentId)`, the endpoint returns the existing project ID and redirect URL without touching `tracks` — the user's manual edits are preserved. A deliberate "reset to AI layout" requires an explicit separate action (Phase 8 versioning: fork the current project before resetting) so the user never loses work silently.

**Phase 3 — Reactive cache invalidation:**
The assembly mutation's `onSuccess` callback is the correct injection point because it runs after the server confirms the `edit_project` write. Invalidating before navigate means the editor page will refetch in the background while navigation happens; the data will be fresh when the page mounts. Two keys must be invalidated: `editorProject(contentId)` (used by editor GET by ID) and `editorByContent(contentId)` (used by editor by-content lookup).

**Phase 4 — Server-side job state:**
`use-video-job.ts` already polls `GET /api/video/jobs/:jobId` and stops when `status === "completed" | "failed"`. The only missing piece is that `ContentWorkspace.tsx` initialises job ID from `localStorage` instead of deriving it from a server query. The fix seeds from `useVideoJob(generatedContentId)` where the content ID is known from the active draft context, eliminating the localStorage coupling entirely.

**Phase 5 — Queue joins live editor state:**
The queue's `deriveStages` function (line 27 in `queue/index.ts`) currently derives stage status from `generatedMetadata.phase4` and `content_asset` role counts. It has no visibility into `edit_projects` or `export_jobs`. Adding LEFT JOINs to the queue's main GET query gives the `deriveStages` function two new facts: `editProjectStatus` (`draft | published | null`) and `latestExportStatus` (`queued | rendering | done | failed | null`). This enables two new pipeline stages: "Manual Edit" and "Export."

**Phase 6 — Auto-create generated_content for blank projects:**
The `generated_content.prompt` column is currently `NOT NULL` (schema line 211). This must be relaxed to nullable to allow editor-originated rows where no AI prompt exists. The export handler is the correct trigger point: it fires once per export attempt, and a first export is the moment a blank project first produces something worth tracking. Creating the `generated_content` row and `queue_item` here — rather than on project creation — avoids orphan pipeline entries for projects that are started but never exported.

**Phase 7 — Gallery context:**
The editor gallery (`GET /api/editor`) currently returns `edit_project` columns only. A LEFT JOIN on `generated_content` adds `generatedHook` and `generatedCaption` in a single query with no extra round trips.

**Phase 8 — Versioning (fork/snapshot):**
`edit_project.parentProjectId` already exists in the schema but has no write path. The versioning model is: the **root project** (`parentProjectId IS NULL`) is the live working copy for a given `(userId, generatedContentId)`. Any "save snapshot" or "reset to AI layout" action creates a new row with `parentProjectId = rootProjectId`, preserving the previous state before overwriting the root. The unique index `edit_project_unique_content` must be tightened to `WHERE parentProjectId IS NULL AND generatedContentId IS NOT NULL` so forked snapshots do not violate the constraint. The queue, export, and gallery always operate on the root project.

**Phase 9 — Cross-content asset import:**
An editor for content A must be able to borrow clips, voiceovers, or music from content B's `content_asset` rows. Assets are identified by UUID and are already globally unique — no schema change is needed to reference them in a track. The missing piece is a discovery API: `GET /api/editor/assets?contentId=X` returns all published `content_asset` rows for any content owned by the same user. The frontend asset panel surfaces this as a searchable library. Imported clips are added to the editor's timeline as regular track clips pointing to the foreign asset ID; the editor's existing render path works unchanged.

**Phase 10 — Open editor project in AI Chat:**
A manually created editor project should be launchable into the AI Workspace (`/studio/generate`) so the user can generate additional content (new hooks, scripts, clips) for that project. For projects with an existing `generatedContentId`, navigation is direct. For blank projects, `POST /api/editor/:id/link-content` auto-creates a `generated_content` row and a `queue_item`, then returns the new ID for navigation. This is the inverse of the AI flow: instead of AI→Editor, this is Editor→AI.

---

### 1.5 Shared Editor Instance Lifecycle

Every `generated_content` row has **at most one live `edit_project`** (the root project, `parentProjectId IS NULL`). This invariant is enforced by the partial unique index on `(userId, generatedContentId) WHERE parentProjectId IS NULL AND generatedContentId IS NOT NULL`.

**How both flows respect this:**

```
AI Assembly Flow                       Manual Editor Flow
(POST /api/video/assemble)             (POST /api/editor with generatedContentId)
         │                                          │
         ▼                                          ▼
  SELECT edit_project                    SELECT edit_project
  WHERE userId = ?                       WHERE userId = ?
    AND generatedContentId = ?             AND generatedContentId = ?
    AND parentProjectId IS NULL            AND parentProjectId IS NULL
         │                                          │
    ┌────┴────────────────────────────────────┐     │
    │  Exists?                                │     │
    ├─ YES → return id + redirectUrl          │     │
    │         (do NOT touch tracks)           │     │
    │         editor is source of truth       │     │
    └─ NO  → buildInitialTimeline             └─ NO → buildInitialTimeline
             INSERT edit_project                      INSERT edit_project
             (userId, generatedContentId,             (userId, generatedContentId,
              tracks, durationMs, "draft")             tracks, durationMs, "draft")
```

Both flows share the same lookup key. Whichever flow creates the project first "wins"; the other will find the existing row on every subsequent call. This guarantees no duplicate editors and no silent overwrite of manual changes.

**Versioning (fork model):**

| Row | `parentProjectId` | Role |
|-----|-------------------|------|
| Root | `NULL` | Live working copy; target of all queue/export queries |
| Snapshot | `= rootProjectId` | Preserved prior state; read-only once forked |

A snapshot is created before any destructive operation (e.g., "Reset to AI layout"):
1. `INSERT INTO edit_project SELECT *, NOW() WHERE id = rootId` with `parentProjectId = rootId`
2. Overwrite root row's `tracks` with fresh `buildInitialTimeline` output

The user sees a "Version history" list of snapshots; the timeline always shows the root.

---

### 1.6 Cross-Content Asset Import & AI Chat Launch

**Cross-content asset import:** An editor can pull clips, audio, or images from any `content_asset` owned by the same user, regardless of which `generated_content` produced them.

```
Editor (content A)                    Asset Library Panel
        │                                      │
        │  GET /api/editor/assets              │
        │  ?contentId=B (or omit for all)      │
        │ ◄────────────────────────────────────┤
        │                                      │
        │  Returns: content_assets for B       │
        │  (filtered by userId, role, status)  │
        │                                      │
        │  User drags clip → track             │
        │                                      │
        │  Track clip stored as:               │
        │  { assetId: uuid-from-B, ... }       │
        │                                      │
  edit_project.tracks (content A)              │
  references asset from content B ────────────►│
  (no schema change — assetId is global UUID)  │
```

**Invariant:** track clips reference `content_asset.id` (UUID). The editor's render/export pipeline already resolves `assetId → r2_url` without caring which content produced the asset. No foreign-key schema change is needed.

**Open in AI Chat (Phase 10):** The editor also exposes a reverse path back into the AI Workspace.

```
Editor Gallery / Editor Header
        │
        │  "Open in AI Chat" button
        │
        ├─ project.generatedContentId exists?
        │       │
        │  YES  └──► navigate /studio/generate?contentId=X
        │
        └─ NO (blank project)
               │
               ▼
        POST /api/editor/:id/link-content
               │  creates generated_content (prompt=null)
               │  creates queue_item (status=draft)
               │  links edit_project.generatedContentId
               │
               ▼
        navigate /studio/generate?contentId=newId
        (AI workspace opens blank session for this content)
```

This closes the loop: every editor project, regardless of origin, can become the subject of an AI generation session.

---

## Part 2: Low-Level Design (LLD)

### Phase 1: Delete Duplicate `_buildInitialTimeline` and Unify on Editor Services

**Goal:** One implementation of timeline-from-assets, zero conversion functions.

#### Files to change

**`backend/src/routes/video/index.ts`**

1. Add import at the top of the file (after existing imports from `./utils`):
   ```typescript
   import { buildInitialTimeline } from "../editor/services/build-initial-timeline";
   ```

2. Delete the entire `_buildInitialTimeline` function (lines 428–496). This is a standalone `async function` declaration; delete from the `async function _buildInitialTimeline` line through its closing `}`.

3. Delete the entire `_convertTimelineToEditorTracks` function (lines 1829–1903). This is a standalone `function` declaration immediately before the `POST /api/video/assemble` handler.

4. In the assemble handler (currently around line 1964–1970), replace:
   ```typescript
   const timeline = await _buildInitialTimeline({
     userId: auth.user.id,
     generatedContentId: payload.generatedContentId,
   });
   const tracks = _convertTimelineToEditorTracks(timeline, payload.audioMix);
   ```
   with:
   ```typescript
   const { tracks, durationMs } = await buildInitialTimeline(
     payload.generatedContentId,
   );
   ```
   Note: `durationMs` is now returned directly from `buildInitialTimeline`. Update the `db.insert(editProjects).values({...})` call to use this `durationMs` rather than `timeline.durationMs`.

5. Remove `TimelinePayload` type alias (`type TimelinePayload = z.infer<typeof _timelineSchema>`) if it is only used by the deleted functions. Check for other usages before removing — if `_timelineSchema` or `TimelinePayload` is used by `_validateTimeline` or other live code, leave those.

6. The `audioMix` parameter from `payload.audioMix` previously fed into `_convertTimelineToEditorTracks` to set per-track volumes. After this change, volume defaults come from `buildInitialTimeline`. The `audioMix` input field on the `assembleSchema` should be retained for future use but may be ignored for now; or you can apply `audioMix` volumes as a post-processing step over the returned tracks. See "Edge cases" below.

**`backend/src/routes/editor/services/build-initial-timeline.ts`**

Verify the function handles `role === "assembled_video"` assets. Currently it filters for `role === "video_clip" || role === "final_video"` (line 54–55). Add `"assembled_video"` to the video clip filter to ensure any pre-assembled video assets that exist in `content_asset` are placed in the video track:

```typescript
const videoClipAssets = linkedAssets.filter(
  (a) =>
    a.role === "video_clip" ||
    a.role === "final_video" ||
    a.role === "assembled_video",
);
```

#### API contract changes
None. The response from `POST /api/video/assemble` remains `{ editorProjectId: string, redirectUrl: string }`.

#### Edge cases
- **`audioMix` volumes:** `_convertTimelineToEditorTracks` applied `audioMix.clipAudioVolume`, `audioMix.voiceoverVolume`, and `audioMix.musicVolume` per clip. `buildInitialTimeline` uses hardcoded defaults (`volume: 1` for video/voiceover, `volume: 0.3` for music). If the caller supplies `audioMix`, apply it as a post-processing pass over the returned tracks array before writing to `edit_project`. This keeps `buildInitialTimeline` free of assembly-specific concerns.
- **Empty asset set:** If `generatedContentId` has no assets yet, `buildInitialTimeline` returns `{ tracks: [...empty track skeletons...], durationMs: 0 }`. The assemble endpoint should check `durationMs === 0` and return 422 with `{ error: "No assets ready to assemble" }`.

---

### Phase 2: Assembly Endpoint — Create-Only (Editor Is Source of Truth)

**Goal:** `POST /api/video/assemble` initialises the editor on first use and redirects on subsequent calls without overwriting existing tracks. The editor is the canonical state for a content's timeline.

#### Files to change

**`backend/src/routes/video/index.ts`** — assemble handler (approximately lines 1936–1998)

The current handler has two branches:
1. `if (existing)` — returns existing project without update
2. Otherwise — inserts new project

The existing branch is already correct in spirit (return without update) but should be made explicit:

```typescript
if (existing) {
  // Editor is the source of truth — do NOT overwrite manual edits.
  // Redirect to the existing project.
  return c.json({
    editorProjectId: existing.id,
    redirectUrl: `/studio/editor?contentId=${payload.generatedContentId}`,
  });
}

// First assembly for this content: initialise the editor from current assets.
const { tracks, durationMs } = await buildInitialTimeline(
  payload.generatedContentId,
);
const finalTracks = applyAudioMix(tracks, payload.audioMix);

const [created] = await db
  .insert(editProjects)
  .values({
    userId: auth.user.id,
    generatedContentId: payload.generatedContentId,
    tracks: finalTracks,
    durationMs,
    status: "draft",
  })
  .returning({ id: editProjects.id });

return c.json({
  editorProjectId: created.id,
  redirectUrl: `/studio/editor?contentId=${payload.generatedContentId}`,
});
```

Extract `applyAudioMix` as a module-level helper (used only on first creation):

```typescript
function applyAudioMix(
  tracks: Array<{ type: string; clips: Array<{ volume: number }> }>,
  audioMix?: { clipAudioVolume?: number; voiceoverVolume?: number; musicVolume?: number },
) {
  if (!audioMix) return tracks;
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => ({
      ...clip,
      volume:
        track.type === "video"
          ? (audioMix.clipAudioVolume ?? clip.volume)
          : track.type === "audio"
            ? (audioMix.voiceoverVolume ?? clip.volume)
            : track.type === "music"
              ? (audioMix.musicVolume ?? clip.volume)
              : clip.volume,
    })),
  }));
}
```

**"Reset to AI layout" path (separate endpoint, Phase 8):**
If the user explicitly wants to reset the editor to a fresh AI-generated timeline, this is handled by the versioning fork API (`POST /api/editor/:id/fork` then PATCH root tracks). It is deliberately NOT triggered by re-calling `POST /api/video/assemble`.

#### API contract changes
The response shape `{ editorProjectId: string, redirectUrl: string }` is unchanged. The behavioural guarantee is now: this endpoint is safe to call multiple times — it is a pure create-if-not-exists with no destructive side effects on an existing editor.

#### Edge cases
- **Race condition (two concurrent first assembles):** The partial unique index `edit_project_unique_content` on `(userId, generatedContentId) WHERE parentProjectId IS NULL AND generatedContentId IS NOT NULL` (updated in Phase 8) prevents duplicate INSERT. The second concurrent request will get a unique-constraint error; handle with an upsert or retry-fetch pattern.
- **FFmpeg legacy path:** The `?legacy=true` query param path (lines 1917–1933) remains intact during the migration window. It should be removed after the migration period.

---

### Phase 3: React Query Cache Invalidation After Assembly

**Goal:** After `POST /api/video/assemble` succeeds, the editor's cache is invalidated so the next mount (or an already-open editor tab) sees the fresh `edit_project.tracks`.

#### Files to change

**`frontend/src/features/video/hooks/use-assemble-reel.ts`**

The current `onSuccess` callback only calls `navigate`. Add `queryClient.invalidateQueries` before navigating:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";

export function useAssembleReel() {
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ generatedContentId, includeCaptions = true, audioMix }: AssembleReelArgs) =>
      authenticatedFetchJson<{ editorProjectId: string; redirectUrl: string }>(
        "/api/video/assemble",
        {
          method: "POST",
          body: JSON.stringify({ generatedContentId, includeCaptions, audioMix }),
        },
      ),
    onSuccess: (_data, variables) => {
      // Invalidate editor caches so the editor loads the fresh timeline
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.editorByContent(variables.generatedContentId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.editorProjects(),
      });
      void navigate({
        to: "/studio/editor",
        search: { contentId: variables.generatedContentId },
      });
    },
  });
}
```

The `editorProject` key by project UUID is not invalidated here because the UUID is not available at the `onSuccess` call site (the response returns `editorProjectId` which could be used — but `editorByContent` is the key the editor uses to look up by `contentId` param, so that is the correct target).

**`frontend/src/shared/lib/query-keys.ts`**

The `editorByContent` key already exists at line 109:
```typescript
editorByContent: (contentId?: number) =>
  ["api", "editor", "by-content", contentId] as const,
```
No change needed. Verify that the editor route's `useQuery` for loading a project by `contentId` uses this exact key. If the editor's GET by content ID uses a different key, align them — one canonical key per resource.

#### Frontend query key patterns
- `queryKeys.api.editorByContent(contentId)` — used by the editor's lookup by content ID; invalidated on assembly.
- `queryKeys.api.editorProjects()` — invalidated to refresh the gallery list in case the project's `updatedAt` changed.
- `queryKeys.api.editorProject(projectId)` — NOT invalidated here (UUID not available at this call site); the editor will refetch naturally due to `editorByContent` invalidation causing a re-render that triggers `editorProject` with fresh data.

#### Edge cases
- **Editor open in the same tab, user clicks Assemble:** `invalidateQueries` marks the cache stale; if the editor query is active, it will immediately background-refetch. The editor's `useEditorReducer` should handle a fresh `tracks` payload arriving mid-session gracefully — if it does not, a page-level stale-time check should be added to prevent clobbering unsaved edits.
- **Editor open in a different tab:** The invalidation applies to the shared `QueryClient` instance. If the editor is in a different browser tab, it has a separate React context and will not be affected — the editor will see fresh data on its next load.

---

### Phase 4: Replace localStorage Job Tracking

**Goal:** Remove `localStorage` reads/writes for video job state from `ContentWorkspace.tsx`. Use `use-video-job.ts` as the single source of truth.

#### Files to change

**`frontend/src/features/chat/components/ContentWorkspace.tsx`**

Lines 40–74 contain the localStorage pattern. The storage key is `video_job_${sessionId}` (job ID) and `video_job_${sessionId}_contentId` (content ID).

Replace this block:
```typescript
const storageKey = `video_job_${sessionId}`;
const contentIdKey = `video_job_${sessionId}_contentId`;
const [videoJobId, setVideoJobId] = useState<string | null>(() =>
  localStorage.getItem(storageKey)
);
const [videoJobContentId, setVideoJobContentId] = useState<number | null>(
  () => {
    const stored = localStorage.getItem(contentIdKey);
    return stored ? Number(stored) : null;
  }
);
const { data: videoJobData } = useVideoJob(videoJobId);
```
with:
```typescript
const [videoJobId, setVideoJobId] = useState<string | null>(null);
const [videoJobContentId, setVideoJobContentId] = useState<number | null>(null);
const { data: videoJobData } = useVideoJob(videoJobId);
```

Replace `startVideoJob`:
```typescript
const startVideoJob = (jobId: string, contentId: number) => {
  setVideoJobId(jobId);
  setVideoJobContentId(contentId);
  toastIdRef.current = toast.loading(t("workspace_video_generating"), {
    description: t("workspace_video_generating_toast_description"),
    duration: Infinity,
  });
};
```

Replace `clearVideoJob`:
```typescript
const clearVideoJob = () => {
  setVideoJobId(null);
  setVideoJobContentId(null);
};
```

All `localStorage.setItem` and `localStorage.removeItem` calls in these functions are deleted. Do a grep for `storageKey` and `contentIdKey` variables to catch any other usages in the file before deleting the variable declarations.

**`frontend/src/features/video/hooks/use-video-job.ts`**

The hook currently requires a `jobId: string | null` parameter. Verify it handles `null` gracefully — it does: `enabled: !!jobId` prevents the query from running. No functional change needed, but add a JSDoc note clarifying this is the canonical job state source:

```typescript
/**
 * Polls the server for the status of a video generation job.
 * This is the canonical source of truth for job state — do not use localStorage.
 * Returns null data (query disabled) when jobId is null.
 */
```

**`frontend/src/routes/studio/queue.tsx`**

In the queue's detail panel, import and use `useVideoJob` to show live generation progress inline for queue items that have an in-progress `video_clip` stage. The item's `generatedContentId` is available on each queue item row; however, `useVideoJob` requires a job ID, not a content ID.

Two options:
1. Extend the queue API response to include the active `video_job_id` for each item (backend change to `GET /api/queue`).
2. Use the existing `generatedMetadata.phase4.jobId` field that the video route already writes when a clip generation job starts.

Option 2 requires no backend change. In the detail panel:
```typescript
const activeJobId =
  (item.generatedMetadata as any)?.phase4?.jobId ?? null;
const { data: videoJobData } = useVideoJob(activeJobId);
```

If `videoJobData` is present and status is `"running"` or `"pending"`, render a progress indicator in the Video Clips stage of the pipeline UI.

#### Edge cases
- **Page reload loses job tracking:** After this change, if the user reloads the page, `videoJobId` resets to `null`. The job continues running on the server. The user will not see the progress toast. This is an acceptable trade-off — the job will still complete, and the video clips panel will show the new assets when the user next opens it. A future enhancement could query the server for the latest job by `generatedContentId` on mount.
- **Multiple jobs in flight:** If a user triggers two clip generation jobs rapidly, `videoJobId` holds the last-started one. The previous job's completion is silently ignored. This is the same behaviour as the localStorage version.
- **Migration for existing users:** Users with a stored `localStorage` entry will lose visibility into in-progress jobs on first load after this change. This is an acceptable one-time degradation given the jobs run for minutes at most.

---

### Phase 5: Queue JOINs `edit_projects` + `export_jobs` for Live Pipeline State

**Goal:** The queue's main GET query includes editor project status and latest export job status, enabling two new pipeline stages.

#### Files to change

**`backend/src/routes/queue/index.ts`**

1. Add imports at the top:
   ```typescript
   import {
     queueItems,
     generatedContent,
     contentAssets,
     editProjects,
     exportJobs,
   } from "../../infrastructure/database/drizzle/schema";
   ```

2. In the main `GET /` handler (around line 216), extend the `db.select({...})` to include:
   ```typescript
   editProjectId: editProjects.id,
   editProjectStatus: editProjects.status,
   editProjectUpdatedAt: editProjects.updatedAt,
   latestExportJobId: sql<string | null>`(
     SELECT id FROM export_job
     WHERE edit_project_id = ${editProjects.id}
     ORDER BY created_at DESC
     LIMIT 1
   )`,
   latestExportStatus: sql<string | null>`(
     SELECT status FROM export_job
     WHERE edit_project_id = ${editProjects.id}
     ORDER BY created_at DESC
     LIMIT 1
   )`,
   latestExportUrl: sql<string | null>`(
     SELECT a.r2_url FROM export_job ej
     JOIN asset a ON a.id = ej.output_asset_id
     WHERE ej.edit_project_id = ${editProjects.id}
       AND ej.status = 'done'
     ORDER BY ej.created_at DESC
     LIMIT 1
   )`,
   ```

3. Add the LEFT JOIN on `edit_projects` to both the data query and the count query:
   ```typescript
   .leftJoin(
     editProjects,
     and(
       eq(editProjects.generatedContentId, queueItems.generatedContentId),
       eq(editProjects.userId, queueItems.userId),
     ),
   )
   ```

4. Update the `deriveStages` function signature to accept the two new fields:
   ```typescript
   function deriveStages(
     row: {
       generatedHook: string | null;
       generatedScript: string | null;
       generatedMetadata: unknown;
       status: string;
       editProjectStatus?: string | null;
       latestExportStatus?: string | null;
     },
     assetRoleCounts: Record<string, number>,
   ): PipelineStage[]
   ```
   Add two new stages after `"assembled"`:
   ```typescript
   {
     id: "edit",
     label: "Manual Edit",
     status: row.editProjectStatus === "published"
       ? "ok"
       : row.editProjectStatus === "draft"
         ? "running"
         : hasAssembled
           ? "pending"
           : "pending",
   },
   {
     id: "export",
     label: "Export",
     status: row.latestExportStatus === "done"
       ? "ok"
       : row.latestExportStatus === "rendering"
         ? "running"
         : row.latestExportStatus === "failed"
           ? "failed"
           : "pending",
   },
   ```

5. Update the response mapping (around line 331) to include the new fields in the returned items:
   ```typescript
   editProjectId: row.editProjectId,
   editProjectStatus: row.editProjectStatus,
   latestExportStatus: row.latestExportStatus,
   latestExportUrl: row.latestExportUrl,
   ```

**`backend/src/routes/editor/index.ts`** — publish handler (lines 424–482)

After successfully updating `edit_project.status` to `"published"`, update the linked `queue_item` to `"ready"` if it is currently `"draft"` or `"scheduled"`:

```typescript
// After the db.update(editProjects)... returning() call:
if (updated.generatedContentId) {
  await db
    .update(queueItems)
    .set({ status: "ready" })
    .where(
      and(
        eq(queueItems.generatedContentId, updated.generatedContentId),
        eq(queueItems.userId, auth.user.id),
        inArray(queueItems.status, ["draft", "scheduled"]),
      ),
    );
}
```
Add `queueItems` and `inArray` to the import from schema. The `updated` object must include `generatedContentId` — change the `.returning()` call to also return `generatedContentId`:
```typescript
.returning({
  id: editProjects.id,
  status: editProjects.status,
  publishedAt: editProjects.publishedAt,
  generatedContentId: editProjects.generatedContentId,
})
```

**`frontend/src/routes/studio/queue.tsx`**

In the `DetailPanel` (or equivalent per-item stage renderer), render the two new pipeline stages. The stage list already uses the `stages` array from the API response — the new `"edit"` and `"export"` entries will render automatically if the stage renderer is data-driven. If the stage list is hardcoded in JSX, add:
- "Manual Edit" stage: show status badge using `editProjectStatus` — `"draft"` → amber dot, `"published"` → green check, `null` → grey dot.
- "Export" stage: show status badge using `latestExportStatus` — `"rendering"` → spinner, `"done"` → green check, `"failed"` → red X, `null` → grey dot.

#### API contract changes
`GET /api/queue` response items gain four new optional fields:
```typescript
editProjectId: string | null
editProjectStatus: "draft" | "published" | null
latestExportStatus: "queued" | "rendering" | "done" | "failed" | null
latestExportUrl: string | null
```
These are additive; existing clients ignore unknown fields.

The `stages` array in each item gains two new stage entries: `{ id: "edit", ... }` and `{ id: "export", ... }`. Frontend code that iterates `stages` array is unaffected; code that looks up stages by index may need updating.

#### Edge cases
- **Blank editor projects (no `generatedContentId`):** The LEFT JOIN on `editProjects.generatedContentId = queueItems.generatedContentId` will not match blank projects. After Phase 6 is complete, blank projects gain a `generatedContentId`, so this gap resolves itself.
- **Multiple edit projects per content (future versioning):** The schema allows multiple `edit_projects` per `generatedContentId` if `generatedContentId IS NULL` partial unique index is satisfied. The JOIN uses `eq(editProjects.userId, queueItems.userId)` which may match multiple rows if versioning creates new projects. Add `AND edit_projects.parent_project_id IS NULL` to the JOIN condition to select only the root project, or select the latest by `updatedAt`.
- **Performance:** The correlated subqueries for `latestExportStatus` and `latestExportUrl` run per queue item. For the default page size of 20 items this is acceptable. Add an index on `export_job.edit_project_id, created_at DESC` — this index already exists as `export_jobs_project_idx` on `editProjectId` alone; it is sufficient for the ORDER BY + LIMIT 1 pattern.

---

### Phase 6: Blank Editor Exports Auto-Create `generated_content` Row

**Goal:** On first export of a project with no `generatedContentId`, create a `generated_content` row and a `queue_item`, then link them to the project.

#### Schema changes

**`backend/src/infrastructure/database/drizzle/schema.ts`**

Change `prompt` on `generatedContent` from `notNull()` to nullable:

```typescript
// Line 211: change
prompt: text("prompt").notNull(),
// to:
prompt: text("prompt"),
```

After this change, run:
```bash
cd backend && bun db:generate && bun db:migrate
```

The migration will be an `ALTER TABLE generated_content ALTER COLUMN prompt DROP NOT NULL`. This is a safe, zero-downtime migration — existing rows are unaffected, and Postgres allows adding `NULL` capability without rewriting rows.

Update the `NewGeneratedContent` type consumers: anywhere that constructs a `NewGeneratedContent` object, `prompt` becomes optional. Search for `prompt:` in the codebase and verify no code assumes it is always present after reading from the database.

#### Files to change

**`backend/src/routes/editor/index.ts`** — export handler (lines 539–619)

After `const [project]` is fetched and verified (line 556–566), add the auto-create block before the concurrency check:

```typescript
// Auto-create generated_content for blank projects on first export
if (!project.generatedContentId) {
  const [newContent] = await db
    .insert(generatedContent)
    .values({
      userId: auth.user.id,
      prompt: null,          // editor-originated, no AI prompt
      status: "draft",
      version: 1,
      outputType: "full",
    })
    .returning({ id: generatedContent.id });

  // Create queue_item for pipeline visibility
  await db.insert(queueItems).values({
    userId: auth.user.id,
    generatedContentId: newContent.id,
    status: "draft",
  });

  // Link the edit_project to the new generated_content row
  await db
    .update(editProjects)
    .set({ generatedContentId: newContent.id })
    .where(eq(editProjects.id, id));

  // Update local variable for downstream use in this handler
  project.generatedContentId = newContent.id;
}
```

Add `queueItems` to the import from schema at the top of `editor/index.ts`.

The block is guarded by `!project.generatedContentId` — on subsequent exports the block is skipped.

#### Edge cases
- **Concurrent first exports:** Two concurrent first-export requests on the same blank project will both pass the `!project.generatedContentId` check (read before write). Both will INSERT a `generated_content` row. The second UPDATE on `edit_project.generatedContentId` will overwrite the first. This leaves an orphan `generated_content` row. Mitigation: wrap the auto-create block in a serializable transaction or use `UPDATE edit_project SET generated_content_id = ... WHERE id = ? AND generated_content_id IS NULL RETURNING generated_content_id` to make the assignment atomic, then skip INSERT if the row was updated by another process.
- **Title population:** The auto-created `generated_content` row has no `generatedHook`. The queue will show "Untitled" for this item until the user adds copy. This is acceptable for Phase 7, which adds `generatedHook` to the gallery.
- **`prompt` nullable migration:** Any code path that calls `generated_content.prompt` and does not handle `null` will need a null guard. Grep for `.prompt` on `GeneratedContent` type across the backend.

---

### Phase 7: Editor Gallery JOIN Includes `generatedHook`

**Goal:** `GET /api/editor` returns `generatedHook` and `generatedCaption` from the linked `generated_content` row. The frontend uses this as the project card title.

#### Files to change

**`backend/src/routes/editor/index.ts`** — GET `/` handler (lines 150–169)

Replace:
```typescript
const projects = await db
  .select()
  .from(editProjects)
  .where(eq(editProjects.userId, auth.user.id))
  .orderBy(desc(editProjects.updatedAt));
```
with:
```typescript
const projects = await db
  .select({
    id: editProjects.id,
    userId: editProjects.userId,
    title: editProjects.title,
    generatedContentId: editProjects.generatedContentId,
    tracks: editProjects.tracks,
    durationMs: editProjects.durationMs,
    fps: editProjects.fps,
    resolution: editProjects.resolution,
    status: editProjects.status,
    publishedAt: editProjects.publishedAt,
    parentProjectId: editProjects.parentProjectId,
    createdAt: editProjects.createdAt,
    updatedAt: editProjects.updatedAt,
    // From linked generated_content (null for blank projects)
    generatedHook: generatedContent.generatedHook,
    generatedCaption: generatedContent.generatedCaption,
  })
  .from(editProjects)
  .leftJoin(
    generatedContent,
    eq(editProjects.generatedContentId, generatedContent.id),
  )
  .where(eq(editProjects.userId, auth.user.id))
  .orderBy(desc(editProjects.updatedAt));
```

Add `generatedContent` to the imports from schema at the top of `editor/index.ts` (it is already imported — verify).

The `tracks` field (full JSONB) is expensive to transmit for a list view. Consider omitting it from the list response and returning only metadata columns. If the frontend needs `tracks` for the list, keep it; if only the detail view needs it, remove it from the SELECT and let the editor load it via `GET /api/editor/:id`. This is a performance optimisation opportunity, not a requirement of Phase 7.

**`frontend/src/routes/studio/editor.tsx`** — project gallery cards

In the project card renderer, use `project.generatedHook` as the card title with a fallback:
```typescript
const cardTitle = project.generatedHook
  ?? project.title
  ?? "Untitled Project";
```

Remove any hardcoded scissors emoji or placeholder if present.

#### API contract changes
`GET /api/editor` response items gain two new optional fields:
```typescript
generatedHook: string | null
generatedCaption: string | null
```
These are additive. No breaking change.

#### Edge cases
- **Blank projects (Phase 6 created):** After Phase 6, blank projects gain a `generated_content` row with no `generatedHook`. The fallback `"Untitled Project"` is correct for these.
- **Gallery performance with `tracks` JSONB:** Each `tracks` JSONB blob can be 10–100 KB for complex timelines. Returning 20 projects with full `tracks` in a list response is 200 KB – 2 MB. Strip `tracks` from the list SELECT and add it only to the `GET /:id` detail response if bandwidth is a concern.
- **`generatedContent` import conflict:** `generatedContent` is the Drizzle table reference. In `editor/index.ts`, confirm the import is `import { ..., generatedContent } from "../../infrastructure/database/drizzle/schema"`. It is already imported on line 15 — no addition needed.

---

### Phase 8: Editor Versioning (Fork / Snapshot)

**Goal:** Users can snapshot the current editor state before destructive operations (e.g., "Reset to AI layout"). The root project is always the live working copy; snapshots are read-only historical versions.

#### Schema changes

**`backend/src/infrastructure/database/drizzle/schema.ts`**

Update the partial unique index on `edit_projects` to exclude snapshots:

```sql
-- Current index (to drop):
-- UNIQUE (userId, generatedContentId) WHERE generatedContentId IS NOT NULL

-- New index (to add via Drizzle migration):
-- UNIQUE (userId, generatedContentId) WHERE parentProjectId IS NULL AND generatedContentId IS NOT NULL
```

In Drizzle schema, if the index is defined via `uniqueIndex`, change:
```typescript
.uniqueIndex("edit_project_unique_content")
  .on(editProjects.userId, editProjects.generatedContentId)
  .where(sql`generated_content_id IS NOT NULL`)
```
to:
```typescript
.uniqueIndex("edit_project_unique_content_root")
  .on(editProjects.userId, editProjects.generatedContentId)
  .where(sql`parent_project_id IS NULL AND generated_content_id IS NOT NULL`)
```

Run `bun db:generate && bun db:migrate` after schema change.

#### Files to change

**`backend/src/routes/editor/index.ts`** — new `POST /:id/fork` endpoint

```typescript
// POST /api/editor/:id/fork
// Creates a snapshot of the current root project state.
// Returns the snapshot's ID. Optionally accepts a { resetToAI: true } body
// which, after forking, rebuilds the root's tracks from buildInitialTimeline.
editorRouter.post("/:id/fork", requireAuth, async (c) => {
  const { id } = c.req.param();
  const auth = c.get("auth");
  const body = await c.req.json<{ resetToAI?: boolean }>().catch(() => ({}));

  const [root] = await db
    .select()
    .from(editProjects)
    .where(and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)));

  if (!root) return c.json({ error: "Not found" }, 404);
  if (root.parentProjectId) return c.json({ error: "Cannot fork a snapshot" }, 400);

  // Create snapshot preserving current state
  const [snapshot] = await db
    .insert(editProjects)
    .values({
      userId: root.userId,
      generatedContentId: root.generatedContentId,
      tracks: root.tracks,
      durationMs: root.durationMs,
      fps: root.fps,
      resolution: root.resolution,
      status: root.status,
      title: root.title,
      parentProjectId: root.id,  // marks this as a snapshot
    })
    .returning({ id: editProjects.id });

  // If resetToAI: rebuild root from current assets
  if (body.resetToAI && root.generatedContentId) {
    const { tracks, durationMs } = await buildInitialTimeline(root.generatedContentId);
    await db
      .update(editProjects)
      .set({ tracks, durationMs, status: "draft" })
      .where(eq(editProjects.id, root.id));
  }

  return c.json({ snapshotId: snapshot.id });
});
```

**`backend/src/routes/editor/index.ts`** — `GET /:id/versions` endpoint

```typescript
// GET /api/editor/:id/versions
// Returns all snapshots (parentProjectId = id) ordered by createdAt DESC.
editorRouter.get("/:id/versions", requireAuth, async (c) => {
  const { id } = c.req.param();
  const auth = c.get("auth");

  const versions = await db
    .select({
      id: editProjects.id,
      createdAt: editProjects.createdAt,
      status: editProjects.status,
    })
    .from(editProjects)
    .where(
      and(
        eq(editProjects.parentProjectId, id),
        eq(editProjects.userId, auth.user.id),
      ),
    )
    .orderBy(desc(editProjects.createdAt));

  return c.json({ versions });
});
```

**`frontend/src/features/editor/`** — version history panel

A "Version history" button in the editor toolbar opens a sidebar listing snapshots from `GET /api/editor/:id/versions`. Each snapshot entry shows its `createdAt` timestamp. A "Restore" action calls `POST /api/editor/:snapshotId/fork` targeting the snapshot... but actually restoration means: fork the root (preserving current state) then copy snapshot tracks onto root. A simpler UX: "Reset to this version" calls a new `PUT /api/editor/:id/restore-from/:snapshotId` which copies snapshot `tracks` onto the root project.

#### API contract additions
```
POST /api/editor/:id/fork             → { snapshotId: string }
GET  /api/editor/:id/versions         → { versions: { id, createdAt, status }[] }
PUT  /api/editor/:id/restore-from/:snapshotId → { ok: true }
```

#### Edge cases
- **Fork of blank project (no generatedContentId):** Allowed. The snapshot row just has `generatedContentId: null` and `parentProjectId: rootId`. The unique-constraint change does not affect blank projects (constraint is `WHERE generatedContentId IS NOT NULL`).
- **Version accumulation:** No automatic pruning. A future job can delete snapshots older than N days. This is out of scope for this phase.

---

### Phase 9: Cross-Content Asset Import

**Goal:** The editor asset panel can browse and import assets (`content_asset` rows) from any generated content the user owns, not just the current one.

#### Files to change

**`backend/src/routes/editor/index.ts`** — new `GET /assets` endpoint

```typescript
// GET /api/editor/assets?contentId=X&role=video_clip&role=final_video
// Returns content_assets for a given generatedContentId (or all if omitted),
// filtered to the requesting user's content only.
editorRouter.get("/assets", requireAuth, async (c) => {
  const auth = c.get("auth");
  const contentIdParam = c.req.query("contentId");
  const roles = c.req.queries("role") ?? [];  // optional role filter

  // Sub-select: only content owned by this user
  const userContentIds = db
    .select({ id: generatedContent.id })
    .from(generatedContent)
    .where(eq(generatedContent.userId, auth.user.id));

  const conditions = [inArray(contentAssets.generatedContentId, userContentIds)];

  if (contentIdParam) {
    conditions.push(eq(contentAssets.generatedContentId, Number(contentIdParam)));
  }
  if (roles.length > 0) {
    conditions.push(inArray(contentAssets.role, roles));
  }

  const assets = await db
    .select({
      id: contentAssets.id,
      generatedContentId: contentAssets.generatedContentId,
      role: contentAssets.role,
      r2Url: contentAssets.r2Url,
      durationMs: contentAssets.durationMs,
      // Include the source content's hook for display
      sourceHook: generatedContent.generatedHook,
    })
    .from(contentAssets)
    .innerJoin(generatedContent, eq(contentAssets.generatedContentId, generatedContent.id))
    .where(and(...conditions))
    .orderBy(desc(contentAssets.createdAt));

  return c.json({ assets });
});
```

**Frontend: editor asset panel**

The asset panel (e.g., a sidebar in the editor) calls `GET /api/editor/assets` with optional `contentId` filter. The user can:
1. Browse "All my content" (no `contentId` filter) — shows assets from all their generated content
2. Filter by a specific content — shows assets from one source
3. Drag an asset onto a track — adds a clip with `{ assetId: uuid, r2Url, durationMs }` to the track

No special handling is needed in the track schema. Track clips already store `assetId` (UUID) and `r2Url`. The fact that the asset came from a different content is transparent to the editor's render pipeline.

**`frontend/src/shared/lib/query-keys.ts`** — add key

```typescript
editorAssets: (contentId?: number) =>
  ["api", "editor", "assets", contentId] as const,
```

#### API contract additions
```
GET /api/editor/assets?contentId=X&role=video_clip  → { assets: Asset[] }
```
`Asset` shape:
```typescript
{
  id: string;
  generatedContentId: number;
  role: string;
  r2Url: string;
  durationMs: number | null;
  sourceHook: string | null;  // display label for the source content
}
```

#### Edge cases
- **Large asset libraries:** A user with many generated content items could have hundreds of assets. Add `LIMIT 100` and pagination (`offset` param) to the query. The asset panel should implement virtual scrolling.
- **Access control:** The `innerJoin(generatedContent, ...) WHERE generatedContent.userId = ?` ensures users can only see their own assets. No cross-user leakage.
- **Deleted source content:** If `generated_content` is deleted but `content_asset` rows remain, the `innerJoin` will exclude them from results. This is the correct behaviour.

---

### Phase 10: Open Editor Project in AI Chat

**Goal:** A manually created editor project (or any editor project) can launch a new AI chat session in the AI Workspace (`/studio/generate`) pre-loaded with the project's linked `generated_content`. If no `generated_content` exists yet (blank project), one is auto-created first.

#### Design

The "Open in AI Chat" button appears on every editor project card in the gallery and within the editor header bar. Clicking it:

1. If `project.generatedContentId` exists: navigates to `/studio/generate?contentId=X` (the AI workspace opens that content's chat session).
2. If `project.generatedContentId` is null (blank project): calls `POST /api/editor/:id/link-content` which auto-creates a `generated_content` row and links it, then returns the new `contentId`. The frontend then navigates to `/studio/generate?contentId=newId`.

#### Files to change

**`backend/src/routes/editor/index.ts`** — new `POST /:id/link-content`

```typescript
// POST /api/editor/:id/link-content
// Auto-creates a generated_content row for a blank project and links it.
// Idempotent: if already linked, returns existing generatedContentId.
editorRouter.post("/:id/link-content", requireAuth, async (c) => {
  const { id } = c.req.param();
  const auth = c.get("auth");

  const [project] = await db
    .select({ id: editProjects.id, generatedContentId: editProjects.generatedContentId })
    .from(editProjects)
    .where(and(eq(editProjects.id, id), eq(editProjects.userId, auth.user.id)));

  if (!project) return c.json({ error: "Not found" }, 404);

  // Already linked — idempotent return
  if (project.generatedContentId) {
    return c.json({ generatedContentId: project.generatedContentId });
  }

  // Create a new generated_content row for this editor-originated project
  const [newContent] = await db
    .insert(generatedContent)
    .values({
      userId: auth.user.id,
      prompt: null,
      status: "draft",
      version: 1,
      outputType: "full",
    })
    .returning({ id: generatedContent.id });

  // Link to the edit_project
  await db
    .update(editProjects)
    .set({ generatedContentId: newContent.id })
    .where(eq(editProjects.id, id));

  // Create queue_item so it appears in the pipeline
  await db.insert(queueItems).values({
    userId: auth.user.id,
    generatedContentId: newContent.id,
    status: "draft",
  });

  return c.json({ generatedContentId: newContent.id });
});
```

**`frontend/src/routes/studio/editor.tsx`** — "Open in AI Chat" button

```typescript
const openInAIChat = useCallback(async (project: EditorProject) => {
  if (project.generatedContentId) {
    navigate({ to: "/studio/generate", search: { contentId: project.generatedContentId } });
    return;
  }
  // Blank project: auto-link first
  const { generatedContentId } = await authenticatedFetchJson<{ generatedContentId: number }>(
    `/api/editor/${project.id}/link-content`,
    { method: "POST" },
  );
  void queryClient.invalidateQueries({ queryKey: queryKeys.api.editorProjects() });
  navigate({ to: "/studio/generate", search: { contentId: generatedContentId } });
}, [navigate, authenticatedFetchJson, queryClient]);
```

The button renders in the editor gallery card footer and in the editor header:
```typescript
<Button variant="ghost" size="sm" onClick={() => openInAIChat(project)}>
  {t("editor.open_in_ai_chat")}
</Button>
```

Add translation key `editor.open_in_ai_chat` to `frontend/src/translations/en.json`.

#### API contract additions
```
POST /api/editor/:id/link-content  → { generatedContentId: number }
```

#### Edge cases
- **Concurrent link-content calls:** Two concurrent calls on the same blank project will both INSERT a `generated_content` row. Mitigation: use a database transaction with `SELECT ... FOR UPDATE` on the `edit_project` row to serialize; or use `INSERT INTO edit_project SET generated_content_id = ... WHERE id = ? AND generated_content_id IS NULL RETURNING generated_content_id`.
- **AI workspace receiving a blank `generated_content`:** The chat loads with `prompt: null` and `generatedHook: null`. The workspace must handle this gracefully — display "New project" as the title and allow the user to start a chat from scratch for this content.
- **`/studio/generate?contentId=X` routing:** Verify the AI workspace route reads `contentId` from search params and loads the correct draft session. If it does not currently support this, a small change to `ContentWorkspace.tsx` is needed to initialise with the provided `contentId`.

---

## Part 3: Implementation Order and Dependencies

| Phase | Depends on | Can ship independently |
|-------|-----------|----------------------|
| 1 | — | Yes (backend only, no UX change) |
| 2 | Phase 1 (uses `buildInitialTimeline`) | Yes, after Phase 1 |
| 3 | Phase 2 (invalidation useful now assemble creates fresh project) | Yes, after Phase 2 |
| 4 | — | Yes (frontend only, no backend dependency) |
| 5 | Phase 2 (queue edit stage meaningful after edit_project is created) | Yes (gracefully degrades if Phase 2 not done) |
| 6 | Phase 5 (blank projects need the queue pipeline to be live to be useful) | Yes (schema migration is independent) |
| 7 | Phase 6 (blank projects benefit from hook display after they have one) | Yes (purely additive) |
| 8 | Phase 2 (unique-index change must align with Phase 2 create-only contract) | Yes, after Phase 2 |
| 9 | Phase 1 (asset query shares `content_asset` table already used by buildInitialTimeline) | Yes (purely additive API) |
| 10 | Phase 6 (shares auto-create generated_content logic) | Yes (can reuse Phase 6 logic) |

**PR groupings:**
- **PR 1** (Phases 1–4): Unified timeline builder, create-only assembly, cache invalidation, localStorage removal. No user-facing UX changes.
- **PR 2** (Phases 5–7): Queue pipeline stages, blank project export, gallery hooks.
- **PR 3** (Phases 8–10): Versioning, cross-content asset import, Open in AI Chat.

---

## Part 4: Testing Checklist

### Phase 1
- [ ] `POST /api/video/assemble` with a content ID that has clips + voiceover produces an `edit_project.tracks` array with correct track types (`video`, `audio`, `music`, `text`)
- [ ] `buildInitialTimeline` handles content with no assets (returns empty tracks, `durationMs: 0`)
- [ ] No TypeScript errors from removal of `_buildInitialTimeline` and `_convertTimelineToEditorTracks`

### Phase 2
- [ ] First call to `POST /api/video/assemble` creates an `edit_project` row with correct `tracks` and `durationMs`
- [ ] Second call to `POST /api/video/assemble` with same `generatedContentId` returns the existing `editorProjectId` and does NOT modify `tracks`
- [ ] Existing editor tracks are preserved after a second assembly call (verify via DB read)
- [ ] `audioMix` volumes are applied on first creation only

### Phase 3
- [ ] After `useAssembleReel` mutation succeeds, `queryKeys.api.editorByContent(contentId)` cache is stale (verify via React Query devtools)
- [ ] Editor page navigated to after assembly shows fresh tracks without manual refresh

### Phase 4
- [ ] `localStorage` contains no `video_job_*` keys after starting a job
- [ ] Reloading `ContentWorkspace` with a previously stored `video_job_*` key in localStorage has no effect (job tracking starts fresh)
- [ ] `useVideoJob(null)` returns `{ data: undefined }` and makes no network request

### Phase 5
- [ ] `GET /api/queue` response items include `editProjectStatus`, `latestExportStatus`, `latestExportUrl`
- [ ] Queue shows "Manual Edit: draft" for a content with an `edit_project` in draft status
- [ ] Queue shows "Export: done" and `latestExportUrl` after a completed export job
- [ ] Publishing an `edit_project` sets linked `queue_item.status` to `"ready"`

### Phase 6
- [ ] First export of a blank project creates a `generated_content` row with `prompt = null`
- [ ] `edit_project.generatedContentId` is updated after auto-create
- [ ] A `queue_item` row exists for the new `generated_content` after first export
- [ ] Second export of the same project does NOT create another `generated_content` row
- [ ] `bun db:migrate` runs without errors on `prompt` nullable migration

### Phase 7
- [ ] `GET /api/editor` response includes `generatedHook` and `generatedCaption`
- [ ] Blank projects return `generatedHook: null` and fall back to `"Untitled Project"` in the gallery
- [ ] Projects with a hook display the hook text as the card title

### Phase 8
- [ ] `POST /api/editor/:id/fork` creates a snapshot row with `parentProjectId = id`
- [ ] Snapshot row's `tracks` match the root's `tracks` at time of fork
- [ ] `POST /api/editor/:id/fork` with `{ resetToAI: true }` rebuilds root `tracks` from `buildInitialTimeline` after forking
- [ ] `GET /api/editor/:id/versions` returns all snapshots for a root project
- [ ] Forked snapshots do not violate the unique-content index (index now scoped to `WHERE parentProjectId IS NULL`)
- [ ] Forking a snapshot (non-root) returns 400

### Phase 9
- [ ] `GET /api/editor/assets` returns assets from all content owned by the requesting user
- [ ] `GET /api/editor/assets?contentId=X` returns only assets for content X
- [ ] Response does not include assets from other users' content
- [ ] `GET /api/editor/assets?role=video_clip` filters by role
- [ ] An asset from content B can be added to an editor for content A (track clip references foreign assetId)
- [ ] Export resolves `assetId` to `r2Url` regardless of which content produced it

### Phase 10
- [ ] "Open in AI Chat" on a project with `generatedContentId` navigates to `/studio/generate?contentId=X`
- [ ] "Open in AI Chat" on a blank project calls `POST /api/editor/:id/link-content` and creates a `generated_content` row
- [ ] `edit_project.generatedContentId` is updated after link-content call
- [ ] Second click on "Open in AI Chat" for the same blank project returns the already-linked `generatedContentId` (idempotent)
- [ ] AI workspace at `/studio/generate?contentId=X` loads correctly with a blank `generated_content` (no prompt, no hook)
