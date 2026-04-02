# High-Level Design: Caption Engine v2

This document describes the architecture of the new caption system. It defines the system's layers, components, data flows, and integration points. Implementation details (types, function signatures, SQL) are in the LLD.

---

## Design Goals

1. **Clean separation of concerns** — transcription data, style definitions, and rendering are independent systems that communicate through typed contracts.
2. **Declarative animation** — animations are JSON data, not code branches. Adding a new animation requires no changes to the renderer.
3. **Trustworthy preview/export contract** — Preview and export resolve the same caption document and source range. The contract is explicit behavior, not blind parity: `full` means materially equivalent for export-safe styles, `approximate` means visibly related but not identical, and `static` means animation is intentionally absent in export. When export cannot reproduce a visual effect exactly, the downgrade is declared in preset metadata and UI; nothing is silently dropped.
4. **Extensible presets** — New presets can be added by writing a JSON object. No renderer changes required.
5. **Multi-line word wrap** — Captions wrap correctly at any font size on any canvas dimension.
6. **Auto-transcription** — Caption generation is tightly linked to voiceover clips. The target UX is one-step or automatic generation on voiceover insertion, subject to UX validation. The architectural commitment is idempotent clip linkage; the specific trigger mechanism (automatic vs. explicit) is a product decision, not an industry default.
7. **Explicit v2 language scope** — v2 is English-only. Tokenization, layout assumptions, QA, and preset tuning are only guaranteed for English transcripts, but the data model still uses the neutral term `Token` rather than `Word`.

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
│  │  id                 │  Editable caption doc owned by one CaptionClip.   │
│  │  assetId            │  Optional source asset reference for transcription │
│  │  tokens: Token[]    │                                                   │
│  │  fullText           │                                                   │
│  │  source             │                                                   │
│  └──────────┬──────────┘                                                   │
│             │                                                              │
│             │  (feeds into)                                                │
│             ▼                                                              │
│  ┌─────────────────────┐                                                   │
│  │  LAYER 2: GROUPING  │  How words are assembled into display units.      │
│  │                     │                                                   │
│  │  PageBuilder        │  Pure function. Takes tokens[] + groupingMs.      │
│  │  ─────────────      │  Outputs CaptionPage[].                           │
│  │  buildPages()       │  Each page has a tokens[] with token timing.      │
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
│  useCaptionPresets.ts — useQuery: GET /api/captions/presets                │
│                        Resolves seeded built-in presets from backend       │
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
│  preset-seed.ts      — Seed data for built-in caption presets              │
│                        Canonical source inserted into caption_preset table │
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
sliceTokensToRange(doc.tokens, sourceStartMs, sourceEndMs) → buildPages(tokens, captionClip.groupingMs) → CaptionPage[]
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

`sliceTokensToRange()` uses clamp-and-rebase semantics. Tokens fully outside the clip window are dropped. Tokens fully inside are kept. Tokens that partially overlap the left or right boundary are clamped to the visible window and then rebased relative to the clip. This same rule applies in preview and export.

`renderFrame()` must support both page-scoped and token-scoped animations. The renderer composes transforms in this order: page animation, token animation (including `staggerMs` by token index), then active-token pulse/state styling. This is required for presets like `pop-scale`.

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
  3. Resolve preset (stylePresetId) from `caption_preset`
  4. Apply styleOverrides to preset
  5. Derive a deterministic ASS style name from the fully resolved preset
     (preset ID + export-relevant overrides such as fontSize / positionY)
  6. buildPages(tokens, captionClip.groupingMs) → CaptionPage[]
  7. generateASS(pages, resolvedPreset, resolution, clipStartMs, styleName) → ASS events
       │
       ▼
Merge all clip ASS events into one subtitle timeline
  8. Deduplicate resolved style variants by styleName
  9. Sort events by absolute start time
 10. Emit one combined .ass file with shared Script Info + Styles + Events
 11. Write combined .ass file to /tmp
 12. Inject a single ass= filter into FFmpeg pipeline
       │
       ▼
FFmpeg renders video with burned-in captions
```

FFmpeg receives exactly one subtitle file for the composition. We do not create one `ass=` filter per caption clip. Instead, each clip contributes ASS dialogue events whose timestamps are rebased to absolute composition time via `clipStartMs`, then the exporter merges them into one file. Sequential clips become sequential events; overlapping clips remain overlapping events in the shared timeline.

ASS style identity is based on the fully resolved export style, not only on `stylePresetId`. If two clips start from the same preset but differ in export-relevant overrides, they must produce different deterministic `styleName` values so their entries in the shared `Styles` section do not collide.

This merge strategy is the formal export contract for multi-clip compositions.

---

## Init Flow

`POST /api/editor/init` does not create a placeholder `CaptionClip` before transcription exists. Initial timeline construction stays synchronous and deterministic: it creates the voiceover clip, but defers caption clip creation until a real `captionDocId` is available from transcription.

The sequence is:

1. `build-initial-timeline.ts` creates the voiceover clip only.
2. The editor enters caption job state `idle` for that voiceover clip.
3. Auto-transcription or explicit generate triggers `POST /api/captions/transcribe`.
4. On success, the reducer dispatches `ADD_CAPTION_CLIP` with the returned `captionDocId`.

This means `CaptionClip.captionDocId` always points at a real persisted `caption_doc` row. There is no stub caption doc row and no transient caption clip shape with a null FK.

`build-initial-timeline.ts` must not emit a caption clip. Any implementation note that still suggests building a `CaptionClip` during init is stale and should be removed.

---

## Timeline Integration

`CaptionClip` is the **only** first-class clip type on the text track for timed on-screen text in v2. Speech captions, titles, lower-thirds, and other static text overlays all use the same discriminator — there is no separate `TitleClip` or parallel generic text clip for this layer.

```
Text Track
  └── CaptionClip (type: "caption") — timed text backed by a CaptionDoc
```

**Transcription-backed captions:** `CaptionDoc` from Whisper (`source: "whisper"`), optional `originVoiceoverClipId`, word grouping, active-word timing, and caption export as described elsewhere in this document.

**Title-like / static overlays:** Same `CaptionClip` shape. The `CaptionDoc` is created manually (`source: "manual"` via `POST /api/captions/manual`) with tokens covering the visible time range. Product UX can label this "Add title" while the data model stays unified. Prefer presets with no word activation, `exportMode: "static"` where appropriate, and/or a large `groupingMs` so the line reads as a single static block rather than word-by-word emphasis.

In the DB composition JSON, the text track holds `CaptionClip` entries for all of the above. The editor reducer and renderer use `clip.type === "caption"` and load the linked `CaptionDoc`; there is no second clip type to branch on for titles.

**This is the key architectural change:** `type: "caption"` clips are no longer text clips with optional caption fields. They are a distinct clip type with their own data shape, and they subsume static titles operationally.

---

## Preset Resolution

Built-in presets are stored in the database as seeded rows in `caption_preset`. This is the canonical source of truth for both preview and export.

Resolution order:

1. Look up `stylePresetId` in `caption_preset`
2. If not found, use the seeded default preset row (`id = "hormozi"`)
3. Apply `styleOverrides` on top of the resolved preset

The full built-in preset definition is therefore persisted once and consumed by both:
- editor preview via `GET /api/captions/presets`
- backend export via repository lookup / in-memory cache backed by `caption_preset`

This deliberately avoids frontend/backend preset drift. There is no mirrored preset registry and no second hand-maintained copy.

`TextPreset` styles every `CaptionClip`, whether the doc came from Whisper or manual entry. Fields such as `groupingMs`, `wordActivation`, and timed export hints apply whenever the preset uses them; for static title-style clips, choose or tune presets so activation and animation are effectively off (e.g. `wordActivation: null`, `exportMode: "static"`, high `groupingMs`).

---

## Auto-Transcription Flow

The current system requires the user to click "Generate Text for Clip" in the Inspector. The new system is designed around idempotent, clip-linked transcription and supports automatic triggering per voiceover clip:

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

**Product note:** Automatic triggering on voiceover insertion is the current target UX for a social-first tool. If UX testing shows that this feels surprising or duplicative, the same architecture can switch to a deliberate one-step trigger without changing the clip/linkage model. The important commitment is idempotent clip linkage, deduplicated jobs, and `originVoiceoverClipId`.

The "Generate" button still exists for manual re-trigger (e.g., after re-recording), but it reuses the same clip linkage rather than creating duplicate caption clips. If the source voiceover is trimmed, replaced, or deleted, the linked caption clip is updated or marked stale accordingly.

`stale` is an editor-side synchronization state, not a DB-only flag. It is triggered when the source voiceover clip identified by `originVoiceoverClipId` changes in a way that invalidates the caption clip's timing or source asset:

- voiceover trim changes `startMs`, `durationMs`, or the effective source window
- voiceover asset replacement changes `assetId`
- voiceover deletion removes the clip entirely

When those events occur, the reducer marks the linked caption clip stale so the inspector and timeline can prompt for re-sync or remove the orphaned caption clip. A fresh transcription clears `stale` by updating or recreating the linked caption clip with a valid source window.

Each `CaptionDoc` is clip-owned. It may reference an originating asset for transcription provenance, but it is not a shared editable doc reused across multiple caption clips. Re-transcription overwrites the existing `CaptionDoc` in place for that linked caption clip instead of creating a second doc and retargeting `captionDocId`. This keeps the clip linkage stable across retries without allowing edits on one clip to mutate another clip's transcript.

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
- Token timings can be adjusted for late/early token boundaries
- Tokens can be split or merged for punctuation, emojis, or name corrections
- Manual caption docs are created from the editor UI, not by forcing users to hand-author raw API payloads

Preview and export always read the latest saved `CaptionDoc` by `captionDocId`. There is no separate preview-only correction state.

That same in-place update rule applies to re-transcription. The system does not mint a second hidden caption doc for the same linked clip. If a user chooses to re-transcribe, the existing clip-owned doc is replaced with the new Whisper output and any prior manual corrections are discarded.

---

## No Shared Code Rule

This project has a strict "no shared code between frontend and backend" rule (they communicate over HTTP only). The `buildPages()` function appears in both `frontend/src/features/editor/caption/page-builder.ts` and `backend/src/domain/editor/captions/page-builder.ts`. This is intentional duplication — both implementations are identical TypeScript with no browser or Node-specific imports. Any change must update both.

Preset definitions are the exception to "duplicate it locally": they are not maintained in parallel frontend/backend code files. Instead, built-in presets are seeded into `caption_preset`, exposed over HTTP to the frontend, and read by the backend directly from the database (optionally cached in-process). The seed data is authored once and inserted idempotently.

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
- **Non-English caption support** — v2 is explicitly English-only. `CaptionDoc.language` is stored for forward compatibility, but locale-aware tokenization, bidi layout, and non-English QA are out of scope and must not be implied as supported. The timed transcript unit is named `Token` in v2 because it is a render/edit abstraction, not a linguistic word. Do not deepen coupling to English-specific word semantics in new code.
