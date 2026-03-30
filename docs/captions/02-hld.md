# High-Level Design: Caption Engine v2

This document describes the architecture of the new caption system. It defines the system's layers, components, data flows, and integration points. Implementation details (types, function signatures, SQL) are in the LLD.

---

## Design Goals

1. **Clean separation of concerns** — transcription data, style definitions, and rendering are independent systems that communicate through typed contracts.
2. **Declarative animation** — animations are JSON data, not code branches. Adding a new animation requires no changes to the renderer.
3. **Preview === Export** — What the user sees in the editor preview must match the exported video. Export limitations are represented explicitly, not silently dropped.
4. **Extensible presets** — New presets can be added by writing a JSON object. No renderer changes required.
5. **Multi-line word wrap** — Captions wrap correctly at any font size on any canvas dimension.
6. **Auto-transcription** — Captions are generated automatically when a voiceover is added to the timeline, not on manual button press.

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
│  types.ts            — CaptionDoc, CaptionPage, TextPreset, AnimationDef   │
│                        CaptionLayout, WordToken, StyleLayer, EasingFn      │
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
│    useTranscription.ts   — useMutation: POST /api/captions/transcribe      │
│    useCaptionDoc.ts      — useQuery: GET /api/captions/:assetId            │
│    useCaptionCanvas.ts   — orchestrates canvas ref + rAF + renderer        │
│                                                                            │
│  components/                                                               │
│    CaptionPresetPicker.tsx   — Preset grid with live preview thumbnails    │
│    CaptionStylePanel.tsx     — Inspector panel (replaces mixed panel)      │
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
│    getCaptionDoc()   — Fetch by assetId                                    │
│                                                                            │
│  src/domain/editor/captions.repository.ts  (updated)                       │
│    DB queries against the renamed caption_doc table                        │
│                                                                            │
│  src/routes/editor/captions.ts  (thin route, mostly unchanged)             │
│    POST /api/captions/transcribe — delegates to captions.service           │
│    GET  /api/captions/:assetId  — delegates to captions.service            │
│    POST /api/captions/manual    — new, delegates to captions.service       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Preview Path

```
User opens editor
       │
       ▼
CaptionClip loaded from DB composition
  (captionDocId, stylePresetId, styleOverrides, groupingMs)
       │
       ▼
useCaptionDoc(assetId) → GET /api/captions/:assetId → CaptionDoc
       │
       ▼
buildPages(doc.words, captionClip.groupingMs) → CaptionPage[]
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
  2. Resolve preset (stylePresetId) from preset-registry
  3. Apply styleOverrides to preset
  4. buildPages(doc.words, captionClip.groupingMs) → CaptionPage[]
  5. generateASS(pages, resolvedPreset, resolution, clipStartMs)
  6. Write .ass file to /tmp
  7. Inject ass= FFmpeg filter into pipeline
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

**This is the key architectural change:** `type: "caption"` clips are no longer text clips with optional caption fields. They are a distinct clip type with their own data shape.

---

## Preset Resolution

Presets are resolved client-side and server-side from the same canonical list. The resolution order:

1. Look up `stylePresetId` in `BUILTIN_PRESETS`
2. If not found, use `BUILTIN_PRESETS[0]` (the default)
3. Apply `styleOverrides` on top of the resolved preset

This means presets are never stored in the DB — only the `stylePresetId` string is stored. The full preset definition lives in the codebase.

---

## Auto-Transcription Flow

The current system requires the user to click "Generate Text for Clip" in the Inspector. The new system triggers automatically:

```
Voiceover clip added to audio track
       │
       ▼
Editor detects new clip with type: "voiceover"
       │
       ▼
Auto-trigger: POST /api/captions/transcribe (assetId)
       │
       ▼
On success: dispatch ADD_CAPTION_CLIP with returned captionDocId
  → Creates a CaptionClip on text track, aligned to voiceover start/duration
  → Default preset: "hormozi"
  → groupingMs: 1400 (fits ~3 words)
       │
       ▼
Caption clip renders immediately on timeline
```

The "Generate" button still exists for manual re-trigger (e.g., after re-recording), but auto-transcription is the primary flow.

---

## Export Parity Model

Every preset has an `exportMode` field:

| Mode | Meaning | Example Preset |
|------|---------|---------------|
| `"full"` | Export matches preview exactly (no animations lost) | `clean-minimal`, `dark-box` |
| `"approximate"` | Export uses ASS karaoke/color tags to approximate the preview | `hormozi`, `karaoke`, `pop-scale` |
| `"static"` | Export is static (no animation) — noted in UI as "entry animation not exported" | `slide-up`, `fade-scale` |

When `exportMode` is `"approximate"` or `"static"`, the export UI shows a note:

> "Some visual effects in this caption style are simplified in the exported video."

This is an honest contract with the user. Nothing is silently dropped.

---

## No Shared Code Rule

This project has a strict "no shared code between frontend and backend" rule (they communicate over HTTP only). The `buildPages()` function appears in both `frontend/src/features/editor/caption/page-builder.ts` and `backend/src/domain/captions/page-builder.ts`. This is intentional duplication — both implementations are identical TypeScript with no browser or Node-specific imports. Any change must update both.

The same applies to preset definitions: `frontend/src/features/editor/caption/presets.ts` and `backend/src/domain/captions/preset-registry.ts` are separate files that must stay in sync. A test in each package validates that both files define the same preset IDs.

---

## What This Architecture Does Not Include (Intentional)

- **WebGL rendering** — Canvas2D is sufficient for the target use case (short-form video captions, ~60fps preview). WebGL would add significant complexity for marginal gain. The renderer is pure-function-shaped, making WebGL a future option without redesigning the API.
- **User-generated presets** — The preset system is designed to support them (it's just `TextPreset` objects), but the UI and backend storage for user presets are not in scope for v2.
- **Character-level animation** — The AnimationDef type has `scope: "char"` as a future option, but no built-in preset uses it. The renderer will implement char-level in a subsequent version.
- **SRT/VTT import** — The `source: "import"` value in `CaptionDoc` is reserved. The import route is not in scope for v2.
- **Multiple simultaneous caption tracks** — The new architecture supports it (each `CaptionClip` references its own `CaptionDoc`), but the editor UI does not expose multi-track captions in v2.
