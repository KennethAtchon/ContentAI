# SyncService

**Module location:** `backend/src/domain/editor/sync/sync.service.ts`

**Ephemeral:** This folder is implementation planning only and **will be deleted** once SyncService ships. Anything useful here (firing map, constraints, journeys) must be **copied into code comments** (and tests) so the repo stays understandable without these files.

## What it does

Keeps editor project timelines in sync with AI-generated content. After any text content tool call succeeds, SyncService re-derives the editor timeline from the latest content assets and writes it back to all linked editor projects — before the SSE event fires to the frontend.

## What it is NOT responsible for

- **Video shot-by-shot updates** — when `generate_video_reel` or `regenerate_video_shot` runs, `refreshEditorTimeline` in `reel-job-runner.ts` handles per-shot placeholder filling. SyncService is never involved.
- **Autosave conflict detection** — the editor's autosave owns version checking between tabs. SyncService never touches version.
- **Caption transcription** — `CaptionsService` handles Whisper calls. SyncService calls it but doesn't own it. Transcription is 1:1 per asset (idempotent).
- **Creating editor projects** — `EditorService.createEditorProject` calls `deriveTimeline` directly for initial project creation. `syncLinkedProjects` is only for re-sync of existing projects.

## Where it fires

`backend/src/domain/chat/send-message.stream.ts` — via the `onContentSaved` callback on `ToolContext`.

Only fires when a content tool sets `context.savedContentId`. Three tools do this:

| Tool | Creates new content? | Fires sync? |
|---|---|---|
| `save_content` | Yes (new row) | Yes |
| `iterate_content` | Yes (new version) | Yes |
| `edit_content_field` | No (mutates existing) | Yes |
| `generate_video_reel` | No | **No** |
| `regenerate_video_shot` | No | **No** |

## Key constraints

**Editor is source of truth.** `updateProjectForSync` does not increment any version counter. Sync is transparent to the autosave conflict system. If the editor autosaves after sync writes, the editor's local state wins. Cache invalidation → re-fetch → `MERGE_TRACKS_FROM_SERVER` ensures the editor picks up synced content before autosave fires in practice.

**Video track is not cleared on iterate.** If `deriveTimeline` returns zero video assets for a new content version (because videos haven't been regenerated yet), the video track from the existing project is preserved. Only tracks that have new asset data are replaced.

**Caption transcription is idempotent.** `CaptionsService.transcribeAsset` checks for an existing caption doc by `assetId` before calling Whisper. Same voiceover asset → same `captionDocId` → user caption style edits survive re-sync.

## Documents in this folder

| File | Purpose |
|---|---|
| `README.md` | This file — code-level reference |
| `user-journey.md` | Every user scenario and what happens end-to-end |
| `firing-map.md` | Complete table of every trigger, what fires, what updates |
| `high-level-design.md` | The problem, the two systems, key design decisions |
| `low-level-design.md` | Implementation plan — exact files, methods, code shapes; **requires** self-contained in-code comments that replace this folder when it is deleted — see “In-code documentation” there |
