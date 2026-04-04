# SyncService - High Level Design

This document is planning-only and will be removed with the rest of `docs/plans/sync-service/`. The shipped code must embed the same ideas in comments (firing paths, constraints, non-goals, future TODOs) so nothing here is required to maintain the system.

---

## The Problem

ReelStudio has two systems that share data but have no live connection:

**Chat/AI system** — the user talks to the model, which generates and iterates `generated_content` rows (hook, script, voiceover, caption). Those rows are attached to chat sessions through `chat_session_content`, and `chat_sessions.activeContentId` is the server-side pointer for the draft the user is currently iterating.

**Editor system** — a timeline editor backed by `edit_projects` rows. Each project has a `tracks` JSON blob containing clips, each clip referencing a `content_asset` by `assetId`.

The problem: **these two systems diverge.** When the AI iterates content — new hook, new voiceover, new caption — the editor project still shows the old data. The only sync point was project creation (`buildInitialTimeline`), which ran once and never again.

SyncService fixes this: whenever a text content write succeeds, every linked editor project catches up to the saved content before the client finishes processing the stream.

---

## Phase 1 (NOW): Surface-Level Text Sync

### What is in scope

Phase 1 is deliberately narrow. SyncService only handles the surface-level text content changes that flow through the chat tools:

- Hook text updates (`generatedHook`)
- Caption text updates (`postCaption`)
- Voiceover asset changes (new TTS output, triggers caption re-transcription)
- Background music asset changes

It does this by rebuilding the entire set of content-derived tracks from scratch on every sync (`deriveTimeline`) and then merging back user adjustments from the existing project state.

### What is explicitly out of scope for Phase 1

- **AI directly editing individual clips** — trimming, reordering, moving — is not possible with the current sync model. SyncService only knows how to rebuild from assets.
- **AI assembling custom cuts** — choosing which shots to use, how long to hold each one, cut timing to match the voiceover. The foundation (`ai-assembly-tracks.ts`) already exists but is not yet wired to the AI stream.
- **AI setting caption style presets, animation effects, or timing** — CaptionsService only transcribes today.
- **AI creating or modifying text overlay tracks (beyond captions)** — not yet a concept.
- **Progressive video assembly in chat** — video generation remains a separate async path (`refreshEditorTimeline`).

---

## The Two Update Paths (Must Stay Separate)

### Path 1: Text content sync (SyncService)

Triggered by: `save_content`, `iterate_content`, `edit_content_field`

These run synchronously inside the AI chat stream. SyncService can re-derive the full timeline immediately and write it to the DB before SSE fires. This path always has complete asset data available.

**Handles:** hook/caption text changes, voiceover asset changes, music asset changes, caption transcription updates.

### Path 2: Video shot filling (`refreshEditorTimeline`)

Triggered by: `generate_video_reel`, `regenerate_video_shot` (async background jobs)

Video generation takes seconds to minutes per shot. The editor needs to update progressively as each shot completes. This requires a placeholder-aware merge that targets specific slots in the video track. SyncService cannot do this — it only knows about assets that already exist in the DB when it runs.

**Handles:** filling placeholder clips with real video clips, marking shots as generating/failed, replacing regenerated shots.

**These two paths are separate and must remain separate.** The distinction is not arbitrary — it reflects a fundamental timing difference (sync-in-stream vs async-over-time) and a structural difference (full re-derive vs targeted placeholder fill).

---

## Key Design Decisions (Phase 1)

### 1. Full re-derive, not incremental patch

The old approach (`merge-new-assets.ts`) tracked which assets had been merged via `mergedAssetIds` and only patched new ones in. This created drift — if an asset was removed or replaced, the old clip stayed in the timeline indefinitely.

SyncService throws away incremental patching. `deriveTimeline` rebuilds the entire set of content-derived clips from scratch on every sync. User adjustments (trims, positions) are then merged back from the existing project. The result is always consistent with the current content state.

This is slightly more expensive per call than an incremental patch, but the correctness guarantee is worth it. The cost is acceptable because syncs are infrequent (one per text content tool call) and the number of clips is small.

### 2. Editor is source of truth in conflicts

SyncService never bumps any version counter. It writes tracks and denormalized text fields — that is it. If the editor autosaves after sync writes, the editor's payload wins on whatever fields it sends.

The practical ordering is:

1. Text tool saves content and updates session draft state
2. SyncService writes linked editor projects
3. SSE fires with the saved `contentId`
4. The chat client waits until the session draft query actually contains that `contentId`
5. The editor project cache is invalidated or created
6. Editor clients re-fetch and merge server tracks before the next autosave

By the time autosave fires in normal usage, local editor state already reflects the synced content.

### 3. `source` field distinguishes user vs AI clips

Every clip gets a `source` field: `"content"` for AI-derived clips, `"user"` for manually added clips. This is how `mergeTrackSets` knows what to replace and what to keep. Without it, re-sync would have to guess which clips were user-added.

Old clips without a `source` field are treated as `"content"` (they predate this change and were all content-derived anyway).

**This field is also the Phase 2 extension point.** When AI can directly edit individual clips, those edits will carry a third value (e.g., `"ai_edit"`) and the merge rules will be extended accordingly. See [Phase 2 section](#future-vision-phase-2).

### 4. Video track preservation on iterate

When `iterate_content` creates a new content version, that version has no video assets yet. `deriveTimeline` returns an empty video track. Rather than clearing the editor's video track (confusing and destructive), SyncService preserves the existing video clips unchanged when the fresh video track is empty. The user still has a working timeline; it just has stale video until they regenerate.

When the user does regenerate via `generate_video_reel`, the video track gets replaced with new placeholder/shot clips. This is a clean reset — old trims are not carried forward because the asset IDs change completely on regeneration. This is intentional: regenerating video means starting video fresh from the current script.

### 5. Caption transcription is idempotent

`CaptionsService.transcribeAsset` checks for an existing caption doc by `assetId` before calling Whisper. Same voiceover asset → same `captionDocId` returned → user caption style edits survive re-sync. Re-syncing with the same voiceover never triggers a redundant Whisper call.

---

## Data Model Relationships

```text
chat_sessions (activeContentId)
    |
    +-- chat_session_content (session <-> generated_content membership)
            |
            +-- generated_content (N versions, linked by parentId)
                    |
                    +-- content_assets (video_clip, voiceover, background_music)
                    |       |
                    |       +-- assets (r2Key, durationMs, metadata)
                    |
                    +-- edit_projects (generatedContentId -> generated_content.id)
                            |
                            +-- tracks (JSON) -> clips -> assetId -> assets.id
```

Session membership is the source of truth for which drafts belong to the current chat workspace. `edit_projects.generatedContentId` is advanced to the latest content version by each sync. The ancestor chain (`resolveContentAncestorChainIds`) lets SyncService find editor projects linked to any version in the lineage.

---

## What Was Deleted

| Old code | Why it existed | Why it is gone |
|---|---|---|
| `build-initial-timeline.ts` | Built tracks once on project creation | Replaced by `SyncService.deriveTimeline` |
| `merge-new-assets.ts` | Incremental patch for new assets | Replaced by full re-derive in `syncLinkedProjects` |
| `mergedAssetIds` column | Tracked which assets had been merged | No longer needed — full re-derive on every sync |
| `syncNewAssetsIntoProject()` on EditorService | Called `mergeNewAssetsIntoProject` | Deleted with it |

`refreshEditorTimeline` on `IEditorRepository` is **not** deleted — still used by the video job runner for placeholder-aware shot filling.

---

## Future Vision (Phase 2+)

This section describes where we are going. None of this is being built now. The architecture of Phase 1 is chosen specifically so Phase 2 is a natural extension rather than a rewrite.

### The Goal: AI as a Co-Editor

Right now the AI produces content (text, voiceover, video shots) and the editor assembles it. The next step is AI that can actively edit the timeline — not just produce assets, but arrange, trim, retime, and style them.

Concretely:
- **AI-directed clip assembly** — AI reads the script, selects which shots to use, decides how long to hold each one, aligns cuts to voiceover timing. `ai-assembly-tracks.ts` already has the conversion logic for this; it needs to be wired to a chat tool.
- **AI trim and reorder operations** — AI says "trim shot 2 to 3 seconds, move it before shot 1." These are direct mutations to specific clips in the timeline, not a full re-derive.
- **AI caption styling** — AI selects a caption preset, adjusts highlight timing, sets animation style. CaptionsService handles transcription today; caption styling is the next layer.
- **AI text overlay creation** — AI creates lower thirds, title cards, call-to-action overlays as explicit text clips on the timeline.
- **Proactive AI suggestions** — AI detects that the voiceover timing doesn't match the video cuts and suggests a fix without being asked.

### How Phase 1 Enables Phase 2

**`source` field extension.** The `"content" | "user"` source field is designed to gain a third value: `"ai_edit"`. This identifies clips that were placed by an AI direct-edit tool (not derived from assets, not placed by the user). `mergeTrackSets` will be extended with rules for how AI-edit clips interact with content syncs and user edits.

**`ToolContext` callback pattern.** Today, `onContentSaved` is the only AI→editor communication channel. Phase 2 adds `onEditorAction` (or similar) to allow AI tools to dispatch timeline mutations directly — without needing to create a new content version. The `ToolContext` interface is the right place to grow this.

**`IEditorRepository` abstraction.** AI direct-edit tools will go through the same repository interface as SyncService. They just need additional methods: `applyClipOperation`, `reorderTrack`, etc. The abstraction is already in place.

**`SyncService.deriveTimeline` as a base.** When AI assembles a cut, it will call `deriveTimeline` to get the base clips, then apply its assembly decisions on top. This avoids duplicating asset-loading logic.

**Separation of concerns carries forward.** SyncService remains the text sync path. AI direct-edit tools become a new, parallel path. `refreshEditorTimeline` stays the video shot path. Three distinct channels, cleanly separated.

### The Key Design Challenge for Phase 2

The hard problem is conflict resolution when multiple things can edit the same timeline:

- User is trimming shot 3 in the editor
- AI is reordering clips in response to a chat message
- SyncService is syncing a voiceover change from another tool call

Phase 1 solves the simpler version of this (sync vs autosave, autosave wins). Phase 2 needs a richer model — probably operational transforms on individual clip operations, or a command queue with merge semantics. The `source` field is the first building block: it establishes ownership of clips, which determines who wins in a conflict.

See the source code TODOs in `sync.service.ts`, `chat-tools.ts`, and `ai-assembly-tracks.ts` for the specific extension points.
