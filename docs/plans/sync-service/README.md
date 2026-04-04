# SyncService

**Module location:** `backend/src/domain/editor/sync/sync.service.ts`

**Ephemeral:** This folder is implementation planning only and **will be deleted** once SyncService ships. Anything useful here (firing map, constraints, journeys) must be **copied into code comments** (and tests) so the repo stays understandable without these files.

## What it does

Keeps editor project timelines in sync with AI-generated content. After any text content tool call succeeds, SyncService re-derives the editor timeline from the latest content assets and writes it back to all linked editor projects before the SSE event fires to the frontend.

The chat system now owns drafts at the session level. Text tools save or update `generated_content`, attach that content to the current chat session, and keep `chat_sessions.activeContentId` in sync with the draft the user is iterating. SyncService does **not** own that draft/session state. It reacts after the content write succeeds and keeps linked editor projects aligned with the saved content.

## What it is NOT responsible for

- **Video shot-by-shot updates** - when `generate_video_reel` or `regenerate_video_shot` runs, `refreshEditorTimeline` in `reel-job-runner.ts` handles per-shot placeholder filling. SyncService is never involved.
- **Autosave conflict detection** - the editor's autosave owns version checking between tabs. SyncService never touches version.
- **Caption transcription** - `CaptionsService` handles Whisper calls. SyncService calls it but does not own it. Transcription is 1:1 per asset (idempotent).
- **Creating or selecting chat drafts** - chat save/iterate/edit flows own session membership (`chat_session_content`) and the server-side active draft pointer (`chat_sessions.activeContentId`).
- **Creating editor projects** - `EditorService.createEditorProject` calls `deriveTimeline` directly for initial project creation. `syncLinkedProjects` is only for re-sync of existing projects.

## Where it fires

`backend/src/domain/chat/send-message.stream.ts` - via the `onContentSaved` callback on `ToolContext`.

Only fires when a content tool sets `context.savedContentId`. Three tools do this:

| Tool | Creates new content? | Session draft effect | Fires sync? |
|---|---|---|---|
| `save_content` | Yes (new row) | Attach new content to session, advance `activeContentId` | Yes |
| `iterate_content` | Yes (new version) | Attach new content to session, advance `activeContentId` | Yes |
| `edit_content_field` | No (mutates existing row) | Keep same session-owned draft active | Yes |
| `generate_video_reel` | No | No session draft change | No |
| `regenerate_video_shot` | No | No session draft change | No |

## Key constraints

**Editor is source of truth.** `updateProjectForSync` does not increment any version counter. Sync is transparent to the autosave conflict system. If the editor autosaves after sync writes, the editor's local state wins. Cache invalidation -> re-fetch -> `MERGE_TRACKS_FROM_SERVER` ensures the editor picks up synced content before autosave fires in practice.

**SyncService does not manage session draft state.** Session membership and active-draft persistence happen in the chat tool save path. SyncService only receives the saved `contentId` and updates linked editor projects.

**Video track is not cleared on iterate.** If `deriveTimeline` returns zero video assets for a new content version (because videos have not been regenerated yet), the video track from the existing project is preserved. Only tracks that have new asset data are replaced.

**Caption transcription is idempotent.** `CaptionsService.transcribeAsset` checks for an existing caption doc by `assetId` before calling Whisper. Same voiceover asset -> same `captionDocId` -> user caption style edits survive re-sync.

**The chat client waits for draft visibility.** After SSE reveals a new `contentId`, the frontend now refetches session drafts until that ID is visible instead of relying on a one-shot invalidation. That keeps the session draft sidebar and active-draft UI aligned with the editor-sync path.

## Documents in this folder

| File | Purpose |
|---|---|
| `README.md` | This file - code-level reference |
| `user-journey.md` | Every user scenario and what happens end-to-end |
| `firing-map.md` | Complete table of every trigger, what fires, what updates |
| `high-level-design.md` | The problem, the two systems, key design decisions |
| `low-level-design.md` | Implementation plan - exact files, methods, code shapes; **requires** self-contained in-code comments that replace this folder when it is deleted |
