# SyncService - User Journeys

> **Planning only - this file will be deleted.** Preserve any scenario nuance that affects code in tests and/or comments at the relevant implementation sites.

Each scenario traces what the user does, what fires on the backend, and what the editor sees.

---

## 1. User sends first message, AI generates content

**User action:** Types a prompt in chat, AI responds with hook/script/caption and calls `save_content`.

**What fires:**
1. `save_content` creates a new `generated_content` row.
2. The chat save path attaches that content to the current session and advances `chat_sessions.activeContentId` to the new draft.
3. `context.savedContentId` is set and `onContentSaved` runs `syncLinkedProjects`.
4. `syncLinkedProjects` looks for editor projects linked to this content chain - finds none (project does not exist yet) - returns immediately.
5. SSE completes and the frontend receives the new `contentId`.
6. `useStreamingContentSideEffects` refetches session drafts until that `contentId` is actually visible in the session draft query.
7. The frontend calls `POST /api/editor` with `generatedContentId`.
8. `EditorService.createEditorProject` calls `SyncService.deriveTimeline` and inserts the project.
9. Frontend invalidates editor/chat project caches and the project appears in the editor list.

**Editor state:** Project created with voiceover clip + empty video track + captions (if voiceover exists). No video clips until `generate_video_reel` is called.

**Chat state:** The new draft belongs to the current session immediately on the server, becomes visible in the draft sidebar once the visibility retry sees it, and is the active draft for the next prompt.

---

## 2. User asks AI to edit the hook or caption

**User action:** "Make the hook punchier" -> AI calls `edit_content_field`.

**What fires:**
1. `edit_content_field` mutates the existing `generated_content` row.
2. The same session-owned draft remains active.
3. `onContentSaved(contentId)` runs `syncLinkedProjects`.
4. `syncLinkedProjects` resolves the content chain and finds linked editor projects.
5. `deriveTimeline` rebuilds tracks from current assets - voiceover is the same asset -> same `captionDocId` returned (no re-transcription) -> video clips are the same assets -> user trims/positions preserved via `mergeTrackSets`.
6. `updateProjectForSync` writes new `generatedHook`, new `postCaption`, and merged tracks with no version bump.
7. SSE fires; the stream completion path refreshes the session query, while the draft-visibility helper sees that the existing draft is already present.
8. Editor clients re-fetch and merge synced tracks.

**Editor state:** Hook and caption text update in UI. Track clips are unchanged. User trims/positions are preserved.

---

## 3. User asks AI to rewrite the script (`iterate_content`)

**User action:** "Rewrite this completely with a different angle" -> AI calls `iterate_content`.

**What fires:**
1. `iterate_content` creates a new `generated_content` row with `parentId` pointing to the old version.
2. The chat save path attaches the new row to the current session and advances `chat_sessions.activeContentId` to the new draft before SSE reaches the client.
3. `onContentSaved(newContentId)` runs `syncLinkedProjects`.
4. `syncLinkedProjects` resolves the ancestor chain (new ID + old ID) and finds editor projects linked to the older version.
5. `deriveTimeline(newContentId)` returns no video assets yet, so the fresh video track is empty.
6. `mergeTrackSets` preserves the existing video clips unchanged while replacing audio/music/text tracks from the new content version.
7. `updateProjectForSync` advances `edit_projects.generatedContentId` to the new content ID and writes merged tracks.
8. SSE fires with the new `contentId`.
9. The frontend waits until that draft is visible in the session draft query, then the chat workspace/composer start treating it as the active draft.
10. Editor caches refresh and the linked project updates to the new content version.

**Editor state:** Hook and caption update. Old video clips still exist in the timeline - they are stale relative to the new script but still play. The user can call `generate_video_reel` to regenerate shots for the new script.

**Chat state:** The new version shows up as a new session draft and becomes the draft the next prompt iterates by default.

---

## 4. User triggers video generation

**User action:** "Generate the video" -> AI calls `generate_video_reel`.

**What fires:**
1. `generate_video_reel` creates a `video_job` and fires async `runReelGeneration`.
2. It does **not** set `context.savedContentId`, does **not** trigger `syncLinkedProjects`, and does **not** create a new session draft.
3. Per shot, `runReelGeneration` updates placeholders through `refreshEditorTimeline`.
4. Editor polling sees `updatedAt` changes and merges shot updates progressively.

**Editor state:** Shots fill in one by one.

**Chat state:** The session draft list does not gain a new draft. The active draft stays the same `generated_content` row; only its linked video assets change.

---

## 5. User regenerates a specific shot

**User action:** "Shot 3 looks wrong, regenerate it" -> AI calls `regenerate_video_shot`.

**What fires:**
1. `regenerate_video_shot` creates a `video_job` (kind: `shot_regenerate`) and starts async shot regeneration.
2. The job replaces one `content_asset` row for the same `generated_content` record.
3. `refreshEditorTimeline` updates the editor timeline for that slot.
4. No new draft is created. No `syncLinkedProjects` call runs.

**Editor state:** Shot 3 is replaced. User trim on the old shot is not carried forward to the new asset.

**Chat state:** Same session-owned draft remains active. No draft-list change.

---

## 6. User edits in the editor while AI is generating in chat

**User action:** User trims shot 1 in the editor while AI is generating shot 2 in the background.

**What fires (concurrently):**
- Editor: user trim -> `locallyModified: true` -> autosave debounce -> `PATCH /api/editor/:id`
- Background job: `refreshEditorTimeline` writes shot 2 placeholder -> later writes the real clip

**Conflict resolution:**
- Autosave sends the full `tracks` payload from local state. It wins on the fields it sends.
- `refreshEditorTimeline` writes only synced timeline fields and does not bump a sync-specific version.
- If autosave fires after a timeline refresh, the next poll cycle brings the refreshed shot back in.

**Editor state:** User trim is preserved. Shot 2 appears within one poll cycle.

---

## 7. Two editor tabs open simultaneously

**User action:** User has the editor open in two tabs. Both make edits.

**What fires:**
- Tab A autosaves with `expectedVersion = N` -> server accepts -> version becomes `N+1`
- Tab B autosaves with `expectedVersion = N` -> 409 conflict

**Resolution:** Tab B shows a conflict dialog. SyncService does not cause these conflicts because it never bumps the editor's conflict version.

---

## 8. User opens editor after AI has already iterated content

**User action:** User left the editor open on content v1. AI iterated to v2 in chat. User switches back to the editor tab.

**What fires:**
1. When AI saved v2, the chat layer attached it to the session, advanced `activeContentId`, and SyncService updated linked editor projects to point at v2.
2. When the user returns, the browser re-focuses and editor queries re-fetch.
3. The editor merges the updated server tracks and denormalized text fields.

**Editor state:** Editor silently updates to reflect v2 content. No conflict dialog from sync activity.

**Chat state:** The session already considers v2 the active draft, so chat and editor remain aligned when the user switches back and forth.
