# SyncService - Firing Map

> **Planning only - this file will be deleted.** Replicate this map (triggers, ordering, DB effects) in `sync.service.ts` and related wiring comments so the repo stays complete without it.

Complete reference of every trigger point, what executes, what DB fields change, and how conflicts are resolved.

---

## Trigger Points

### Text content tools -> SyncService

These tools set `context.savedContentId`, which triggers `onContentSaved` -> `syncLinkedProjects`.

| Tool | Content mutation | Session draft effect | Fires sync? | New content row? |
|---|---|---|---|---|
| `save_content` | INSERT new `generated_content` | Attach new content to session, advance `activeContentId` | Yes | Yes |
| `iterate_content` | INSERT new `generated_content` with `parentId` | Attach new content to session, advance `activeContentId` | Yes | Yes |
| `edit_content_field` | UPDATE existing `generated_content` | Keep same session-owned draft active | Yes | No |

### Video tools -> `refreshEditorTimeline` (NOT SyncService)

These tools never set `context.savedContentId`. They mutate `content_assets` only.

| Tool | What it mutates | Session draft effect | Editor update mechanism | New content row? |
|---|---|---|---|---|
| `generate_video_reel` | INSERT `content_asset` rows per shot | No session draft change | `refreshEditorTimeline` per shot (async job) | No |
| `regenerate_video_shot` | REPLACE one `content_asset` row | No session draft change | `refreshEditorTimeline` once (async job) | No |

### Project creation (not sync, but uses `deriveTimeline`)

| Event | Mechanism | Fires sync? |
|---|---|---|
| First content save -> streamed `contentId` becomes visible in session drafts -> `POST /api/editor` | `EditorService.createEditorProject` -> `SyncService.deriveTimeline` | No |

---

## What `syncLinkedProjects` writes

### Fields always written

| Field on `edit_projects` | Source | Condition |
|---|---|---|
| `generatedContentId` | `contentId` arg | Always - advances pointer to latest in chain |
| `generatedHook` | `generated_content.generatedHook` | Always |
| `postCaption` | `generated_content.postCaption` | Always |
| `tracks` | `mergeTrackSets(freshTracks, existingTracks)` | Always |
| `durationMs` | Computed from merged tracks | Always |

### Fields never written by sync

| Field | Who owns it |
|---|---|
| Session draft membership | Chat tool save path (`chat_session_content`) |
| Session active draft | Chat tool save path (`chat_sessions.activeContentId`) |
| Editor conflict/version state | Editor autosave |
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
| Fresh content clip, same `assetId` as existing | Replaced with fresh clip, but user adjustments (trims, position, scale, rotation) carry forward |
| Fresh content clip, new `assetId` | Inserted as-is from `deriveTimeline` - no adjustments preserved |
| Existing content clip, `assetId` not in fresh content | Dropped - asset no longer part of this content |
| Existing user clip (`source:"user"`) | Always carried forward untouched, appended after content clips |

### Video track special case: empty fresh video

When `iterate_content` fires and the new content version has no video assets yet, `deriveTimeline` returns an empty video track. Rule: if fresh video clips = 0, preserve existing video clips unchanged. Only audio, music, and text tracks are replaced.

This prevents video clips from disappearing when the user rewrites the script without regenerating video.

---

## Conflict resolution

### SyncService vs autosave

| Scenario | Winner | Why |
|---|---|---|
| Sync writes, then autosave fires with old local state | Autosave wins | Editor is source of truth. Sync updates land in the next re-fetch cycle. |
| Autosave fires, then sync writes | Sync wins on the fields it writes | Sync runs before the streamed result reaches the client. |
| Both fire simultaneously | Last write wins at DB level | No transaction lock between them. Acceptable because both flows are directional and repeatable. |

**Practical outcome:** sync writes -> SSE reveals the saved `contentId` -> the chat client waits until that draft is visible in the session draft query -> editor queries re-fetch / merge before the next autosave in normal usage.

### SyncService vs `refreshEditorTimeline`

These never conflict in responsibility:
- Sync fires on text content tool calls
- `refreshEditorTimeline` fires inside async video jobs

They can still both target the same project over time, but they update different phases of the content lifecycle and remain safe as long as text sync never tries to do per-shot placeholder work.

### Tab-vs-tab conflict (unrelated to sync)

Two tabs autosaving the same project will 409 on the second save. Sync does not affect it because sync never bumps the editor's conflict version.

---

## Frontend follow-up after SSE

After text content tools complete and SSE reveals a `contentId`, the frontend should:

| Step | Why |
|---|---|
| `ensureSessionDraftVisible(queryClient, sessionId, contentId, ...)` | Wait until the new session-owned draft is query-visible instead of relying on one refetch |
| `POST /api/editor` | Create a linked editor project if one does not exist yet |
| `invalidateEditorProjectsQueries` | Editor project may have been created or updated |
| `invalidateChatProjectsQueries` | Project/session sidebars may need refreshed project metadata |
| `invalidateChatSessionQuery` (stream completion path) | Refresh persisted session state such as `activeContentId` |

After video generation completes per shot, `useEditorProjectPoll` detects `updatedAt` changes and merges via `MERGE_TRACKS_FROM_SERVER`. No explicit session-draft visibility step is needed because video generation does not create a new draft.

---

## What does NOT trigger sync

- `generate_video_reel` - async job, no new content row
- `regenerate_video_shot` - async job, no new content row
- `get_content` - read-only
- `get_reel_analysis` - read-only
- `update_content_status` - status change only, no track-relevant data changes
- `get_video_job_status` - read-only
- Editor autosave - editor-to-backend only, never triggers sync
- `refreshEditorTimeline` - video-job path, separate system
