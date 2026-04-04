# SyncService - Firing Map

> **Planning only - this file will be deleted.** Replicate this map (triggers, ordering, DB effects) in `sync.service.ts` and related wiring comments so the repo stays complete without it.

Complete reference of every trigger point, what executes, what DB fields change, and how conflicts are resolved.

---

## Phase 1: Current Trigger Points

### Text content tools → SyncService

These tools set the saved content ID, which triggers `onContentSaved` → `syncLinkedProjects`.

| Tool | Content mutation | Session draft effect | Fires sync? | New content row? |
|---|---|---|---|---|
| `save_content` | INSERT new `generated_content` | Attach to session, advance `activeContentId` | Yes | Yes |
| `iterate_content` | INSERT new `generated_content` with `parentId` | Attach to session, advance `activeContentId` | Yes | Yes |
| `edit_content_field` | UPDATE existing `generated_content` | Keep same active draft | Yes | No |

### Video tools → `refreshEditorTimeline` (NOT SyncService)

These tools never set a saved content ID. They mutate `content_assets` only and go through the async video job path.

| Tool | What it mutates | Session draft effect | Editor update mechanism | New content row? |
|---|---|---|---|---|
| `generate_video_reel` | INSERT `content_asset` rows per shot | None | `refreshEditorTimeline` per shot (async job) | No |
| `regenerate_video_shot` | REPLACE one `content_asset` row | None | `refreshEditorTimeline` once (async job) | No |

### Project creation (uses `deriveTimeline` directly, not sync)

| Event | Mechanism | Fires syncLinkedProjects? |
|---|---|---|
| `POST /api/editor` with `generatedContentId` | `EditorService.createEditorProject` → `SyncService.deriveTimeline` | No |

---

## What `syncLinkedProjects` writes

### Fields always written

| Field on `edit_projects` | Source | Notes |
|---|---|---|
| `generatedContentId` | `contentId` arg | Advances pointer to latest in chain |
| `generatedHook` | `generated_content.generatedHook` | Denormalized for editor UI |
| `postCaption` | `generated_content.postCaption` | Denormalized for editor UI |
| `tracks` | `mergeTrackSets(freshTracks, existingTracks)` | Full track set, merged |
| `durationMs` | Computed from merged tracks | |

### Fields never written by sync

| Field | Who owns it |
|---|---|
| Session draft membership (`chat_session_content`) | Chat tool save path |
| Session active draft (`chat_sessions.activeContentId`) | Chat tool save path |
| Editor conflict version | Editor autosave |
| `title` | User via autosave |
| `status` | `publishProjectForUser` |
| `fps`, `resolution` | User via autosave |
| `thumbnailUrl` | `uploadThumbnailForProject` |
| `userHasEdited` | Autosave |

---

## Track-level merge rules (Phase 1)

Applied by `mergeTrackSets(freshTracks, existingTracks)`:

| Clip situation | What happens |
|---|---|
| Fresh content clip, same `assetId` as existing | Replaced with fresh clip; user trims/position/scale/rotation carried forward |
| Fresh content clip, new `assetId` | Inserted as-is from `deriveTimeline` — no adjustments preserved |
| Existing content clip, `assetId` not in fresh | Dropped — asset is no longer part of this content |
| Existing user clip (`source:"user"`) | Always carried forward untouched, appended after content clips |

### Video track special case: empty fresh video

When `iterate_content` fires and the new version has no video assets yet, `deriveTimeline` returns an empty video track.

**Rule:** If fresh video clips = 0, preserve the existing video clips unchanged. Only non-empty tracks replace their existing counterparts.

This prevents the video track from going blank when the user rewrites the script but hasn't regenerated video yet. The stale video is better than no video.

---

## Phase 2: Future Tool Triggers (not yet built)

These tools don't exist yet but are the planned growth path. Listed here so the data model and callback structure are designed with them in mind from the start.

| Planned tool | What it would do | Sync mechanism |
|---|---|---|
| `assemble_video_cut` | AI selects shots, sets timing, aligns cuts to voiceover | `onContentSaved` → `syncLinkedProjects` with an AI assembly plan override (or a new callback) |
| `trim_clip` | AI trims a specific clip to a target duration | `onEditorAction` → direct clip mutation via `applyClipOperations` |
| `reorder_shots` | AI reorders video clips to match revised script pacing | `onEditorAction` → direct track mutation |
| `set_caption_preset` | AI picks a caption style preset for the current content | `onEditorAction` → caption track update |
| `create_text_overlay` | AI creates a lower third or title card | `onEditorAction` → text track insert |
| `apply_music_fade` | AI sets music volume envelope | `onEditorAction` → music clip property update |

### Why this needs a new callback

`onContentSaved` is scoped to content-level changes — it works when the operation creates or mutates a `generated_content` row. Direct clip edits don't create a content version; they're timeline mutations. They need a different channel: `onEditorAction(projectId, operations[])`.

The `ToolContext` interface in `chat-tools.ts` is where this callback will be added. See the TODO in `low-level-design.md`.

---

## Conflict resolution

### SyncService vs autosave

| Scenario | Winner | Why |
|---|---|---|
| Sync writes, then autosave fires with old local state | Autosave wins | Editor is source of truth. Sync updates land in the next re-fetch. |
| Autosave fires, then sync writes | Sync wins on the fields it writes | Sync runs before SSE, so in normal flow this is the common case. |
| Both fire simultaneously | Last write wins at DB level | No transaction lock between them. Acceptable: both flows are directional and repeatable. |

**Practical outcome:** sync writes → SSE fires → client waits for draft visibility → editor re-fetches and merges before the next autosave in normal usage.

### SyncService vs `refreshEditorTimeline`

These never conflict in responsibility:
- Sync fires on text content tool calls
- `refreshEditorTimeline` fires inside async video jobs

They can target the same project over time, but they update different phases of the lifecycle. They remain safe as long as text sync never attempts per-shot placeholder work.

### Tab-vs-tab conflict (unrelated to sync)

Two tabs autosaving the same project will 409 on the second save. Sync does not affect this because sync never bumps the editor's conflict version.

---

## Frontend follow-up after SSE

After text content tools complete and SSE reveals a `contentId`:

| Step | Why |
|---|---|
| `ensureSessionDraftVisible(queryClient, sessionId, contentId, ...)` | Wait until the new session-owned draft is query-visible, not just one invalidation |
| `POST /api/editor` | Create a linked editor project if one does not exist yet |
| `invalidateEditorProjectsQueries` | Project may have been created or synced |
| `invalidateChatProjectsQueries` | Project/session sidebars may need refreshed project metadata |
| `invalidateChatSessionQuery` (stream completion path) | Refresh persisted session state such as `activeContentId` |

After video generation completes per shot, `useEditorProjectPoll` detects `updatedAt` changes and merges via `MERGE_TRACKS_FROM_SERVER`. No session-draft visibility step needed — video generation does not create a new draft.

---

## What does NOT trigger sync (Phase 1)

- `generate_video_reel` — async job, no new content row, uses `refreshEditorTimeline`
- `regenerate_video_shot` — async job, no new content row, uses `refreshEditorTimeline`
- `get_content` — read-only
- `get_reel_analysis` — read-only
- `update_content_status` — status change only, no track-relevant data changes
- `get_video_job_status` — read-only
- Editor autosave — editor-to-backend only, never triggers sync
- `refreshEditorTimeline` — video-job path, entirely separate system
