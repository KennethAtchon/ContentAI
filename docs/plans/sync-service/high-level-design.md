# SyncService — High Level Design

This document is **planning-only** and will be removed with the rest of `docs/plans/sync-service/`. The shipped code must embed the same ideas in comments (firing paths, constraints, non-goals) so nothing here is required to maintain the system.

## The Problem

ReelStudio has two systems that share data but have no live connection:

**Chat/AI system** — the user talks to Claude, which generates and iterates `generated_content` rows (hook, script, voiceover, caption). The AI also triggers video generation jobs that produce `content_asset` rows.

**Editor system** — a timeline editor backed by `edit_projects` rows. Each project has a `tracks` JSON blob containing clips, each clip referencing a `content_asset` by `assetId`.

The problem: **these two systems diverge.** When the AI iterates content — new hook, new voiceover, new caption — the editor project still shows the old data. The editor has no mechanism to learn that content changed. The only sync point was project creation (`buildInitialTimeline`), which ran once and never again.

---

## The Two Update Paths

There are two fundamentally different ways the editor gets updated from content, and they cannot be merged into one:

### Path 1: Text content sync (SyncService)

Triggered by: `save_content`, `iterate_content`, `edit_content_field`

These tools run synchronously inside the AI chat stream. When they complete, we know exactly what content changed. We can re-derive the full editor timeline immediately and write it to the DB before the SSE event fires to the frontend.

This path handles: hook/caption text changes, new voiceover assets, new background music, caption transcription updates.

### Path 2: Video shot filling (refreshEditorTimeline)

Triggered by: `generate_video_reel`, `regenerate_video_shot` (async background jobs)

Video generation takes seconds to minutes per shot. The editor needs to update progressively as each shot completes — not all at once at the end. The timeline has placeholder clips that get filled one by one. This requires a placeholder-aware merge that SyncService cannot do (SyncService only knows about assets that already exist in the DB at call time).

This path handles: filling placeholders with real video clips, marking shots as generating/failed, replacing regenerated shots.

**These two paths are separate and must remain separate.** SyncService handles text content. `refreshEditorTimeline` handles video. Never the other way around.

---

## Key Design Decisions

### 1. Full re-derive, not incremental patch

The old approach (`merge-new-assets.ts`) tracked which assets had been merged via `mergedAssetIds` and only patched new ones in. This created state that drifted — if an asset was removed or replaced, the old clip stayed.

SyncService throws away that approach. `deriveTimeline` rebuilds the entire set of content-derived clips from scratch on every sync. User adjustments (trims, positions) are then merged back in from the existing project. The result is always consistent with the current content state.

### 2. Editor is source of truth in conflicts

SyncService never bumps any version counter. It writes tracks and denormalized text fields — that's it. If the editor autosaves after sync, the editor's payload wins on whatever fields it sends. This is intentional: the user's manual edits are never discarded by AI activity.

The practical ordering is: sync writes → SSE fires → frontend invalidates cache → editor re-fetches → `MERGE_TRACKS_FROM_SERVER` → autosave debounce fires. By the time autosave fires, local state already reflects the synced content.

### 3. `source` field distinguishes user vs AI clips

Every clip gets a `source` field: `"content"` for AI-derived clips, `"user"` for manually added clips. This is how `mergeTrackSets` knows what to replace and what to keep. Without it, re-sync would have to guess which clips were user-added.

Old clips without a `source` field are treated as `"content"` (they predate this change and were all content-derived anyway).

### 4. Video track preservation on iterate

When `iterate_content` creates a new content version, that version has no video assets yet. `deriveTimeline` would return an empty video track. Rather than clearing the editor's video track (which would be destructive and confusing), SyncService preserves the existing video clips unchanged when the fresh video track is empty. The user still has a working video; it just doesn't match the new script until they regenerate.

### 5. Caption transcription is idempotent

`CaptionsService.transcribeAsset` checks for an existing caption doc by `assetId` before calling Whisper. Same voiceover asset → same `captionDocId` returned → user caption style edits survive re-sync. Re-syncing never triggers a redundant Whisper call.

---

## Data Model Relationships

```
generated_content (N versions, linked by parentId)
    │
    ├── content_assets (video_clip, voiceover, background_music)
    │       └── assets (r2Key, durationMs, metadata)
    │
    └── edit_projects (generatedContentId → generated_content.id)
            └── tracks (JSON) → clips → assetId → assets.id
```

`edit_projects.generatedContentId` is advanced to the latest content version by each sync. The ancestor chain (`resolveContentAncestorChainIds`) lets SyncService find editor projects linked to any version in the lineage.

---

## What Was Deleted

| Old code | Why it existed | Why it's gone |
|---|---|---|
| `build-initial-timeline.ts` | Built tracks once on project creation | Replaced by `SyncService.deriveTimeline` |
| `merge-new-assets.ts` | Incremental patch for new assets | Replaced by full re-derive in `syncLinkedProjects` |
| `mergedAssetIds` column | Tracked which assets had been merged | No longer needed — full re-derive on every sync |
| `syncNewAssetsIntoProject()` on EditorService | Called `mergeNewAssetsIntoProject` | Deleted with it |

`refreshEditorTimeline` on `IEditorRepository` is **not** deleted — it is still used by the video job runner for placeholder-aware shot filling.
