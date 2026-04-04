# SyncService — Firing Map

> **Planning only — this file will be deleted.** Replicate this map (triggers, ordering, DB effects) in `sync.service.ts` and related wiring comments so the repo stays complete without it.

Complete reference of every trigger point, what executes, what DB fields change, and how conflicts are resolved.

---

## Trigger Points

### Text content tools → SyncService

These tools set `context.savedContentId`, which triggers `onContentSaved` → `syncLinkedProjects`.

| Tool | Content mutation | Fires sync? | New content row? |
|---|---|---|---|
| `save_content` | INSERT new `generated_content` | Yes | Yes |
| `iterate_content` | INSERT new `generated_content` with `parentId` | Yes | Yes |
| `edit_content_field` | UPDATE existing `generated_content` | Yes | No |

### Video tools → refreshEditorTimeline (NOT SyncService)

These tools never set `context.savedContentId`. They mutate `content_assets` only.

| Tool | What it mutates | Editor update mechanism | New content row? |
|---|---|---|---|
| `generate_video_reel` | INSERT `content_asset` rows per shot | `refreshEditorTimeline` per shot (async job) | No |
| `regenerate_video_shot` | REPLACE one `content_asset` row | `refreshEditorTimeline` once (async job) | No |

### Project creation (not sync, but uses deriveTimeline)

| Event | Mechanism | Fires sync? |
|---|---|---|
| First content save → `POST /api/editor` | `EditorService.createEditorProject` → `SyncService.deriveTimeline` | No (project being created, not synced) |

---

## What `syncLinkedProjects` writes

### Fields always written

| Field on `edit_projects` | Source | Condition |
|---|---|---|
| `generatedContentId` | `contentId` arg | Always — advances pointer to latest in chain |
| `generatedHook` | `generated_content.generatedHook` | Always |
| `postCaption` | `generated_content.postCaption` | Always |
| `tracks` | `mergeTrackSets(freshTracks, existingTracks)` | Always |
| `durationMs` | Computed from merged tracks | Always |

### Fields never written by sync

| Field | Who owns it |
|---|---|
| `version` | Nobody currently — `edit_projects` has no version column |
| `title` | User via autosave |
| `status` | `publishProjectForUser` |
| `fps`, `resolution` | User via autosave |
| `thumbnailUrl` | `uploadThumbnailForProject` |
| `userHasEdited` | Autosave |

---

## Track-level merge rules

Applied by `mergeTrackSets(freshTracks, existingTracks)`:

| Clip type | What happens |
|---|---|
| Fresh content clip, same `assetId` as existing | Replaced with fresh clip BUT user adjustments (trims, position, scale, rotation) carried forward |
| Fresh content clip, new `assetId` | Inserted as-is from `deriveTimeline` — no adjustments preserved (new asset, different duration) |
| Existing content clip, `assetId` not in fresh content | Dropped — asset no longer part of this content |
| Existing user clip (`source:"user"`) | Always carried forward untouched, appended after content clips |

### Video track special case: empty fresh video

When `iterate_content` fires and the new content version has no video assets yet, `deriveTimeline` returns an empty video track. Rule: if fresh video clips = 0, preserve existing video clips unchanged. Only audio, music, and text tracks are replaced.

This prevents video clips from disappearing when the user rewrites the script without regenerating video.

---

## Conflict resolution

### SyncService vs autosave

| Scenario | Winner | Why |
|---|---|---|
| Sync writes, then autosave fires with old local state | Autosave wins (its payload overwrites sync's track changes) | Editor is source of truth. Sync's updates land in next re-fetch cycle. |
| Autosave fires, then sync writes | Sync wins on the fields it writes (tracks, hooks, contentId) | Sync fires before SSE event; autosave fires after user edits. Race is narrow in practice. |
| Both fire simultaneously | Last write wins at DB level | No transaction lock between them. Acceptable — both operations are idempotent in direction. |

**Practical outcome:** Cache invalidation → re-fetch → `MERGE_TRACKS_FROM_SERVER` fires after sync writes and before the next autosave debounce. In normal usage the editor picks up sync changes before autosave runs.

### SyncService vs refreshEditorTimeline

These never conflict — they are triggered by completely different events and cannot be triggered simultaneously for the same content:
- Sync fires on text content tool calls (synchronous, before SSE)
- `refreshEditorTimeline` fires inside async video jobs

### Tab-vs-tab conflict (unrelated to sync)

Two tabs autosaving the same project will 409 on the second save. This is the existing version-check system. Sync does not affect it — sync never bumps version.

---

## Frontend cache invalidation

After text content tools complete and SSE fires, the frontend must invalidate:

| Cache key | Why |
|---|---|
| `editorProjectsQueries` | Editor project was updated by sync |
| `chatProjectsQueries` | Project list sidebar |
| `sessionDrafts(sessionId)` | Draft list in chat session |

After video generation completes per-shot, `useEditorProjectPoll` detects `updatedAt` change and merges via `MERGE_TRACKS_FROM_SERVER`. No explicit cache invalidation needed — poll handles it.

---

## What does NOT trigger sync

- `generate_video_reel` — async job, no content row created
- `regenerate_video_shot` — async job, no content row created, no `savedContentId`
- `get_content` — read-only
- `get_reel_analysis` — read-only
- `update_content_status` — status change only, no track-relevant data changes
- `get_video_job_status` — read-only
- Editor autosave — editor-to-backend only, never triggers sync
- `refreshEditorTimeline` — video-job path, separate system
