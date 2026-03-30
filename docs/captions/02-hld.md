# High-Level Design: Caption Engine v2

This document describes the architecture of the new caption system. It defines the system's layers, components, data flows, and integration points. Implementation details (types, function signatures, SQL) are in the LLD.

---

## Design Goals

1. **Clean separation of concerns** — transcription data, style definitions, and rendering are independent systems that communicate through typed contracts.
2. **Declarative animation** — animations are JSON data, not code branches. Adding a new animation requires no changes to the renderer.
3. **Trustworthy preview/export contract** — Preview and export resolve the same caption document and source range. When export cannot reproduce a visual effect exactly, the downgrade is explicit in the preset metadata and UI.
4. **Extensible presets** — New presets can be added by writing a JSON object. No renderer changes required.
5. **Multi-line word wrap** — Captions wrap correctly at any font size on any canvas dimension.
6. **Auto-transcription** — Captions are generated automatically when a voiceover is added to the timeline, not on manual button press.
7. **Explicit v2 language scope** — v2 is English-only. Tokenization, layout assumptions, QA, and preset tuning are only guaranteed for English transcripts.

---

## System Layers

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│   CAPTION ENGINE v2 — SYSTEM LAYERS                                        │
│                                                                            │
├──────────────────────────────────────────────────────────────────────────  │
│                                                                            │
│  ┌─────────────────────┐                                                   │
│  │  LAYER 1: DATA      │  What was spoken and when.                        │
│  │                     │                                                   │
│  │  CaptionDoc         │  Persisted in PostgreSQL (caption_doc table).     │
│  │  ─────────────      │  Contains word-level timestamps from Whisper.     │
│  │  id                 │  Created once per (user, asset) pair.             │
│  │  assetId            │  Source: "whisper" | "manual" | "import"          │
│  │  words: Word[]      │                                                   │
│  │  fullText           │                                                   │
│  │  source             │                                                   │
│  └──────────┬──────────┘                                                   │
│             │                                                              │
│             │  (feeds into)                                                │
│             ▼                                                              │
│  ┌─────────────────────┐                                                   │
│  │  LAYER 2: GROUPING  │  How words are assembled into display units.      │
│  │                     │                                                   │
│  │  PageBuilder        │  Pure function. Takes words[] + groupingMs.       │
│  │  ─────────────      │  Outputs CaptionPage[].                           │
│  │  buildPages()       │  Each page has a tokens[] with word timing.       │
│  │                     │  Runs frontend (preview) + backend (export).      │
│  └──────────┬──────────┘                                                   │
│             │                                                              │
│             │  (feeds into)                                                │
│             ▼                                                              │
│  ┌─────────────────────┐                                                   │
│  │  LAYER 3: LAYOUT    │  Where each word sits on the canvas.              │
│  │                     │                                                   │
│  │  LayoutEngine       │  Pure function. Takes page + preset + canvasSize. │
│  │  ─────────────      │  Outputs CaptionLayout (word positions).          │
│  │  computeLayout()    │  Handles multi-line word wrap.                    │
│  │                     │  Computed once per page change, cached.           │
│  └──────────┬──────────┘                                                   │
│             │                                                              │
│             │  (feeds into)                                                │
│             ▼                                                              │
│  ┌─────────────────────┐                                                   │
│  │  LAYER 4: RENDERING │  What pixels appear on screen.                    │
│  │                     │                                                   │
│  │  CaptionRenderer    │  Pure function. No state, no side effects.        │
│  │  ─────────────      │  Takes (ctx, layout, timeMs, preset).             │
│  │  renderFrame()      │  Evaluates animations for current timeMs.         │
│  │                     │  Draws layers back-to-front per word/line.        │
│  │                     │  Ready for OffscreenCanvas worker in future.      │
│  └──────────┬──────────┘                                                   │
│             │                                                              │
│   ┌─────────┴──────────┐                                                   │
│   │   EXPORT PATH      │                                                   │
│   │                    │                                                   │
│   │  ASSExporter       │  Server-side. Takes pages + preset.               │
│   │  ─────────────     │  Generates ASS subtitle file for FFmpeg.          │
│   │  generateASS()     │  Derives style from canonical preset defs.        │
│   │                    │  Explicit exportMode per preset.                  │
│   └────────────────────┘                                                   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND: features/editor/caption/                                        │
│                                                                            │
│  types.ts            — Caption-specific renderer/layout/preset types       │
│                        (timeline clip shapes stay in existing editor types)│
│                                                                            │
│  presets.ts          — 10 built-in TextPreset definitions (JSON objects)   │
│                        getPreset(id), BUILTIN_PRESETS                      │
│                                                                            │
│  page-builder.ts     — buildPages(words, groupingMs): CaptionPage[]        │
│                        Pure function, no imports, fully testable           │
│                                                                            │
│  layout-engine.ts    — computeLayout(page, preset, canvasW, canvasH)       │
│                        Returns CaptionLayout with word positions           │
│                        Handles multi-line word wrap                        │
│                                                                            │
│  renderer.ts         — renderFrame(ctx, layout, timeMs, preset)            │
│                        Pure function. Evaluates easing, draws layers.      │
│                        No React, no hooks, no side effects                 │
│                                                                            │
│  font-loader.ts      — FontLoader class                                    │
│                        Registers FontFace objects, exposes ready promise   │
│                                                                            │
│  easing.ts           — evaluate(fn: EasingFunction, t: number): number     │
│                        linear, easeIn, easeOut, cubicBezier, spring        │
│                                                                            │
│  hooks/                                                                    │
│    useTranscription.ts   — useMutation via useAuthenticatedFetch           │
│    useCaptionDoc.ts      — useQuery: GET /api/captions/doc/:captionDocId   │
│    useUpdateCaptionDoc.ts — useMutation via useAuthenticatedFetch          │
│    useCaptionCanvas.ts   — orchestrates canvas ref + rAF + renderer        │
│                                                                            │
│  components/                                                               │
│    CaptionPresetPicker.tsx   — Preset grid with live preview thumbnails    │
│    CaptionStylePanel.tsx     — Inspector panel (replaces mixed panel)      │
│    CaptionTranscriptEditor.tsx — Transcript correction + timing editor     │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│  BACKEND: src/domain/editor/captions/  (new subfolder)                     │
│                                                                            │
│  page-builder.ts     — Same buildPages() logic, TypeScript, no browser API │
│                                                                            │
│  preset-registry.ts  — Server-side preset registry (mirrors frontend)      │
│                        Same IDs, same exportMode definitions               │
│                                                                            │
│  src/domain/editor/export/ass-exporter.ts  (replaces ass-generator.ts)    │
│    generateASS(pages, preset, resolution)                                  │
│    Derives style from canonical TextPreset                                 │
│    cssToASS(), msToASSTime() utilities                                     │
│                                                                            │
│  src/domain/editor/captions.service.ts  (rewritten)                        │
│    transcribeAsset() — Whisper integration, idempotency, DB insert         │
│    createManual()    — Create CaptionDoc from raw word data (new)          │
│    getCaptionDoc()   — Fetch by captionDocId                               │
│    updateCaptionDoc() — Persist transcript corrections                     │
│                                                                            │
│  src/domain/editor/captions.repository.ts  (updated)                       │
│    DB queries against the renamed caption_doc table                        │
│                                                                            │
│  src/routes/editor/captions.ts  (thin route, mostly unchanged)             │
│    POST /api/captions/transcribe — delegates to captions.service           │
│    GET  /api/captions/doc/:captionDocId — exact doc lookup                 │
│    GET  /api/captions/:assetId  — asset-level lookup/status                │
│    PATCH /api/captions/doc/:captionDocId — transcript correction           │
│    POST /api/captions/manual    — new, delegates to captions.service       │
│    Validation schemas live in domain/editor/editor.schemas.ts              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Preview Path

```
User opens editor
       │
       ▼
CaptionClip loaded from DB composition
  (captionDocId, sourceStartMs, sourceEndMs, stylePresetId, styleOverrides, groupingMs)
       │
       ▼
useCaptionDoc(captionDocId) → GET /api/captions/doc/:captionDocId → CaptionDoc
       │
       ▼
sliceTokens(doc.words, sourceStartMs, sourceEndMs) → buildPages(tokens, captionClip.groupingMs) → CaptionPage[]
       │
       ▼
[On each animation frame]
  1. Find active page (binarySearch by timeMs)
  2. If page changed: computeLayout(page, preset, canvasW, canvasH) → CaptionLayout
  3. renderFrame(ctx, layout, relativeMs, preset) → paints canvas
       │
       ▼
Canvas overlay renders in PreviewArea (unchanged mount point)
```

---

## Data Flow: Export Path

```
Export job triggered
       │
       ▼
Load composition from DB
  → filter CaptionClips from text track
       │
       ▼
For each CaptionClip:
  1. Load CaptionDoc from DB (captionDocId)
  2. Slice tokens to clip source window (sourceStartMs/sourceEndMs)
  3. Resolve preset (stylePresetId) from preset-registry
  4. Apply styleOverrides to preset
  5. buildPages(tokens, captionClip.groupingMs) → CaptionPage[]
  6. generateASS(pages, resolvedPreset, resolution, clipStartMs)
  7. Write .ass file to /tmp
  8. Inject ass= FFmpeg filter into pipeline
       │
       ▼
FFmpeg renders video with burned-in captions
```

---

## Timeline Integration

The new `CaptionClip` is a subtype of the timeline clip — it coexists with text/title clips on the text track but has its own discriminator.

```
Text Track
  ├── TitleClip  (type: "title")   — static text overlays
  └── CaptionClip (type: "caption") — word-timed animated captions
```

In the DB composition JSON, the text track may contain both types. The editor reducer handles them differently. The renderer checks `clip.type` before calling the caption renderer.

`TitleClip` and `CaptionClip` are intentionally different clip types because their behavior and data needs differ. A `TitleClip` is authored static text. A `CaptionClip` is transcript-driven timed text backed by a `CaptionDoc`. They may still share the same text styling primitives — typography, fill, stroke, shadow, background, positioning, and preset resolution — but only `CaptionClip` participates in word grouping, active-word timing, and caption-specific export behavior.

**This is the key architectural change:** `type: "caption"` clips are no longer text clips with optional caption fields. They are a distinct clip type with their own data shape.

---

## Preset Resolution

Presets are resolved client-side and server-side from the same canonical list. The resolution order:

1. Look up `stylePresetId` in `BUILTIN_PRESETS`
2. If not found, use `BUILTIN_PRESETS[0]` (the default)
3. Apply `styleOverrides` on top of the resolved preset

This means presets are never stored in the DB — only the `stylePresetId` string is stored. The full preset definition lives in the codebase.

The preset/style system is not caption-exclusive. The same visual definition model can be reused by other text-based clip types, including `TitleClip`, as long as those clips only consume the styling/layout fields they need. Caption-specific behavior (`groupingMs`, `wordActivation`, export hints for timed captions) remains meaningful only for `CaptionClip`.

---

## Auto-Transcription Flow

The current system requires the user to click "Generate Text for Clip" in the Inspector. The new system triggers automatically and is idempotent per voiceover clip:

```
Voiceover clip added to audio track
       │
       ▼
Editor detects new clip with type: "voiceover"
       │
       ▼
Create/update caption job state for that voiceover clip
  idle → transcribing → ready | failed | stale
       │
       ▼
Auto-trigger: POST /api/captions/transcribe (assetId)
       │
       ▼
On success: dispatch ADD_CAPTION_CLIP with returned captionDocId
  → Creates or replaces the linked CaptionClip for that voiceover clip
  → Stores originVoiceoverClipId on the CaptionClip
  → Stores sourceStartMs/sourceEndMs copied from the voiceover clip trim
  → Creates a CaptionClip on text track, aligned to voiceover start/duration
  → Default preset: "hormozi"
  → groupingMs: 1400 (fits ~3 words)
       │
       ▼
Caption clip renders immediately on timeline
```

The "Generate" button still exists for manual re-trigger (e.g., after re-recording), but it reuses the same clip linkage rather than creating duplicate caption clips. If the source voiceover is trimmed, replaced, or deleted, the linked caption clip is updated or marked stale accordingly.

---

## Export Fidelity Model

Every preset has an `exportMode` field:

| Mode | Meaning | Example Preset |
|------|---------|---------------|
| `"full"` | Export is materially identical to preview for supported resolutions | `clean-minimal`, `bold-outline` |
| `"approximate"` | Export uses ASS karaoke/color tags to approximate the preview | `hormozi`, `karaoke`, `pop-scale` |
| `"static"` | Export is static (no animation) — noted in UI as "entry animation not exported" | `slide-up`, `fade-scale` |

When `exportMode` is `"approximate"` or `"static"`, the export UI shows a note:

> "Some visual effects in this caption style are simplified in the exported video."

This is the contract with the user: exact when `full`, visibly downgraded but still recognizable when `approximate`, and intentionally static when `static`. Nothing is silently dropped, and presets whose identity depends on non-exportable effects must not be mislabeled as full parity.

---

## Transcript Editing Model

Whisper output is treated as a draft, not a final artifact. Every `CaptionDoc` can be corrected after transcription:

- Text can be edited without recreating the entire doc
- Token timings can be adjusted for late/early word boundaries
- Tokens can be split or merged for punctuation, emojis, or name corrections
- Manual caption docs are created from the editor UI, not by forcing users to hand-author raw API payloads

Preview and export always read the latest saved `CaptionDoc` by `captionDocId`. There is no separate preview-only correction state.

---

## No Shared Code Rule

This project has a strict "no shared code between frontend and backend" rule (they communicate over HTTP only). The `buildPages()` function appears in both `frontend/src/features/editor/caption/page-builder.ts` and `backend/src/domain/captions/page-builder.ts`. This is intentional duplication — both implementations are identical TypeScript with no browser or Node-specific imports. Any change must update both.

The same applies to preset definitions: `frontend/src/features/editor/caption/presets.ts` and `backend/src/domain/captions/preset-registry.ts` are separate files that must stay in sync. A test in each package validates that both files define the same preset IDs.

---

## Codebase Alignment Rules

This design must follow existing project conventions rather than inventing a parallel architecture:

- Frontend data fetching uses `useQueryFetcher()` for queries and `useAuthenticatedFetch()` for mutations; do not introduce raw `fetch` in hooks
- React Query keys live under `queryKeys.api.*` in `frontend/src/shared/lib/query-keys.ts`
- Timeline clip/runtime types remain in `frontend/src/features/editor/types/editor.ts`; caption module types only cover renderer/layout/preset concerns
- Backend timeline JSON types remain aligned in `backend/src/types/timeline.types.ts`
- Route validation schemas live in `backend/src/domain/editor/editor.schemas.ts` and are re-exported through `backend/src/routes/editor/schemas.ts`
- The captions route remains a standalone mount at `/api/captions` in `backend/src/index.ts`; it is not folded into `/api/editor`
- Services/repositories are instantiated through `backend/src/domain/singletons.ts`

---

## What This Architecture Does Not Include (Intentional)

- **WebGL rendering** — Canvas2D is sufficient for the target use case (short-form video captions, ~60fps preview). WebGL would add significant complexity for marginal gain. The renderer is pure-function-shaped, making WebGL a future option without redesigning the API.
- **User-generated presets** — The preset system is designed to support them (it's just `TextPreset` objects), but the UI and backend storage for user presets are not in scope for v2.
- **Character-level animation** — The AnimationDef type has `scope: "char"` as a future option, but no built-in preset uses it. The renderer will implement char-level in a subsequent version.
- **SRT/VTT import** — The `source: "import"` value in `CaptionDoc` is reserved. The import route is not in scope for v2.
- **Multiple simultaneous caption tracks** — The new architecture supports it (each `CaptionClip` references its own `CaptionDoc`), but the editor UI does not expose multi-track captions in v2.
- **Non-English caption support** — v2 is explicitly English-only. `CaptionDoc.language` is stored for forward compatibility, but locale-aware tokenization, bidi layout, and non-English QA are out of scope and must not be implied as supported.
