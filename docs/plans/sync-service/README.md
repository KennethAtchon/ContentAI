# SyncService

**Module location:** `backend/src/domain/editor/sync/sync.service.ts`

**Ephemeral folder:** This folder is implementation planning only and **will be deleted** once SyncService ships. Anything useful here (firing map, constraints, journeys) must be **copied into code comments** (and tests) so the repo stays understandable without these files.

---

## Overview

SyncService is the bridge between the chat/AI content system and the timeline editor. Its job today is narrow and well-defined: whenever a text content tool call succeeds (hook, script, voiceover, caption changes), re-derive the editor timeline from the latest content assets and write it back to all linked editor projects **before** the SSE event fires to the frontend.

That is all it does right now. But it is designed to be the long-term extension point for deeper AI-editor integration. Read the [High Level Design](./high-level-design.md) to understand the full future vision.

---

## What it does TODAY (Phase 1)

- Rebuilds the full editor timeline from scratch when text content changes (hook, script, voiceover, captions).
- Writes merged tracks to all editor projects linked to the content chain.
- Preserves user trim/position adjustments for clips that share the same `assetId` across syncs.
- Preserves the existing video track untouched when a new content version has no video yet.
- Triggers idempotent caption transcription (Whisper) for voiceover assets.
- Denormalizes `generatedHook` and `postCaption` to the editor project row for UI display.
- Advances `edit_projects.generatedContentId` to the latest content version in the chain.
- Does **not** bump the autosave conflict version — sync is transparent to the editor's conflict detection system.

All of this happens synchronously inside the AI stream, before SSE reaches the client.

---

## What it does NOT do (Phase 1)

These are out of scope right now but are the planned growth areas:

- **Video shot-by-shot updates** — when `generate_video_reel` or `regenerate_video_shot` runs, `refreshEditorTimeline` in `reel-job-runner.ts` handles progressive placeholder filling. SyncService is never involved in video generation.
- **Directly manipulating individual clips** — SyncService always rebuilds the full track set from content assets. It cannot yet target a specific clip or track for an AI-directed edit.
- **AI-driven track assembly** — selecting which shots to use, reordering clips, adjusting durations based on script timing — this lives in `ai-assembly-tracks.ts` and is not yet wired to the AI chat stream. See Phase 2 TODOs.
- **AI-generated caption styling** — CaptionsService handles transcription, but AI-driven caption style selection, word highlight timing, and preset application are future work.
- **Autosave conflict state** — the editor autosave owns version checking. SyncService never touches it.
- **Chat session draft membership** — `chat_session_content` and `chat_sessions.activeContentId` are owned by the chat tool save path. SyncService reacts after the save, not before.
- **Creating new editor projects** — `EditorService.createEditorProject` calls `SyncService.deriveTimeline` directly for initial project setup. `syncLinkedProjects` is only for re-sync of already-existing projects.

---

## The Two Update Paths (Critical Split)

There are two fundamentally different ways the editor gets updated from AI activity. They must stay separate:

### Path 1: Text content sync → SyncService

**Triggers:** `save_content`, `iterate_content`, `edit_content_field`

These tools run synchronously inside the AI chat stream. When they complete, SyncService can immediately re-derive the full timeline from current DB state and write it before SSE fires.

This path handles: hook text, caption text, voiceover asset changes, background music changes, caption transcription.

### Path 2: Video shot filling → `refreshEditorTimeline`

**Triggers:** `generate_video_reel`, `regenerate_video_shot` (async background jobs)

Video generation takes seconds to minutes per shot. The editor must update progressively as each shot completes. These are async background jobs that cannot block the chat stream. `refreshEditorTimeline` does a placeholder-aware merge that targets specific slots in the video track — something SyncService cannot do because it only knows about assets that already exist in the DB when it runs.

**These two paths are separate and must remain separate.** Never merge them.

---

## What happens when you regenerate video after editing?

This comes up often and is worth answering explicitly.

When a user calls `iterate_content` (rewrites the script), the new content version has no video assets yet. SyncService preserves the old video clips in the timeline so the user has something to work with. This is a deliberate preservation of stale-but-better-than-nothing state.

When the user then calls `generate_video_reel` on the new content version, a fresh batch of video `content_asset` rows gets created and placeholder clips are written to the video track. The old video clips are replaced by the new placeholder/shot set. **User trims from the old shots are not preserved** because the asset IDs change — you are working with entirely new shots now.

This is not "a lot of logic." It is a clean reset on the video track. The `generate_video_reel` tool intentionally starts video fresh from the current script. If a user wants to keep an old cut, they need to do that manually in the editor before regenerating.

---

## Where SyncService fires

**File:** `backend/src/domain/chat/send-message.stream.ts` — via the `onContentSaved` callback on `ToolContext`.

Only fires when a content tool sets a saved content ID. Three tools do this:

| Tool | Creates new content? | Session draft effect | Fires sync? |
|---|---|---|---|
| `save_content` | Yes (new row) | Attach to session, advance `activeContentId` | Yes |
| `iterate_content` | Yes (new version with `parentId`) | Attach to session, advance `activeContentId` | Yes |
| `edit_content_field` | No (mutates existing row) | Keep same active draft | Yes |
| `generate_video_reel` | No | No session draft change | **No** |
| `regenerate_video_shot` | No | No session draft change | **No** |

---

## Key invariants

**Editor is source of truth.** `updateProjectForSync` never increments the conflict version. If the editor autosaves after sync writes, the editor's local state wins. Cache invalidation → re-fetch → `MERGE_TRACKS_FROM_SERVER` ensures the editor picks up synced content before the next autosave fires in normal usage.

**SyncService does not manage session draft state.** Session membership and active-draft persistence happen in the chat tool save path before `onContentSaved` is called. SyncService only receives the saved `contentId` and updates linked editor projects.

**Video track is preserved on iterate.** If `deriveTimeline` returns zero video assets for a new content version (because videos have not been regenerated yet), the video track from the existing project is kept unchanged.

**Caption transcription is idempotent.** `CaptionsService.transcribeAsset` checks for an existing caption doc by `assetId` before calling Whisper. Same voiceover asset → same `captionDocId` → user caption style edits survive re-sync.

**The chat client waits for draft visibility.** After SSE reveals a new `contentId`, the frontend refetches session drafts until that ID is actually visible in the query rather than relying on a one-shot invalidation.

---

## Future: Deep AI-Editor Integration (Phase 2+)

The architecture is designed to grow here. The `source: "content" | "user"` field on every clip, the `ToolContext` callback pattern, and the `IEditorRepository` abstraction are all foundation pieces for Phase 2. See [High Level Design](./high-level-design.md#future-vision-phase-2) for the full roadmap and [Low Level Design](./low-level-design.md) for where the extension hooks live in code.

---

## Documents in this folder

| File | Purpose |
|---|---|
| `README.md` | This file — what it does, what it doesn't, key invariants |
| `high-level-design.md` | The problem being solved, architecture decisions, future vision |
| `firing-map.md` | Complete table of every trigger, what fires, what DB fields change |
| `user-journey.md` | Every user scenario end-to-end, including future AI editing scenarios |
| `low-level-design.md` | Exact files, methods, and code shapes; includes extension points and TODOs |
