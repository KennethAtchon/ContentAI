# HLD: Editor as Production Core

**Status:** Design — approved for implementation
**Date:** 2026-03-22
**Context:** [`00-context-and-problems.md`](./00-context-and-problems.md)

---

## Overview

The editor becomes the single production system for all video content. Every asset produced by the platform — video clips, voiceover, music, captions — flows into the editor timeline. The final video is produced exclusively by exporting from the editor. Nothing assembles a video outside of the editor export pipeline.

Today there are two disconnected assembly pipelines. After this rearchitecture there is one.

---

## System Context

```mermaid
graph TD
    Chat["AI Chat\n/studio/generate"]
    AITools["AI Tool Layer\nsave_content / iterate_content\ngenerate_clips / generate_voiceover"]
    Editor["Editor\n/studio/editor"]
    Queue["Queue\n/studio/queue"]
    ClipGen["Clip Generation\nFal.ai / video provider"]
    TTS["Voiceover\nTTS provider"]
    Music["Music Library\nplatform tracks"]
    Export["Export Pipeline\nffmpeg on server"]
    R2["Cloudflare R2\nfile storage"]
    IG["Instagram\nposting"]

    Chat -->|"user prompt"| AITools
    AITools -->|"text content\n(hook, script, caption)"| Editor
    AITools -->|"trigger clips"| ClipGen
    AITools -->|"trigger voiceover"| TTS
    ClipGen -->|"video_clip assets\n→ video track"| Editor
    TTS -->|"voiceover asset\n→ audio track"| Editor
    Music -->|"music asset\n→ music track"| Editor
    Editor -->|"user exports"| Export
    Export -->|"final MP4"| R2
    Export -->|"marks ready"| Queue
    Queue -->|"post"| IG

    style AITools fill:#2563eb,color:#fff,stroke:#2563eb
    style Editor fill:#7c3aed,color:#fff,stroke:#7c3aed
    style Export fill:#7c3aed,color:#fff,stroke:#7c3aed
```

- **AI Tool Layer (blue):** the AI's side-effects. Creates text content, triggers production jobs. Never produces a finished video.
- **Editor (purple):** receives everything, produces the final output. Nothing bypasses it.

---

## The AI Tool Layer

The AI in `/studio/generate` operates through a set of **tools** that have well-defined side-effects. Under this architecture, tools fall into two categories:

### Text tools — create/update `generated_content`
| Tool | What it does | Creates new version? |
|---|---|---|
| `save_content` | Creates a new `generated_content` row (v1) | Always (it's creation) |
| `iterate_content` | Creates a new `generated_content` row (v2+) from the current script | **Yes** — see versioning rules below |

### Production tools — create assets that land on the editor timeline
| Tool | What it does | Creates new version? |
|---|---|---|
| `generate_clips` | Calls `POST /api/video/reel` — generates video clips via Fal.ai, each lands on the **video track** | No |
| `generate_voiceover` | Calls `POST /api/audio/generate-voiceover` — synthesises TTS from `cleanScript`, lands on **audio track** | No |
| `attach_music` | Attaches a track from the music library to the **music track** | No |

> **Captions are not a tool yet.** They will be added to the AI layer in a future phase. When they are, the caption data will land on the **text track** of the editor timeline. For now, captions are generated as part of the editor export pipeline only.

**The production tools do not create new content versions.** They update the assets attached to the *current* version. If you regenerate the voiceover with a different voice, that replaces the existing voiceover asset for the current version — it doesn't create v3.

---

## Versioning Rules

A new content version (`iterate_content` → new `generated_content` row with `parentId`) is created **only when the creative brief changes** — i.e. the text content authored by the AI or user.

### Creates a new version ✅
| Trigger | Why |
|---|---|
| AI rewrites the hook | The hook is the core creative output — a new hook is a new creative direction |
| AI rewrites the script / shot descriptions | Script changes mean different shots, different edit — fundamentally new content |
| AI rewrites the caption or CTA | The caption is part of the deliverable; changing it is a new iteration |
| User explicitly asks AI to "try again" / "iterate" | Direct intent to create an alternative |

### Does NOT create a new version ❌
| Trigger | Why |
|---|---|
| Regenerating video clips (same script, new render) | Production re-run, not a creative change. Assets update in-place on the current version's timeline. |
| Regenerating voiceover (same script, different voice or speed) | A production choice, not a script change. Replaces the audio asset on the current version. |
| Swapping background music | Music is set dressing, not the creative brief. |
| Trimming or reordering clips in the editor | Pure editing — the script hasn't changed. |
| Changing caption style or look | Visual treatment, not content. |
| Exporting | Output action. No content change. |

### Why this boundary?

The `generated_content` version chain represents the **scriptwriting history** — what the AI produced and how it evolved. The editor and its assets represent **production history** — how that script was turned into video.

These are two separate histories. Mixing them (e.g. "regenerating voiceover creates v3") would create confusing version chains where most versions are identical scripts with only a different audio file. The queue's version navigator would show "v1 / v2 / v3" where v2 and v3 are the same words, just different voices.

### Implementation note: strict equality, not fuzzy matching

The `shouldCreateNewVersion` function in the LLD uses **strict string equality** on the text fields. Any string difference — including a single punctuation change — creates a new version. The prose above says "meaningfully changes," but implementation enforces strict equality.

This is intentional. Implementing "meaningful change" detection (diff thresholds, semantic comparison) produces confusing edge cases. Accept that minor text changes create new versions. Version iteration is cheap (the editor rebuilds quickly from placeholders), so the cost is low.

### Consequence for the editor

When a new script version is created:
- A new `generated_content` row exists (v2)
- `POST /api/editor` is called with the new content ID
- The editor project is updated: `generatedContentId → v2`, timeline rebuilt with new placeholder clips from the v2 script, title updated (if `autoTitle`)
- Previous production assets (clips, voiceover) from v1 remain in `content_assets` but **are not automatically carried to v2** — they were produced for the old script. The user generates new clips for the new script.

When only assets change (no new version):
- The asset row is updated/replaced in `content_assets`
- `refreshEditorTimeline` is called
- The editor's existing timeline slot for that asset is updated in-place
- No new `generated_content` row, no queue item change

---

## Core Design Decisions

### Decision 1: Placeholder clips on the video track from day one

When AI generates text content, the editor project is immediately created with **placeholder clips** derived from the script's shot descriptions. These placeholders show what will be on the timeline before real clips exist, giving the user a meaningful layout the moment they open the editor.

When real clips arrive (after clip generation), placeholders are replaced in-place. The timeline structure does not change — only the asset backing each slot.

**Why:** Without this, the editor opens to a blank screen and users have no indication of what will happen. Placeholders make the pipeline visible and give users confidence.

### Decision 2: Clip generation writes to the editor timeline directly

`runReelGeneration` no longer auto-assembles. After each clip is generated, the backend calls `refreshEditorTimeline(contentId, userId)` which updates `edit_projects.tracks` in the database — replacing the matching placeholder with the real clip.

The frontend polls `GET /api/editor/:id` (already happens via React Query). When tracks change, the editor reloads the affected clips. The user sees placeholders replaced by real video in real-time.

**Why:** Decouples "I have raw clips" from "I have a finished video." The editor is where the user decides the cut order, timing, and transitions — not the backend.

### Decision 3: `assembled_video` in `content_assets` is retired

`runAssembleFromExistingClips` and `upsertAssembledAsset` are removed. No code path creates an `assembled_video` record in `content_assets` anymore.

The final video lives exclusively in `export_jobs.outputAssetId` → `assets` table, reached via the export pipeline.

**Why:** Having `assembled_video` in `content_assets` is what causes it to appear as source media in the editor's MediaPanel. It is structurally wrong — the assembled result is not a source ingredient.

### Decision 4: The editor project title tracks the content hook

Auto-created editor projects use the content's `generatedHook` as their title (truncated to 60 chars). A new `autoTitle` boolean column on `edit_projects` tracks whether the title was auto-assigned. If true, it updates when content is iterated. If the user manually renames the project, `autoTitle` is set to `false` and the title is never auto-updated again.

### Decision 5: Export is the only publish gate

The queue's publish path already requires a completed export job. This stays. There is no "assemble and post" shortcut that bypasses the editor.

---

## Components

| Component | Responsibility | Technology |
|---|---|---|
| AI Chat (`/studio/generate`) | Generates text content (hook, script, caption, scene). Triggers clip generation and TTS. Navigates to editor when ready. | React, Hono, Claude AI |
| `buildInitialTimeline` | Bootstraps editor timeline with placeholder clips from script + real assets if they exist | TypeScript, Drizzle |
| `refreshEditorTimeline` | Called after each clip/voiceover is generated. Replaces placeholders with real assets in `edit_projects.tracks` | TypeScript, Drizzle |
| Editor Timeline | Where the user arranges, trims, and orders clips. 4-track model: video, audio, music, text | React, `useReducer` |
| `runExportJob` | Renders the editor timeline to a final MP4 via ffmpeg. The only way to produce a finished video | Bun, ffmpeg |
| Queue | Manages post scheduling. Links to export output for the final video URL | React, Hono, Drizzle |

---

## New Data Flow: Content → Final Video

```mermaid
sequenceDiagram
    participant U as User
    participant Chat as AI Chat
    participant Tools as AI Tool Layer
    participant BE as Backend
    participant FAL as Clip Generator
    participant TTS as TTS Provider
    participant ED as Editor (browser)
    participant FF as ffmpeg

    U->>Chat: "make a reel about morning coffee"
    Chat->>Tools: invoke save_content
    Tools->>BE: INSERT generated_content {hook, script, caption, cleanScript}
    Tools->>BE: INSERT queue_item {status=draft}
    Tools->>BE: POST /api/editor {generatedContentId}
    BE->>BE: buildInitialTimeline → parse script → placeholder clips
    BE->>BE: INSERT edit_projects {tracks=[placeholders], title=hook, autoTitle=true}

    U->>ED: Opens /studio/editor
    ED->>BE: GET /api/editor/:id
    BE-->>ED: Project {tracks: [placeholder-0, placeholder-1, placeholder-2...]}
    Note over ED: Video track: [⬜ Shot 1][⬜ Shot 2][⬜ Shot 3]<br/>Audio track: empty<br/>Music track: empty

    U->>Chat: clicks "Generate Clips"
    Chat->>Tools: invoke generate_clips
    Tools->>BE: POST /api/video/reel {generatedContentId}
    loop For each shot in script
        BE->>FAL: generateVideoClip(shot description)
        FAL-->>BE: r2Key, durationMs
        BE->>BE: INSERT asset + content_asset {role=video_clip, metadata.shotIndex=N}
        BE->>BE: refreshEditorTimeline → replace placeholder-N with real clip
        BE->>BE: UPDATE edit_projects.tracks
    end
    Note over ED: Placeholders replaced in real-time as clips arrive<br/>[🎬 Shot 1][🎬 Shot 2][🎬 Shot 3]

    U->>Chat: clicks "Generate Voiceover"
    Chat->>Tools: invoke generate_voiceover
    Tools->>BE: POST /api/audio/generate-voiceover {contentId, voiceId}
    TTS-->>BE: audio file (MP3)
    BE->>BE: INSERT asset + content_asset {role=voiceover}
    BE->>BE: refreshEditorTimeline → upsert voiceover on audio track
    BE->>BE: UPDATE edit_projects.tracks
    Note over ED: Audio track: [🎙 Voiceover]

    U->>Chat: attaches background music
    Chat->>Tools: invoke attach_music
    Tools->>BE: POST /api/audio/attach-music {contentId, trackId}
    BE->>BE: INSERT content_asset {role=background_music}
    BE->>BE: refreshEditorTimeline → upsert music on music track
    Note over ED: Music track: [🎵 Track name]

    Note over ED: Timeline complete:<br/>Video: [Shot1][Shot2][Shot3]<br/>Audio: [Voiceover────────]<br/>Music: [BG Music──────]

    U->>ED: Trims clips, reorders, adjusts volumes
    U->>ED: Clicks Export
    ED->>BE: POST /api/editor/:id/export

    BE->>FF: ffmpeg filtergraph<br/>(trim · xfade · captions · amix)
    FF-->>BE: final.mp4
    BE->>BE: INSERT asset {type=assembled_video, source=export}
    BE->>BE: UPDATE export_jobs {status=done, outputAssetId=...}
    BE-->>ED: {exportJobId, status=done, url=signed_r2_url}

    U->>ED: Clicks Publish
    BE->>BE: UPDATE queue_item {status=ready}
    Note over BE: Queue links to export output for posting
```

---

## Data Flow: Script Version Iteration (new content version)

Triggered when the AI rewrites the hook, script, or caption via `iterate_content`.

```mermaid
sequenceDiagram
    participant U as User
    participant Chat as AI Chat
    participant Tools as AI Tool Layer
    participant BE as Backend
    participant ED as Editor

    U->>Chat: "make the hook more punchy"
    Chat->>Tools: invoke iterate_content
    Tools->>BE: INSERT generated_content {v2, parentId=v1.id, new hook+script}
    Tools->>BE: UPDATE queue_item → generatedContentId=v2

    BE->>BE: POST /api/editor {generatedContentId: v2.id}
    BE->>BE: Walk parent_id chain → root = v1.id
    BE->>BE: Find existing edit_project (was created for v1)
    BE->>BE: buildInitialTimeline(v2.id) → new placeholder clips from v2 script
    BE->>BE: UPDATE edit_projects {generatedContentId=v2, tracks=new placeholders, title=v2.hook if autoTitle}

    ED->>BE: React Query refetch (updatedAt changed)
    BE-->>ED: Project with v2 placeholder timeline
    Note over ED: Editor now shows v2 script structure<br/>Previous clips are gone — script changed<br/>User generates new clips for v2
```

## Data Flow: Asset Replacement (same version, no new content row)

Triggered when the user regenerates clips, regenerates voiceover with a different voice, or swaps music.

```mermaid
sequenceDiagram
    participant U as User
    participant Chat as AI Chat
    participant Tools as AI Tool Layer
    participant BE as Backend
    participant FAL as Clip Generator
    participant ED as Editor

    U->>Chat: "regenerate with a different voice"
    Chat->>Tools: invoke generate_voiceover {voiceId: new_voice}
    Tools->>BE: POST /api/audio/generate-voiceover {contentId: v2.id, voiceId}
    Note over BE: contentId is STILL v2 — no new version created

    BE->>BE: DELETE old content_asset {role=voiceover} for v2
    BE->>BE: INSERT new asset + content_asset {role=voiceover}
    BE->>BE: refreshEditorTimeline(v2.id) → replace voiceover clip on audio track
    BE->>BE: UPDATE edit_projects.tracks

    ED->>BE: React Query refetch
    BE-->>ED: Updated project with new voiceover asset
    Note over ED: Audio track swapped silently<br/>Video track unchanged<br/>Version number unchanged (still v2)
```

---

## What Is Removed

| Removed | Replaced By |
|---|---|
| `runAssembleFromExistingClips` | Nothing — assembly only happens in `runExportJob` |
| `upsertAssembledAsset` (writes to `content_assets`) | `export_jobs.outputAssetId` is the final video pointer |
| `mixAssemblyAudio` | `runExportJob`'s ffmpeg `amix` filtergraph |
| `createAssCaptions` (simple ASS generator) | `generateASS` in `export/ass-generator.ts` (the canonical renderer) |
| Auto-assembly after clip generation | `refreshEditorTimeline` places clips on the editor timeline |
| `assembled_video` in `content_assets` | Never created. MediaPanel shows only real source assets. Existing rows excluded by filter and cleaned up by data migration (Phase 4). |
| `assemble_video` AI chat tool in `chat-tools.ts` | Removed from AI tool list. **Must be retired in Phase 4 atomically with `runAssembleFromExistingClips` deletion** — if the function is deleted while the tool definition exists, invoking it from chat crashes. |
| `VideoWorkspacePanel` "Assemble" / "Generate Reel" button producing a finished video | Button renamed "Generate Clips". Result is clips on timeline, not a finished video |
| `POST /api/video/assemble` endpoint | Retired |

---

## Out of Scope

- Caption system redesign (covered in `02-captions.md`)
- Effects and transitions (covered in `03-effects-transitions.md`)
- Real-time multiplayer editing
- Mobile editor support
- Undo/redo across sessions

---

## Resolved Design Decisions

These were open questions in earlier drafts, now resolved:

### Per-placeholder loading states (Required, not optional)

Each placeholder slot must show one of three states:
- **Queued** — shot is in the generation queue, not yet started
- **Generating...** — Fal.ai is currently rendering this shot (spinner)
- **Failed** — generation failed for this shot; user can manually replace the slot

The existing `use-video-job.ts` hook already polls per-shot progress from the Redis job record at 2-second intervals. Wire that existing progress data into each placeholder's status. Do not ship placeholder slots without these states — without them, users cannot tell if generation is progressing or stuck.

The `placeholderStatus` field (`"pending" | "generating" | "failed"`) is stored on the placeholder clip in JSONB tracks. The clip generation handler updates this via `refreshEditorTimeline` before a clip lands (to set `generating`) and on failure (to set `failed`).

### Stable placeholder IDs (Resolved)

`placeholderShotIndex` is the stable identifier for matching placeholders to real clips. It is set at creation and never changes — it is the shot's index in the script, not its position in the clips array. If the user reorders placeholder slots in the UI, the `placeholderShotIndex` values stay attached to each slot, so `refreshEditorTimeline` still matches the correct placeholder when the real clip arrives.

### Auto-scroll on clip arrival

**Decision: No auto-scroll.** The editor should not move the user's viewport when a clip lands. If the user has scrolled to a specific area of the timeline, snapping them elsewhere is disorienting. The placeholder-to-clip transition is visual (the slot fills in); that is sufficient feedback.

### User confirmation before timeline rebuild on script iteration

When `iterate_content` creates a new script version and `POST /api/editor` rebuilds the timeline with new placeholders, the frontend must show a confirmation before navigating away from or refreshing the existing editor state:

> "The script has been updated. Your timeline will be reset to match the new shot layout. Previous clips remain in the version history."

This prevents an accidental "try again" from silently discarding 2+ minutes of generated clips.
