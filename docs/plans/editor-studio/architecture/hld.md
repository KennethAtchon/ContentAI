# ContentAI Editor Studio — High-Level Design (HLD)

**Author:** Engineering
**Date:** 2026-03-24
**Status:** Draft
**Based on:** pm-product-spec.md, unified-content-editor-plan.md, 01-05 spec docs

---

## 1. System Overview

The editor studio spans three surfaces that must behave as one coherent system:

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   AI Workspace      │    │     Queue Dashboard   │    │   Manual Editor     │
│ /studio/generate    │    │     /studio/queue     │    │  /studio/editor     │
│                     │    │                      │    │                     │
│ Chat → Generate →   │    │  Status tracker for  │    │  Timeline editing,  │
│ Assemble →          │◄──►│  all content items   │◄──►│  export, publish    │
│ Open in Editor      │    │  with live editor    │    │                     │
│                     │    │  + export state      │    │                     │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
          │                            │                           │
          └────────────────────────────┼───────────────────────────┘
                                       │
                              ┌────────▼────────┐
                              │   Backend API   │
                              │  (Hono + Drizzle│
                              │  + PostgreSQL)  │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                   │
             ┌──────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
             │  PostgreSQL  │  │  Cloudflare  │  │   Redis      │
             │  (primary   │  │     R2       │  │  (rate limit │
             │   state)    │  │  (assets)    │  │   cache)     │
             └─────────────┘  └──────────────┘  └──────────────┘
```

### Canonical Data Flow

```
User generates content in AI Workspace
         │
         ▼
generated_content row created
         │
         ▼
Assets generated: video_clip(s), voiceover, music
         │
         ▼
User clicks "Open in Editor" from Queue
         │
         ▼
POST /api/editor (upsert) → edit_project created with pre-built timeline
         │ (uses buildInitialTimeline — single canonical function)
         ▼
Editor opens → user refines timeline
         │
         ▼
POST /api/editor/:id/export → ffmpeg render → asset stored in R2
         │
         ▼
POST /api/editor/:id/publish → edit_project.status = "published"
         │
         ▼
Queue updated live via JOIN on edit_projects + export_jobs
```

---

## 2. Architectural Decisions

### 2.1 One Timeline Builder, Two Callers

**Decision:** `backend/src/routes/editor/services/build-initial-timeline.ts` is the single implementation for converting assets to timeline tracks. Both the video assembly route and the editor creation route call it. The separate `_buildInitialTimeline` and `_convertTimelineToEditorTracks` functions in `video/index.ts` are deleted.

**Why:** Schema drift between two parallel builders caused the "wrong track" bugs. One builder, one schema.

### 2.2 Assembly Creates an Editor Project, Not a Final Video

**Decision:** `POST /api/video/assemble` no longer runs ffmpeg. Its job is to upsert an `edit_project` with the initial timeline and return the editor URL. The ffmpeg render happens only when the user explicitly exports from the editor.

**Why:** Users need a review step. The old black-box assembly produced unreviewed output. The editor is the review layer.

### 2.3 Browser Preview + Server-Side Export

**Decision:** Preview = stacked `<video>` elements + `<canvas>` overlay for captions. Export = server-side ffmpeg. No WebCodecs.

**Why:** WebCodecs adds frontend complexity and export quality parity with ffmpeg is hard. The CapCut Web / Descript model (browser preview, server render) is proven at scale.

### 2.4 useReducer Stays, Not Zustand

**Decision:** The existing `useReducer` + undo/redo pattern in `useEditorStore.ts` is kept as-is. No migration to Zustand.

**Why:** The reducer pattern gives deterministic undo/redo semantics that Zustand requires extra libraries to match. The existing implementation works.

### 2.5 JSONB Timeline in PostgreSQL

**Decision:** `edit_project.tracks` remains a JSONB column. No relational clip table.

**Why:** Reels have 5-20 clips typically. The JSONB blob is small (<50KB), atomic, and fast. Relational clip tables add join overhead and migration complexity for no benefit at current scale.

### 2.6 Caption Rendering: Canvas Overlay + ASS Export

**Decision:** Preview uses a `<canvas>` overlay on the preview area. Export uses ASS subtitle rendering via ffmpeg `ass` filter.

**Why:** Canvas gives frame-accurate rendering without a DOM-per-word approach. ASS gives rich styling (outlines, colors, karaoke highlights) that `drawtext` cannot match.

### 2.7 Waveform Generation: Web Audio API, Client-Side, Cached

**Decision:** Waveforms are decoded from audio URLs using Web Audio API in the browser, cached per asset ID in a module-level Map. No server-side precomputation.

**Why:** The R2 URLs for audio assets are already accessible cross-origin (signed URLs). Decoding client-side avoids a server round-trip and caching avoids re-decoding on zoom changes.

### 2.8 Multiple Video Tracks: Additive Track Lanes

**Decision:** The `video` track becomes a list of track lanes rather than a single track. The schema change is backward-compatible: existing single-track data is treated as `lanes[0]`.

**Why:** Collision prevention requires a place to put the second clip. Multi-lane video is the standard NLE model.

---

## 3. Component Architecture

### 3.1 Frontend Feature Map

```
src/features/editor/
├── components/
│   ├── EditorLayout.tsx           — Main layout shell
│   ├── EditorToolbar.tsx          — Split, snap toggle, aspect ratio, publish
│   ├── PreviewArea.tsx            — Stacked <video> + <canvas> caption overlay
│   ├── MediaPanel.tsx             — Assets, Effects tab (now wired), Caption tab
│   ├── Inspector.tsx              — Clip inspector (now includes Caption section)
│   └── timeline/
│       ├── Timeline.tsx           — Ruler, tracks, playhead
│       ├── TrackLane.tsx          — Single video/audio/caption track row
│       ├── TimelineClip.tsx       — Clip block with drag, trim, snap, waveform
│       ├── WaveformRenderer.tsx   — SVG waveform inside audio clips
│       ├── SnapLine.tsx           — Vertical snap indicator
│       ├── TransitionHandle.tsx   — Diamond icon between clips
│       └── ShotOrderPanel.tsx     — Drag-reorder shot thumbnails panel
├── hooks/
│   ├── useEditorStore.ts          — useReducer state + actions
│   ├── useWaveformCache.ts        — Web Audio decode + cache context
│   ├── useSnapTargets.ts          — Compute snap points from all clip edges
│   ├── useCaptionRenderer.ts      — Canvas draw loop for captions
│   └── useAssemblePreset.ts       — Apply Standard/FastCut/Cinematic preset
└── types/
    └── editor.ts                  — All TypeScript types (Track, Clip, Transition, Caption*)
```

### 3.2 Backend Route Map

```
backend/src/routes/
├── editor/
│   ├── index.ts                   — CRUD + export + publish + new-draft endpoints
│   └── services/
│       ├── build-initial-timeline.ts   — SINGLE canonical timeline builder
│       ├── generate-ass-subtitles.ts   — Caption → ASS format conversion
│       ├── build-ffmpeg-filtergraph.ts — Timeline → ffmpeg filter string
│       └── apply-assembly-preset.ts   — Standard/FastCut/Cinematic modifiers
├── video/
│   └── index.ts                   — Assemble handler: now upserts edit_project only
├── captions/
│   └── index.ts                   — POST /transcribe (Whisper), GET /:id
└── queue/
    └── index.ts                   — Pipeline stage query now JOINs edit_projects
```

---

## 4. Data Model Changes

### 4.1 Schema Additions (new columns / tables)

```
edit_projects table additions:
  status          TEXT NOT NULL DEFAULT 'draft'        -- 'draft' | 'published'
  published_at    TIMESTAMP
  parent_project_id TEXT REFERENCES edit_projects(id)
  aspect_ratio    TEXT NOT NULL DEFAULT '9:16'         -- '9:16' | '16:9' | '1:1'

Unique index:
  UNIQUE (user_id, generated_content_id) WHERE generated_content_id IS NOT NULL

generated_content table changes:
  prompt          TEXT (relaxed to nullable — supports editor-originated content)

New table: captions
  id              TEXT PK
  user_id         TEXT NOT NULL REFERENCES users(id)
  asset_id        TEXT NOT NULL REFERENCES assets(id)
  language        TEXT NOT NULL DEFAULT 'en'
  words           JSONB NOT NULL   -- Array<{ word, start, end }>
  full_text       TEXT NOT NULL
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
  INDEX captions_asset_idx ON captions(asset_id)
```

### 4.2 Timeline JSONB Shape Changes

**Track type extension (multi-lane video):**
```typescript
// Before (single video track)
{ type: "video", clips: Clip[], muted: boolean, locked: boolean }

// After (multi-lane)
{ type: "video", lanes: TrackLane[], muted: boolean, locked: boolean }
// where TrackLane = { id: string, name: string, clips: Clip[], locked: boolean }
// Backward-compat: if 'clips' key present (old format), treat as lanes[0]
```

**Clip type additions:**
```typescript
// Caption fields added to Clip
captionId?: string
captionWords?: CaptionWord[]        // { word, startMs, endMs, edited? }
captionStylePreset?: CaptionPresetId
captionGroupSize?: number

// Transition (per track)
transitions?: Transition[]           // { id, type, durationMs, clipAId, clipBId }

// Speed ramps (deferred, but type reserved)
speedRamps?: SpeedRamp[]
```

---

## 5. Key API Changes

| Endpoint | Change | Reason |
|---|---|---|
| `POST /api/video/assemble` | Remove ffmpeg. Upsert edit_project, return `{ editorProjectId, redirect }` | Assembly → editor, not direct video |
| `POST /api/editor` | Upsert behavior + auto-build timeline | One project per content |
| `POST /api/editor/:id/publish` | New endpoint. Sets status='published', verifies export exists | Publish/lock model |
| `POST /api/editor/:id/new-draft` | New endpoint. Duplicates project to new draft | Iteration on published |
| `PATCH /api/editor/:id` | Returns 403 if status='published' | Enforce read-only on published |
| `POST /api/captions/transcribe` | New endpoint. Whisper transcription, returns word timestamps | Auto-captions |
| `GET /api/queue` | LEFT JOIN edit_projects + export_jobs | Live queue state |
| `GET /api/editor` | LEFT JOIN generated_content for hook text | Identifiable project cards |

---

## 6. Fix Map: Bugs to Architecture Changes

| Bug (from TODO.md / PM spec) | Root Cause | Architectural Fix |
|---|---|---|
| "Open AI Chat" button does nothing | Navigation not wired to correct chat session | Route to `/studio/generate?contentId=X`, look up `chat_message.generatedContentId` to find the session |
| Text clip lands on video track | `_buildInitialTimeline` in video route maps all non-video assets to video track | Delete dual-builder; `buildInitialTimeline` in editor services correctly maps text instructions to text track |
| Clips out of order | Assembly does not sort by `shotIndex` | `buildInitialTimeline` orders by `shotIndex` first, then `createdAt` |
| Video stacking (same startMs) | Clips placed without sequencing | `buildInitialTimeline` accumulates `videoPosition` — each clip starts where previous ends |
| Enabled/Mute button offscreen | CSS overflow issue in Inspector panel | Fix Inspector panel overflow; ensure toggle controls are within scrollable container |
| No waveforms | Not implemented | Add `WaveformRenderer` + `useWaveformCache` |
| Multiple video layers needed | Single-track model | Multi-lane video track schema + UI |

---

## 7. Dependency and Phase Map

```
Phase 0 (P0 bugs)
  └── Fix: dual timeline builder → single build-initial-timeline
  └── Fix: clip ordering by shotIndex
  └── Fix: Inspector CSS overflow for enabled/mute
  └── Fix: AI chat navigation (route wiring only)
  └── Add: WaveformRenderer

Phase 1 (Data Layer)
  ├── Depends on: Phase 0 (single timeline builder)
  └── Schema: unique constraint, status/publishedAt/parentProjectId, nullable prompt
  └── Backend: upsert POST /api/editor, publish endpoint, new-draft endpoint
  └── Backend: queue LEFT JOINs edit_projects
  └── Frontend: remove localStorage job tracking
  └── Frontend: queue shows "Open in Editor" + live editor/export state

Phase 2 (Editor Core)
  ├── Depends on: Phase 1 (project model in place)
  └── 9:16 aspect ratio (schema + preview + ffmpeg)
  └── Split clip (reducer action + keyboard shortcut)
  └── Clip snapping (snap targets + snap line)
  └── Drag-and-drop from media panel
  └── Clip duplication
  └── Multi-lane video track

Phase 3 (Captions)
  ├── Depends on: Phase 2 (9:16 preview, text track working)
  └── captions table + Whisper endpoint
  └── Caption data model in Clip type
  └── Caption tab redesign (rename + 5 theme presets)
  └── Inspector caption section
  └── Canvas caption preview
  └── ASS export

Phase 4 (Assembly System)
  ├── Depends on: Phase 1 + Phase 3
  └── Assembly → edit_project (remove direct ffmpeg from /api/video/assemble)
  └── Shot Order panel
  └── Single shot regeneration in editor
  └── Assembly presets (Standard, Fast Cut, Cinematic)

Phase 5 (Effects + Transitions)
  ├── Depends on: Phase 2
  └── Wire Effects tab presets to UPDATE_CLIP
  └── Transition data model + Timeline UI
  └── CSS transition preview approximation
  └── ffmpeg xfade filtergraph
```

---

## 8. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Editor initial load time | <3s from navigation to first video frame visible |
| Auto-save latency | 2s debounce; write <500ms |
| Caption transcription latency | <8s for a 60s voiceover (Whisper API) |
| Export start latency | <2s from button click to job queued |
| Waveform compute time | <3s for a 60s audio file on modern hardware |
| Timeline frame rate | 60fps during playback and drag operations |
| Snap calculation | <1ms per frame (sorted array binary search, O(log n)) |

---

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Multi-lane video track breaks existing JSONB | High | Backward-compat reader: if `clips` key present (old shape), treat as `lanes[0]` |
| ASS font availability on export server | High | Bundle Inter + Poppins + Montserrat on backend; reference by absolute path |
| Whisper API rate limits at scale | Medium | Per-user daily limit (50 transcriptions/day Pro), queue with Redis |
| ffmpeg `xfade` requires matching clip resolution | High | Normalize all clips to target resolution before xfade (already partially done with `scale` + `pad` filters) |
| Web Audio API unavailable in some environments | Low | Graceful fallback: flat line waveform with loading shimmer |
| Assembly endpoint behavior change breaks frontend | Medium | Feature flag the new behavior; old endpoint returns deprecation header for 30 days |
