# SyncService - User Journeys

> **Planning only - this file will be deleted.** Preserve any scenario nuance that affects code in tests and/or comments at the relevant implementation sites.

Each scenario traces what the user does, what fires on the backend, and what the editor sees. Phase 1 scenarios are current behavior. Phase 2 scenarios are future work.

---

## Phase 1 Journeys (Current Behavior)

### 1. User sends first message, AI generates content

**User action:** Types a prompt in chat, AI responds with hook/script/caption and calls `save_content`.

**What fires:**
1. `save_content` creates a new `generated_content` row.
2. The chat save path attaches that content to the current session and advances `chat_sessions.activeContentId` to the new draft.
3. `onContentSaved` fires → `syncLinkedProjects`.
4. `syncLinkedProjects` looks for editor projects linked to this content chain — finds none (project does not exist yet) — returns immediately.
5. SSE completes and the frontend receives the new `contentId`.
6. `useStreamingContentSideEffects` refetches session drafts until that `contentId` is actually visible in the session draft query.
7. The frontend calls `POST /api/editor` with `generatedContentId`.
8. `EditorService.createEditorProject` calls `SyncService.deriveTimeline` and inserts the project.
9. Frontend invalidates editor/chat project caches and the project appears in the editor list.

**Editor state:** Project created with voiceover clip + empty video track + captions (if voiceover exists). No video clips until `generate_video_reel` is called.

**Chat state:** The new draft belongs to the current session immediately on the server, becomes visible in the draft sidebar once the visibility retry sees it, and is the active draft for the next prompt.

---

### 2. User asks AI to edit the hook or caption

**User action:** "Make the hook punchier" → AI calls `edit_content_field`.

**What fires:**
1. `edit_content_field` mutates the existing `generated_content` row in place.
2. The same session-owned draft remains active (no new content row, no draft list change).
3. `onContentSaved(contentId)` fires → `syncLinkedProjects`.
4. `syncLinkedProjects` resolves the content chain and finds the linked editor project.
5. `deriveTimeline` rebuilds tracks from current assets — voiceover is the same asset → same `captionDocId` returned (no re-transcription, idempotent) → video clips are the same assets → user trims/positions preserved via `mergeTrackSets`.
6. `updateProjectForSync` writes new `generatedHook`, new `postCaption`, and merged tracks with no version bump.
7. SSE fires; the stream completion path refreshes the session query. Draft-visibility helper sees that the existing draft is already present (no new contentId).
8. Editor clients re-fetch and merge synced tracks.

**Editor state:** Hook and caption text update in UI. Track clips are unchanged. User trims and positions are preserved because the asset IDs did not change.

**Chat state:** Same draft, same position in draft list. No new draft appears.

---

### 3. User asks AI to rewrite the script (`iterate_content`)

**User action:** "Rewrite this completely with a different angle" → AI calls `iterate_content`.

**What fires:**
1. `iterate_content` creates a new `generated_content` row with `parentId` pointing to the old version.
2. The chat save path attaches the new row to the current session and advances `chat_sessions.activeContentId` to the new draft.
3. `onContentSaved(newContentId)` fires → `syncLinkedProjects`.
4. `syncLinkedProjects` resolves the ancestor chain (new ID + old ID) and finds editor projects linked to the older version.
5. `deriveTimeline(newContentId)` returns no video assets yet — the new content version has not had video generated.
6. `mergeTrackSets` preserves the existing video clips unchanged (empty fresh video track = keep existing) while replacing audio/music/text tracks with data from the new content version.
7. `updateProjectForSync` advances `edit_projects.generatedContentId` to the new content ID and writes merged tracks.
8. SSE fires with the new `contentId`.
9. The frontend waits until that draft is visible in the session draft query, then the chat workspace and composer treat it as the active draft.
10. Editor caches refresh. The linked project now points at the new content version with old video clips still intact.

**Editor state:** Hook and caption update to the new version. Old video clips still exist in the timeline — they are stale relative to the new script but playable. User can call `generate_video_reel` to regenerate shots for the new script.

**Chat state:** The new version appears as a new session draft and becomes the default draft for the next prompt.

---

### 4. User triggers video generation

**User action:** "Generate the video" → AI calls `generate_video_reel`.

**What fires:**
1. `generate_video_reel` creates a `video_job` and fires async `runReelGeneration`.
2. It does **not** set a saved content ID, does **not** trigger `syncLinkedProjects`, does **not** create a new session draft.
3. Per shot, `runReelGeneration` fills placeholders through `refreshEditorTimeline`.
4. Editor polling sees `updatedAt` changes and merges shot updates progressively via `MERGE_TRACKS_FROM_SERVER`.

**Editor state:** The video track gets replaced with placeholder clips when the job starts. Shots fill in one by one as generation completes.

**Chat state:** No new draft. The active draft stays the same `generated_content` row; only its linked video assets change.

---

### 5. User regenerates a specific shot

**User action:** "Shot 3 looks wrong, regenerate it" → AI calls `regenerate_video_shot`.

**What fires:**
1. `regenerate_video_shot` creates a `video_job` (kind: `shot_regenerate`) and starts async shot regeneration.
2. The job replaces one `content_asset` row for the same `generated_content` record.
3. `refreshEditorTimeline` updates the editor timeline for that slot.
4. No new draft is created. No `syncLinkedProjects` call runs.

**Editor state:** Shot 3 is replaced by the new asset. User trims on the old shot are not carried forward to the new asset (different asset ID = no trim preservation).

**Chat state:** Same session-owned draft remains active. No draft-list change.

---

### 6. User edits video in the editor, then asks AI to iterate content

**User action:** User manually trims shot 1 in the editor, then tells the AI to rewrite the hook.

**What fires (sequential):**
1. User trim → `locallyModified: true` → autosave debounce → `PATCH /api/editor/:id`
2. User asks AI to rewrite hook → `edit_content_field` or `iterate_content` fires
3. `syncLinkedProjects` runs → `deriveTimeline` rebuilds tracks
4. `mergeTrackSets` checks: video assets are the same (`assetId` unchanged), so user's trim adjustment on shot 1 is preserved and carried onto the fresh clip
5. `updateProjectForSync` writes back the merged tracks

**Editor state:** Hook updates. User's trim on shot 1 is preserved because the video asset ID did not change. If the user had regenerated video before asking for the hook change, the trim would be gone (different asset IDs after regeneration).

**Chat state:** Updated draft.

---

### 7. User regenerates video after the hook has been iterated

This is the "video clean reset" scenario.

**What happens:**
1. User has content v2 (iterated hook). Editor has old video clips from v1 still in the timeline (preserved by merge rule).
2. User calls `generate_video_reel` on v2.
3. A new batch of `content_asset` rows is created for v2 shots. These have entirely new asset IDs.
4. The video track in the editor gets replaced with new placeholder clips for v2's shots.
5. As each shot completes, `refreshEditorTimeline` fills the placeholder with the real clip.

**Editor state:** Old video clips are gone. New shots fill in progressively. User trims from the old shots are not preserved — those were trimming clips with different asset IDs. The user has a fresh video cut aligned to the new script.

**This is intentional.** Regenerating video = starting video fresh. The user is explicitly asking for new shots. Old trims are stale relative to new footage anyway.

---

### 8. User edits in the editor while AI is generating in chat

**User action:** User trims shot 1 in the editor while AI is generating shot 2 in the background.

**What fires (concurrently):**
- Editor: user trim → `locallyModified: true` → autosave debounce → `PATCH /api/editor/:id`
- Background job: `refreshEditorTimeline` writes shot 2 placeholder → later fills the real clip

**Conflict resolution:**
- Autosave sends the full `tracks` payload from local state. It wins on the fields it sends.
- `refreshEditorTimeline` writes only synced timeline fields and does not bump the conflict version.
- If autosave fires after a timeline refresh, the next poll cycle via `MERGE_TRACKS_FROM_SERVER` brings the refreshed shot back in.

**Editor state:** User trim is preserved. Shot 2 appears within one poll cycle of its generation completing.

---

### 9. Two editor tabs open simultaneously

**User action:** User has the editor open in two tabs. Both make edits.

**What fires:**
- Tab A autosaves with `expectedVersion = N` → server accepts → version becomes `N+1`
- Tab B autosaves with `expectedVersion = N` → 409 conflict

**Resolution:** Tab B shows a conflict dialog. SyncService does not cause these conflicts because it never bumps the editor's conflict version.

---

### 10. User opens editor after AI has already iterated content in another tab

**User action:** User left the editor open on content v1. In another tab, they chatted with the AI which iterated to v2. User switches back to the editor tab.

**What fires:**
1. When AI saved v2, the chat layer attached it to the session, advanced `activeContentId`, and SyncService updated the linked editor project to point at v2.
2. When the user returns to the editor tab, the browser re-focuses and editor queries re-fetch.
3. The editor merges the updated server tracks and denormalized text fields.

**Editor state:** Editor silently updates to reflect v2 content. No conflict dialog — sync activity never bumped the conflict version.

**Chat state:** The session already considers v2 the active draft, so chat and editor remain aligned when the user switches back and forth.

---

## Phase 2 Journeys (Future AI-Editor Integration)

These scenarios do not exist yet. They are documented here to make sure the Phase 1 architecture doesn't block them.

---

### 11. User asks AI to assemble the video cut (Future)

**User action:** "Assemble the video to match my script pacing" → AI calls `assemble_video_cut` (not yet built).

**What would fire:**
1. `assemble_video_cut` calls `loadProjectShotAssets` from `ai-assembly-tracks.ts` to get available shots.
2. AI model (via a structured tool response) produces a `cuts` array — which shot to use at which time with what trim.
3. `convertAIResponseToTracks` (already in `ai-assembly-tracks.ts`) converts the AI response to a track set.
4. The assembled track set needs to be written to the editor project. This could go through:
   - A new `onEditorAction` callback (no new content row needed), OR
   - Through `syncLinkedProjects` with an assembly plan override to `deriveTimeline`
5. Editor caches invalidate and the user sees the AI-assembled cut.

**Why the foundation is ready:** `ai-assembly-tracks.ts` already has the conversion logic. The missing pieces are the chat tool definition and the callback/dispatch mechanism.

---

### 12. User asks AI to trim a shot (Future)

**User action:** "Trim the third shot to 2 seconds" → AI calls `trim_clip` (not yet built).

**What would fire:**
1. `trim_clip` resolves the target clip by shot index or label.
2. Dispatches `{ type: "trim_clip", clipId, durationMs: 2000 }` via `onEditorAction(projectId, [op])`.
3. A new repository method `applyClipOperations` applies the operation to the stored tracks.
4. The operation writes to `edit_projects.tracks` without creating a new content version and without bumping the conflict version.
5. Editor caches invalidate.

**Why the foundation is ready:** `IEditorRepository` is the right abstraction layer. `updateProjectForSync` is the model for a sync-safe write. The missing piece is `applyClipOperations` and the `onEditorAction` callback in `ToolContext`.

---

### 13. User asks AI to set a caption style (Future)

**User action:** "Use the bold yellow caption style" → AI calls `set_caption_preset` (not yet built).

**What would fire:**
1. `set_caption_preset` resolves the preset by name from `CaptionsService`.
2. Updates the caption clip's `presetId` field in the text track.
3. Dispatches via `onEditorAction` or directly updates the caption doc.
4. Editor re-renders with the new caption style.

**Why the foundation is ready:** Caption clips already have a `presetId` field. `CaptionsService` manages caption docs. The missing piece is the tool definition and the write path.
