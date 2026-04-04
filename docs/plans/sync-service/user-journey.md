# SyncService — User Journeys

> **Planning only — this file will be deleted.** Preserve any scenario nuance that affects code in tests and/or comments at the relevant implementation sites.

Each scenario traces what the user does, what fires on the backend, and what the editor sees.

---

## 1. User sends first message, AI generates content

**User action:** Types a prompt in chat, AI responds with hook/script/caption and calls `save_content`.

**What fires:**
1. `save_content` tool executes → new `generated_content` row created → `context.savedContentId` set → `onContentSaved` fires → `syncLinkedProjects` runs
2. `syncLinkedProjects` looks for editor projects linked to this content chain — finds none (project doesn't exist yet) → returns immediately, nothing written
3. SSE event completes → frontend receives `streamingContentId`
4. `useStreamingContentSideEffects` fires `POST /api/editor` with `generatedContentId`
5. `EditorService.createEditorProject` calls `SyncService.deriveTimeline` → builds timeline from current assets (voiceover if generated, no video yet) → inserts project
6. Frontend invalidates editor cache → editor project appears in sidebar

**Editor state:** Project created with voiceover clip + empty video track + captions (if voiceover exists). No video clips until `generate_video_reel` is called.

---

## 2. User asks AI to edit the hook or caption

**User action:** "Make the hook punchier" → AI calls `edit_content_field`.

**What fires:**
1. `edit_content_field` mutates existing `generated_content` row → `onContentSaved(contentId)` fires → `syncLinkedProjects` runs
2. `syncLinkedProjects` resolves content chain → finds linked editor project
3. `deriveTimeline` rebuilds tracks from current assets — voiceover is same asset → same `captionDocId` returned (no re-transcription) → video clips same assets → user trims/positions preserved via `mergeTrackSets`
4. `updateProjectForSync` writes: new `generatedHook`, new `postCaption`, merged tracks — **no version bump**
5. SSE event fires → frontend invalidates editor cache
6. Editor re-fetches → `useEditorProjectPoll` detects new `updatedAt` → `MERGE_TRACKS_FROM_SERVER` → local state updated
7. Autosave debounce fires → saves merged state

**Editor state:** Hook and caption text updated in UI. Track clips unchanged. User trims/positions preserved.

---

## 3. User asks AI to rewrite the script (iterate_content)

**User action:** "Rewrite this completely with a different angle" → AI calls `iterate_content`.

**What fires:**
1. `iterate_content` creates new `generated_content` row with `parentId` pointing to old version → `onContentSaved(newContentId)` fires → `syncLinkedProjects` runs
2. `syncLinkedProjects` resolves ancestor chain (new ID + old ID) → finds editor project (linked to old ID)
3. `deriveTimeline(newContentId)` — new content has no video assets yet → video track comes back empty
4. **Video track preservation rule:** Because fresh video track is empty, `mergeTrackSets` keeps the existing video clips from the project (old content's videos stay)
5. `updateProjectForSync` advances `generatedContentId` to new content ID, updates `generatedHook`/`postCaption`, writes merged tracks
6. SSE fires → cache invalidated → editor re-fetches

**Editor state:** Hook and caption updated. Old video clips still in the timeline — they're stale relative to the new script but still play. User can call `generate_video_reel` to regenerate shots for the new script.

---

## 4. User triggers video generation

**User action:** "Generate the video" → AI calls `generate_video_reel`.

**What fires:**
1. `generate_video_reel` creates a `video_job` and fires async `runReelGeneration` — does **not** set `context.savedContentId`, **does not** trigger `syncLinkedProjects`
2. Per shot, `runReelGeneration` does:
   - Before render: `refreshEditorTimeline(contentId, userId, { placeholderStatus: "generating", shotIndex })` — marks placeholder as in-progress
   - After render: `contentService.insertGeneratedVideoClipAndLink` → `refreshEditorTimeline(contentId, userId)` — fills placeholder with real clip
3. `useEditorProjectPoll` polls while placeholders exist → detects new `updatedAt` each shot → `MERGE_TRACKS_FROM_SERVER` → user sees shots appear one by one

**Editor state:** Shots fill in progressively. No new draft is created — same `generated_content` row, only `content_assets` change. Video generation does not affect the chat draft list.

---

## 5. User regenerates a specific shot

**User action:** "Shot 3 looks wrong, regenerate it" → AI calls `regenerate_video_shot`.

**What fires:**
1. `regenerate_video_shot` creates a `video_job` (kind: `shot_regenerate`) → async `runShotRegenerate`
2. `runShotRegenerate` generates new clip → `contentService.replaceGeneratedVideoClipForShot` removes old asset, inserts new asset with same `shotIndex` → `refreshEditorTimeline` → editor updates that slot
3. No new draft created. No `syncLinkedProjects` call.

**Editor state:** Shot 3 replaced with new clip. User trim on old shot is not carried forward (new video, different duration — trim wouldn't apply). All other shots unchanged.

---

## 6. User edits in the editor while AI is generating in chat

**User action:** User trims shot 1 in the editor while AI is generating shot 2 in the background.

**What fires (concurrently):**
- Editor: user trim → `locallyModified: true` → autosave debounce → `PATCH /api/editor/:id`
- Background job: `refreshEditorTimeline` writing shot 2 placeholder → real clip

**Conflict resolution:**
- Autosave sends full `tracks` payload from local state. It wins on the fields it sends.
- `refreshEditorTimeline` writes only `tracks` (no version bump). It updates the server's DB copy.
- If autosave fires after `refreshEditorTimeline`: autosave's local state (which has the user's trim but may not have shot 2's update yet) is saved. Shot 2 lands in the next poll cycle.
- Editor never loses user edits. Content updates appear within one poll cycle.

**Editor state:** User's trim is preserved. Shot 2 appears within 2 seconds (poll interval).

---

## 7. Two editor tabs open simultaneously

**User action:** User has the editor open in two tabs. Both make edits.

**What fires:**
- Tab A autosaves with `expectedVersion = N` → server accepts → version becomes `N+1`
- Tab B autosaves with `expectedVersion = N` → 409 conflict

**Resolution:** Tab B shows conflict dialog. User must refresh to see latest state. This is intentional — two tabs editing the same project is a conflict. SyncService does not affect this: it never bumps version, so sync activity never triggers a spurious 409.

---

## 8. User opens editor after AI has already iterated content

**User action:** User left the editor open on content v1. AI iterated to v2 in chat. User switches back to the editor tab.

**What fires:**
1. When AI saved v2: `syncLinkedProjects` ran, wrote new tracks to DB, advanced `generatedContentId` to v2 ID
2. When user switches to editor tab: browser re-focuses → React Query refetches → editor gets new `updatedAt` → `MERGE_TRACKS_FROM_SERVER`

**Editor state:** Editor silently updates to reflect v2 content. No conflict dialog — sync didn't bump version. User sees updated hook/caption and any new audio; video clips unchanged until regenerated.
