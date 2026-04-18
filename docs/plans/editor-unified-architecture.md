# ReelStudio Editor — Unified Architecture Plan

> **Date:** 2026-04-18
> **Status:** Draft
> **Scope:** React state layer + Rust/WASM engine layer
 
---

## 1. Problem Statement

Two compounding problems make the editor unmaintainable and increasingly buggy as features are added:

**Problem A — React state is one tangled blob.**
`useEditorLayoutRuntime` orchestrates 8 hooks and returns 25 values. Every child component receives 10–30 props drilled from layout. `EditorState` mixes document data (tracks, title — must persist), playback (currentTimeMs, isPlaying — ephemeral), and UI state (zoom, selectedClipId — view-only) in a single atom. Any state change re-renders every context subscriber. Answering "what does X do?" requires tracing 6–10 files manually.

**Problem B — The compositor is fragile TypeScript.**
`CompositorWorker` parses CSS transform strings with regex (`/scale\(([\d.+-]+)\)/`) to compute canvas draw operations. The code itself comments "For production, replace with a proper CSS-to-canvas matrix converter." Transition effects (wipes, fades, slides) are computed via string manipulation, not math. There is no client-side export — export is server-side only, which blocks users on network latency and server capacity. Effects math (warmth filter, contrast) runs on the main thread inside `buildCompositorClips()` on every RAF tick.

If nothing changes: every new editor feature requires touching the god hook and threading props through 4 layers. The compositor becomes unmaintainable as effects and transitions grow. Export stays server-dependent.

---

## 2. Current Architecture (What Exists Today)

```
EditorRoutePage (560 lines — project list + editor container mixed)
  └── EditorLayout
        └── useEditorLayoutRuntime ← GOD HOOK (150 lines, 25 return values)
              ├── useEditorReducer       (EditorStore: 35 callbacks)
              ├── useEditorAutosave      (PATCH debounce, saveTimerRef, editorPublishStateRef)
              ├── useEditorTransport     (playback controls — takes save refs from autosave)
              ├── useEditorClipActions   (clip CRUD wrappers)
              ├── useEditorLayoutMutations (publish/draft/aiAssemble — takes save refs)
              ├── useEditorKeyboard      (shortcuts — takes save refs)
              ├── useEditorProjectPoll   (polling + server merge)
              └── useEditorAssetMap      (assetId → URL resolution)
        ├── EditorHeader        ← 14 drilled props
        ├── EditorWorkspace     ← 30 drilled props (also owns all caption state)
        │     ├── LeftPanel
        │     ├── PreviewArea
        │     ├── Inspector     ← uses EditorContext directly (already correct)
        │     └── <canvas hidden> (caption offscreen render)
        ├── TimelineSection     ← 17 drilled props
        │     └── Timeline      ← uses EditorContext directly (already correct)
        ├── EditorStatusBar     ← 3 drilled props
        └── EditorDialogs       ← 8 drilled props

Engine Layer (already worker-based — keep this pattern):
  PreviewEngine (main thread)
    ├── AudioMixer              (Web Audio API, main thread orchestration)
    ├── DecoderPool             (manages 1 ClipDecodeWorker per video clip)
    │     └── ClipDecodeWorker  (Worker: WebCodecs VideoDecoder → VideoFrame)
    └── CompositorWorker        (Worker: OffscreenCanvas, Canvas 2D)
          ← receives VideoFrame objects from DecoderPool via main thread relay
          ← parses CSS transform strings with regex (FRAGILE)
          ← Canvas 2D only, no WebGL
```

**What is already correct and must not be rewritten:**
- Worker-per-clip decode pattern (`DecoderPool` + `ClipDecodeWorker`) — this is sound architecture
- `AudioMixer` using Web Audio API — correct, browser-handled
- `OffscreenCanvas` in `CompositorWorker` — correct thread model
- The reducer split (`session-ops`, `clip-ops`, `track-ops`) — logic is correct, only delivery changes
- `Timeline` and `Inspector` already consuming `EditorContext` directly — this is the target pattern for all components

---

## 3. Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  REACT LAYER (TypeScript — UI only, no compute)                     │
│                                                                     │
│  EditorDocumentContext  tracks, title, fps, resolution, undo/redo   │
│  EditorPlaybackContext  currentTimeMs (250ms throttle), isPlaying   │
│  EditorUIContext        zoom, selectedClipId, dialogs, effectPreview│
│  EditorPersistContext   isDirty, isSavingPatch, SaveService         │
│  AssetUrlMapContext     assetId → presigned URL                     │
│                                                                     │
│  Components consume context directly — zero prop drilling           │
└────────────────────────┬────────────────────────────────────────────┘
                         │ structured ClipDescriptor[] + playheadMs
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ENGINE ORCHESTRATION (TypeScript, main thread)                     │
│                                                                     │
│  PreviewEngine                                                      │
│    - RAF loop synced to AudioMixer clock                            │
│    - calls Rust WASM timeline::build_compositor_clips()             │
│    - throttles onTimeUpdate to React at 250ms                       │
│    - manages play/pause/seek across DecoderPool + AudioMixer        │
└──────────┬──────────────────────┬───────────────────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────────────────────────────────┐
│  DecoderPool     │   │  CompositorWorker (OffscreenCanvas)          │
│  (unchanged)     │   │                                              │
│  1 Worker/clip   │   │  Rust/WASM Compositor (WebGL2 via wgpu)      │
│  WebCodecs       │   │    - proper affine transform math            │
│  VideoDecoder    │   │    - GPU blending, opacity                   │
│  → VideoFrame    │──▶│    - warmth/contrast via WebGL uniforms      │
│                  │   │    - wipe/slide transitions via shaders      │
│  AudioMixer      │   │    - text overlays (2D layer on top)         │
│  (unchanged)     │   │    - caption bitmap compositing              │
└──────────────────┘   └──────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Rust/WASM Crate: editor-core                                       │
│                                                                     │
│  timeline/                                                          │
│    resolve_frame(playhead_ms, tracks) → FrameRequest                │
│    build_compositor_clips(playhead_ms, tracks, effect_preview)      │
│    sanitize_no_overlap(tracks) → tracks                             │
│    compute_duration(tracks) → ms                                    │
│    transition_opacity(clip, transitions, playhead_ms) → f32         │
│    transition_transform(clip, transitions, playhead_ms) → Matrix2D  │
│                                                                     │
│  compositor/                                                        │
│    Compositor::new(width, height) → Compositor                      │
│    Compositor::tick(clips, playhead_ms) → renders to WebGL surface  │
│    Compositor::set_caption_frame(bitmap)                            │
│    effects::warmth_matrix(warmth: f32) → [f32; 20]  (color matrix) │
│    effects::contrast_factor(contrast: f32) → f32                   │
│                                                                     │
│  export/                                                            │
│    ExportPipeline::new(tracks, fps, duration) → ExportPipeline      │
│    ExportPipeline::next_frame() → Option<FrameRequest>              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  EXPORT PIPELINE                                                    │
│                                                                     │
│  Client-side (≤5 min, standard formats):                            │
│    Rust ExportPipeline → FrameRequest                               │
│    DecoderPool (seek mode) → VideoFrame                             │
│    WebCodecs VideoEncoder → EncodedVideoChunk                       │
│    mp4-muxer (npm) → MP4 blob → download                            │
│                                                                     │
│  Server-side fallback (>5 min, complex timelines):                  │
│    existing export job queue — unchanged                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. State Domain Split

`EditorState` becomes three independent types joined by intersection. The reducer logic does not change — only the type definition and context delivery change.

```typescript
// types/editor-document.ts
interface EditorDocumentState {
  editProjectId: string | null;
  title: string;
  durationMs: number;
  fps: number;
  resolution: string;
  tracks: Track[];
  clipboardClip: Clip | null;
  clipboardSourceTrackId: string | null;
  past: EditorHistorySnapshot[];
  future: EditorHistorySnapshot[];
  isReadOnly: boolean;
}

// types/editor-playback.ts
interface EditorPlaybackState {
  currentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
  zoom: number;
}

// types/editor-ui.ts
interface EditorUIState {
  selectedClipId: string | null;
  exportJobId: string | null;
  exportStatus: ExportJobStatus | null;
}

// EditorState = EditorDocumentState & EditorPlaybackState & EditorUIState (unchanged shape)
```

**Context → State mapping:**

| Context | Reads from | Update frequency |
|---------|-----------|-----------------|
| `EditorDocumentContext` | `EditorDocumentState` | On user edits (clip add/remove/move/trim) |
| `EditorPlaybackContext` | `EditorPlaybackState` + engine `onTimeUpdate` | Throttled 250ms during playback; immediate on seek |
| `EditorUIContext` | `EditorUIState` + local `useState` | On user interaction |
| `EditorPersistContext` | `useEditorAutosave` | On save events |

**`SaveService` interface — breaks autosave ref coupling:**

```typescript
// services/SaveService.ts
interface SaveService {
  flushNow(): Promise<void>;   // transport, keyboard, mutations call this
  cancelPending(): void;       // called before navigation
}
```
Only `useEditorAutosave` implements this. No other hook touches `saveTimerRef` or `editorPublishStateRef`.

---

## 5. Rust Crate Integration Points

The Rust crate replaces specific TypeScript functions. These are the exact callsites:

| TypeScript (current) | Rust replacement | Location |
|---------------------|-----------------|---------|
| `buildCompositorClips()` in `PreviewEngine.ts:62` | `timeline::build_compositor_clips()` | Called in `PreviewEngine.tickCompositor()` |
| `buildWarmthFilter()` in `editor-composition.ts` | `effects::warmth_matrix()` | Moved into Rust compositor, not sent as CSS string |
| CSS transform string in `CompositorWorker` | `compositor::apply_transform(matrix)` | GPU uniform, not string parse |
| `sanitizeTracksNoOverlap()` in `editor-reducer-helpers.ts` | `timeline::sanitize_no_overlap()` | Called in `finalizeEditorState()` |
| `computeDuration()` in `editor-reducer-helpers.ts` | `timeline::compute_duration()` | Called in reducer |
| Transition opacity/transform math in `editor-composition.ts` | `timeline::transition_opacity()` + `transition_transform()` | Called from Rust `build_compositor_clips()` |

The React layer never calls Rust directly. `PreviewEngine.ts` (TypeScript) is the only entry point to the Rust WASM module. The WASM module is loaded once in `PreviewEngine` constructor.

```typescript
// PreviewEngine.ts (after migration)
import init, { build_compositor_clips, sanitize_tracks } from '../wasm/editor_core';

export class PreviewEngine {
  static async create(...): Promise<PreviewEngine> {
    await init(); // load WASM once
    return new PreviewEngine(...);
  }
  
  private tickCompositor(playheadMs: number): void {
    // Rust computes all per-clip descriptors, opacity, transforms
    const clips = build_compositor_clips(
      this.tracks,
      playheadMs,
      this.effectPreview
    );
    this.callbacks.onTick(playheadMs, clips, ...);
  }
}
```

---

## 6. CompositorWorker Migration (Canvas 2D → Rust/WebGL2)

The `CompositorWorker` worker message protocol stays identical. Only the internal render path changes.

**Current (fragile):**
```typescript
// CompositorWorker.ts — regex CSS parsing, Canvas 2D
function applyTransform(ctx, transform: string | null) {
  const scaleMatch = transform.match(/scale\(([\d.+-]+)\)/);
  // ...
}
renderCtx.drawImage(frame, dx, dy, dw, dh); // Canvas 2D
```

**Target (Rust/WebGL2 via wgpu compiled to WASM):**
```typescript
// CompositorWorker.ts — after migration
import init, { Compositor } from '../wasm/editor_core';

let compositor: Compositor | null = null;

case 'INIT': {
  await init();
  compositor = Compositor.new(msg.canvas, msg.width, msg.height); // WebGL2 surface
  break;
}

case 'TICK': {
  compositor!.tick(msg.clips); // Rust handles all blending, transforms, effects
  break;
}
```

The `VideoFrame` → compositor pipeline is unchanged: frames arrive via `postMessage`, the compositor picks the correct frame per clip by timestamp. Only the compositing math moves to Rust/GPU.

---

## 7. File Structure After Refactor

```
frontend/src/features/editor/
  types/
    editor.ts              — Clip, Track, Transition, EditProject (unchanged)
    editor-document.ts     — EditorDocumentState (new)
    editor-playback.ts     — EditorPlaybackState (new)
    editor-ui.ts           — EditorUIState (new)

  model/                   — Reducer files (unchanged logic)
    editor-reducer.ts
    editor-reducer-clip-ops.ts
    editor-reducer-track-ops.ts
    editor-reducer-session-ops.ts
    editor-reducer-helpers.ts

  context/
    EditorDocumentContext.tsx   — new
    EditorPlaybackContext.tsx   — new
    EditorUIContext.tsx         — new
    EditorPersistContext.tsx    — new
    EditorContext.tsx           — DELETED (replaced by domain contexts)
  contexts/
    asset-url-map-context.ts   — unchanged

  services/
    SaveService.ts             — new (wraps autosave refs)
    editor-api.ts              — unchanged

  hooks/
    useEditorStore.ts          — unchanged (reducer wiring)
    useEditorAutosave.ts       — unchanged (implements SaveService)
    useEditorTransport.ts      — simplified (takes SaveService, not refs)
    useEditorClipActions.ts    — simplified (reads from context)
    useEditorLayoutMutations.ts — simplified (takes SaveService)
    useEditorKeyboard.ts       — simplified (takes SaveService)
    useEditorProjectPoll.ts    — unchanged
    useEditorAssetMap.ts       — unchanged
    usePreviewEngine.ts        — updated (PreviewEngine.create() async)
    usePlayback.ts             — DELETED (rAF loop moved fully into PreviewEngine)
    useEditorLayoutRuntime.ts  — DELETED (god hook gone)

  components/
    layout/
      EditorRoutePage.tsx      — thin router only (~40 lines)
      EditorProjectList.tsx    — new (all project list UI from EditorRoutePage)
      EditorProviders.tsx      — new (nests all 5 providers)
      EditorLayout.tsx         — simplified (no runtime, no prop drilling)
      EditorWorkspace.tsx      — simplified (layout shell only, ~80 lines)
      EditorHeader.tsx         — reads from context directly
      EditorStatusBar.tsx      — reads from EditorPersistContext directly
    preview/
      PreviewArea.tsx          — reads from EditorPlaybackContext directly
      PreviewCanvas.tsx        — unchanged
      CaptionLayer.tsx         — new (extracted from EditorWorkspace)
      PlaybackBar.tsx          — reads from EditorPlaybackContext directly
    timeline/
      TimelineSection.tsx      — reads from context directly (no drilled props)
      Timeline.tsx             — unchanged (already uses context)
      TimelineClip.tsx         — unchanged
      TimelineRuler.tsx        — unchanged
      Playhead.tsx             — reads EditorPlaybackContext directly
    inspector/
      Inspector.tsx            — reads from context directly (already mostly correct)
    panels/
      LeftPanel.tsx            — reads from EditorUIContext directly
    dialogs/
      EditorDialogs.tsx        — reads from EditorUIContext + EditorPersistContext

  engine/
    PreviewEngine.ts           — updated (calls Rust WASM for compositor clips)
    AudioMixer.ts              — unchanged
    DecoderPool.ts             — unchanged
    ClipDecodeWorker.ts        — unchanged
    CompositorWorker.ts        — updated (WebGL2 via Rust WASM)
    decode-guard.ts            — unchanged

  wasm/                        — generated by wasm-pack (gitignored)
    editor_core.js
    editor_core_bg.wasm
    editor_core.d.ts

editor-core/                   — Rust crate (sibling to frontend/)
  Cargo.toml
  src/
    lib.rs
    timeline/
      mod.rs                   — build_compositor_clips, resolve_frame
      overlap.rs               — sanitize_no_overlap, compute_duration
      transitions.rs           — opacity + transform interpolation
    compositor/
      mod.rs                   — Compositor struct, WebGL2 surface
      effects.rs               — warmth color matrix, contrast
      transform.rs             — affine 2D math, no string parsing
      shaders/
        composite.wgsl         — WGSL shader for frame blending
    export/
      mod.rs                   — ExportPipeline, frame iterator
    types.rs                   — Clip, Track (serde-deserialized from JS)
```

---

## 8. Implementation Phases

Each phase leaves the editor in a fully working state. No phase breaks existing behavior.

---

### Phase 1 — Type split (0.5 days)

Split `EditorState` into three intersecting types without touching reducer logic or hook wiring.

**Deliverables:**
- [ ] `types/editor-document.ts` with `EditorDocumentState`
- [ ] `types/editor-playback.ts` with `EditorPlaybackState`
- [ ] `types/editor-ui.ts` with `EditorUIState`
- [ ] `EditorState = EditorDocumentState & EditorPlaybackState & EditorUIState` (same shape)
- [ ] `bun run type-check` passes

---

### Phase 2 — Domain contexts + SaveService (2 days)

Create all four domain contexts and `SaveService`. Wire into `EditorLayout` alongside the existing `EditorContext`. Both old and new wiring coexist — no component migrations yet.

**Deliverables:**
- [ ] `context/EditorDocumentContext.tsx` — document slice + dispatch
- [ ] `context/EditorPlaybackContext.tsx` — playback slice + setters
- [ ] `context/EditorUIContext.tsx` — UI state + setters (all `useState` from `useEditorLayoutRuntime` moves here)
- [ ] `context/EditorPersistContext.tsx` — `{ isDirty, isSavingPatch, lastSavedAt, saveService }`
- [ ] `services/SaveService.ts` — `flushNow()` + `cancelPending()` wrapping autosave refs
- [ ] `components/layout/EditorProviders.tsx` — nests all providers
- [ ] `useEditorTransport.ts` updated to take `SaveService` not refs
- [ ] `useEditorKeyboard.ts` updated to take `SaveService` not refs
- [ ] `useEditorLayoutMutations.ts` updated to take `SaveService` not refs
- [ ] `bun run type-check` + `bun test` pass

---

### Phase 3 — Migrate components to domain contexts (1.5 days)

Delete prop drilling. `useEditorLayoutRuntime` deleted. Migration order: leaf-first.

**Migration order:**
1. `EditorStatusBar` → `EditorPersistContext`
2. `EditorDialogs` → `EditorUIContext` + `EditorPersistContext`
3. `Inspector` → already uses `EditorContext`; add `EditorUIContext` for `effectPreview`
4. `TimelineSection` → `EditorDocumentContext` + `EditorPlaybackContext` + `EditorUIContext`
5. `PreviewArea` → `EditorPlaybackContext`
6. `LeftPanel` → `EditorUIContext`
7. `EditorHeader` → `EditorDocumentContext` + `EditorPersistContext`
8. `EditorWorkspace` → stripped to layout shell

**Deliverables:**
- [ ] `useEditorLayoutRuntime.ts` deleted
- [ ] `EditorContext.tsx` deleted (replaced)
- [ ] All components read from domain context, zero drilled props
- [ ] `bun run type-check` + `bun test` pass

---

### Phase 4 — CaptionLayer extraction (1 day)

Remove caption orchestration from `EditorWorkspace`.

**Deliverables:**
- [ ] `components/preview/CaptionLayer.tsx` owns `captionBitmapQueueRef`, `activeCaptionClipId`, `pendingCaptionRenderTimeRef`, `useCaptionCanvas`, `useCaptionDoc`, `useCaptionPresets`, hidden `<canvas>`
- [ ] `EditorWorkspace` renders `<CaptionLayer previewRef={previewRef} />`, all caption state gone
- [ ] `EditorWorkspace.tsx` ≤ 100 lines
- [ ] `bun run type-check` + `bun test` pass

---

### Phase 5 — Split EditorRoutePage (0.5 days)

**Deliverables:**
- [ ] `EditorProjectList.tsx` — all project list UI, `ProjectCard`, `groupByVersion`, create/delete/link mutations
- [ ] `EditorRoutePage.tsx` ≤ 50 lines — thin router only
- [ ] `bun run type-check` + `bun test` pass

---

### Phase 6 — Rust crate setup + timeline model (2 days)

Set up `editor-core` Rust crate. Validate the wasm-pack build pipeline. Implement timeline resolution in Rust and wire it into `PreviewEngine`.

**Deliverables:**
- [ ] `editor-core/` crate: `wasm-pack build --target web --out-dir ../frontend/src/features/editor/wasm`
- [ ] `vite.config.ts` updated with `vite-plugin-wasm` + `vite-plugin-top-level-await`
- [ ] `PreviewEngine` uses `static async create()` to load WASM once before any instance is created
- [ ] `timeline::build_compositor_clips(tracks: JsValue, playhead_ms: f64, effect_preview: JsValue) -> JsValue` — Rust equivalent of `buildCompositorClips()` in `PreviewEngine.ts:62`
- [ ] `timeline::sanitize_no_overlap(tracks: JsValue) -> JsValue` — Rust equivalent of `sanitizeTracksNoOverlap()` in `editor-reducer-helpers.ts:124`
- [ ] `timeline::compute_duration(tracks: JsValue) -> f64`
- [ ] Transition math (opacity interpolation, transform strings) moved into Rust `transitions.rs`
- [ ] `buildCompositorClips()`, `sanitizeTracksNoOverlap()`, `computeDuration()` TypeScript functions deleted from the codebase
- [ ] `bun run type-check` + dev server plays video correctly

**Rust Cargo.toml:**
```toml
[package]
name = "editor-core"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde-wasm-bindgen = "0.6"
js-sys = "0.3"
web-sys = { version = "0.3", features = ["console"] }

[profile.release]
opt-level = 3
lto = true
```

---

### Phase 7 — Rust compositor + WebGL2 (3 days)

Replace `CompositorWorker`'s Canvas 2D render path with a Rust/wgpu compositor targeting WebGL2. The worker message protocol is unchanged — only the internal render path changes.

**Deliverables:**
- [ ] `compositor::Compositor::new(canvas: OffscreenCanvas, width: u32, height: u32)` — acquires WebGL2 context via `web-sys`
- [ ] `Compositor::tick(clips: &[ClipDescriptor])` — renders one frame via WebGL2 shaders
- [ ] WGSL shader `composite.wgsl` handles: per-clip opacity, affine transform (scale/translate/rotate as uniform matrices, not CSS strings), warmth (5×4 color matrix uniform), contrast, clip-path wipes as stencil operations
- [ ] `CompositorWorker.ts` INIT message calls `Compositor::new()` — all `applyTransform()`, `applyClipPath()`, Canvas 2D draw code deleted
- [ ] Text overlays stay Canvas 2D on a separate overlay layer (2D context drawn on top of WebGL surface, or ImageBitmap composited)
- [ ] Caption bitmap composited via `Compositor::set_caption_frame(bitmap)`
- [ ] Dev server: scrubbing, playback, transitions, effects all work correctly

**wgpu target:** compile with `wgpu` feature flags for WebGL2 backend (not WebGPU — WebGL2 has broader support). Target: Chrome 94+, Firefox 130+, Safari 16.4+.

---

### Phase 8 — Client-side export (2 days)

Add client-side export for timelines ≤5 minutes. Server-side export stays as fallback.

**Deliverables:**
- [ ] `export::ExportPipeline::new(tracks, fps, duration_ms)` — frame iterator that returns `FrameRequest { clip_id, source_time_ms }` in chronological order
- [ ] `ExportPipeline::next_frame()` → `Option<FrameRequest>`
- [ ] Frontend `useClientExport` hook: drives `ExportPipeline` → `DecoderPool` (seek mode, no playback) → `VideoFrame` → `VideoEncoder` → `mp4-muxer` → download
- [ ] `ExportModal` shows progress bar driven by `ExportPipeline::progress()` (frames_done / total_frames)
- [ ] Client export gated on: timeline ≤5 min AND `VideoEncoder` available (`'VideoEncoder' in window`)
- [ ] Server export fallback if client export unavailable or fails
- [ ] `mp4-muxer` added to `package.json`
- [ ] Export produces MP4 that plays correctly at the right duration

---

## 9. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Context provider order bug (playback reads stale `durationMs` from document) | Medium | High | `EditorDocumentContext` wraps `EditorPlaybackContext`; unit test with known duration before Phase 3 |
| 2 | `SaveService.flushNow()` races in-flight PATCH mutation | Low | Medium | `SaveService` checks `isSavingPatchRef` before firing; mutation is idempotent |
| 3 | Phase 3 component migration misses a prop path | Medium | Low | TypeScript catches missing props; run `type-check` after each component |
| 4 | wasm-pack build not integrating with Vite + Bun | Medium | High | Validate Phase 6 setup before writing Rust logic; `vite-plugin-wasm` is well-documented |
| 5 | wgpu WebGL2 backend missing canvas 2D parity for text/caption | Medium | Medium | Keep text overlays on a Canvas 2D layer on top; only video compositing moves to WebGL2 |
| 6 | WebGL2 not available in test environment (jsdom) | High | Low | Mock WASM/WebGL in unit tests; integration test in real browser |
| 7 | `ExportPipeline` frame iterator too slow (seek latency × N frames) | Medium | Medium | Batch decode: seek to keyframe, decode forward N frames before next seek |
| 8 | `CaptionLayer` previewRef timing — caption renders before engine frame | Low | Low | Keep `pendingCaptionRenderTimeRef` guard unchanged from current code |

---

## 10. Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| `useEditorLayoutRuntime.ts` exists | Yes (152 lines) | No (deleted) |
| Max props on any component | ~30 (`EditorWorkspace`) | ≤5 |
| Inspector re-renders during playback | ~60/sec (context tick) | 0/sec |
| Files importing `saveTimerRef` | 4 | 1 (`SaveService` only) |
| `EditorWorkspace.tsx` line count | 263 | ≤100 |
| `EditorRoutePage.tsx` line count | 559 | ≤50 |
| `CompositorWorker` regex CSS parse | Yes | No (Rust math) |
| Client-side export | No | Yes (≤5 min) |
| Export blocked on server | Always | Only >5 min |

---

## 11. What Is Explicitly Not Changed

- `DecoderPool.ts` and `ClipDecodeWorker.ts` — worker-per-clip decode pattern is correct
- `AudioMixer.ts` — Web Audio API is the right tool; no Rust benefit here
- `useEditorProjectPoll.ts` — polling logic is correct
- `useEditorAssetMap.ts` — URL resolution is correct
- All reducer logic — `editor-reducer-*.ts` files are correct; only type shapes and delivery change
- Backend — all changes are frontend-only
- The existing server-side export job queue — stays as fallback

---

## 12. Open Questions (Resolve Before Starting Phase 2)

| # | Question | Decision Needed By |
|---|----------|--------------------|
| 1 | `playheadMs` vs `currentTimeMs`: two values exist today (one smoothed for scrubbing, one from store). Should `EditorPlaybackContext` own both, or collapse to one? | Phase 2 start |
| 2 | Does `useEditorProjectPoll` live inside `EditorDocumentContext` (natural home) or stay a standalone hook mounted in `EditorLayout`? | Phase 2 start |
| 3 | wgpu vs raw WebGL2 bindings via `web-sys`: wgpu is higher-level and safer but adds ~50KB to WASM binary. Raw WebGL2 is smaller but more code. | Phase 7 start |
| 4 | Client export audio: `AudioMixer` runs Web Audio API, not raw PCM. Client export needs audio muxing. Use `mp4-muxer` with `AudioEncoder` (WebCodecs)? Or skip audio in client export v1? | Phase 8 start |
