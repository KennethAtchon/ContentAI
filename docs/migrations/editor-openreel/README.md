# Editor Migration — OpenReel Architecture

> Total rewrite of the editor's state + runtime layer to match OpenReel's architecture. UI stays visually identical; everything beneath it gets replaced.
> Started: 2026-04-23. Owner: Kenneth.

---

## The Problem We're Solving

Not a perf tuning pass. A full foundation replacement. The current editor is slow and increasingly unmaintainable because the **state pattern** is fundamentally wrong — and every other perf issue (render thrashing, context cascades, caption feedback loops, preview/export drift) is downstream of it.

Concretely:

- `EditorState = EditorDocumentState & EditorPlaybackState & EditorUIState` — one blob of three concerns (`types/editor.ts:16`).
- Undo is **full-state snapshots** up to 50 deep on every edit (`model/editor-reducer-helpers.ts:285`).
- `useReducer` in a single `useEditorStore` hook, 235 lines, 35 `useCallback` dispatchers (`hooks/useEditorStore.ts`).
- Eight React contexts slicing the same god state and threading it through a 9-deep provider nest in `components/layout/EditorProviders.tsx`.
- Any state change wakes every context subscriber. Playback pushes `currentTimeMs` into React state 4×/sec and cascades rerenders through the whole tree.

This doesn't get fixed. It gets replaced.

## The Target: OpenReel's Pattern, End-to-End

What we're copying from `/Users/ken/Documents/workspace/openreel/openreel-video`:

1. **Engine in `packages/core/` (mirrored at `frontend/src/editor-core/`) with zero React imports.** Lint-enforced boundary.
2. **Zustand stores with `subscribeWithSelector` and `devtools`.** Four stores split by lifetime + purpose: `projectStore` (document, undoable), `uiStore` (ephemeral UI), `playbackStore` (ephemeral playback), `engineStore` (handles).
3. **Every component read goes through a typed selector.** No `useContext`. No bare `useStore()`. Lint-enforced.
4. **Action-based undo.** 200-action ring buffer; each op returns `{nextState, inverse}`. Memory cheap, semantics correct.
5. **AudioContext-driven `MasterTimelineClock` outside React state.** UI subscribes via `useSyncExternalStore`.
6. **One `VideoEngine.renderFrame(project, t, w, h) → RenderedFrame`.** Preview rAF loop and export loop both call it.
7. **MediaBunny for decode AND encode.** No `HTMLVideoElement.currentTime` seek for preview. No hand-rolled `VideoDecoder` chunk management. Same library OpenReel uses (it's already in our tree as a transitive dep via the export path; we make it explicit and replace `DecoderPool` + `ClipDecodeWorker` with MediaBunny-backed decode).
8. **Pure-function captions.** `renderCaptionFrame(doc, preset, t) → Segment[]` painted inline, no async bitmap round-trip.
9. **LRU frame cache with global memory budget** (100 frames / 500 MB; preload 30 ahead / 10 behind).
10. **Thin bridges between engine and React.** One file per domain (`RenderBridge`, `PlaybackBridge`, `TextBridge`, `MediaBridge`).
11. **Rust / WASM deleted.** OpenReel proves it's unnecessary; deployment surface shrinks.

## Non-Goals

- No UI redesign. Components look identical after each phase; only their data source changes.
- No backend (Hono/Drizzle) changes unless a bug surfaces during migration.
- No database schema changes.
- No production users exist → **no backwards compatibility, no feature flags, no shims.** Per `CLAUDE.md`: delete old code, update all call sites, reset DB if schema shifts.
- No monorepo expansion — Docker prod context stays `frontend/` + `backend/`. `editor-core/` is a subfolder of `frontend/src/`, enforced by ESLint not by package boundary.

## Stage Shape — Cleanse → Scaffold → Implement

Three stages. The implement stage is further split into one phase per subsystem.

| Stage | Phases | Purpose |
| --- | --- | --- |
| 1. Cleanse | 1 | Delete dead/duplicate/legacy code so the floor is clean. |
| 2. Scaffold | 2 | Create empty but correctly-shaped folders, stub interfaces, ESLint boundary. No behavior change. |
| 3. Implement | 3–10 | Fill each subsystem in priority order. Each phase keeps the editor working. |

### Phase list

Order is deliberate. Every phase depends on state from earlier phases; the state foundation comes **first** among implement phases because everything else builds on stores.

1. **Phase 1 — Cleanse** (`phase-01-cleanse.md`)
   Remove Rust/WASM, empty stub dirs, duplicate JS/Rust compositor parity check, merge duplicate context folders.

2. **Phase 2 — Scaffold** (`phase-02-scaffold.md`)
   Create `editor-core/` tree, `bridges/`, `stores/engineStore.ts`. Stubs only. ESLint boundary on `editor-core/`. Path aliases.

3. **Phase 3 — State Foundation (BIG)** (`phase-03-state-foundation.md`)
   **Total rewrite of state machinery.**
   - Delete the reducer, the god hook, all 8 editor contexts, full-state snapshot undo.
   - Introduce 4 Zustand stores (`projectStore`, `uiStore`, `playbackStore`, `engineStore`).
   - Action-based undo via `ActionExecutor` in `editor-core/timeline/`.
   - Selector discipline enforced by ESLint.
   - ~1800 lines deleted, ~900 added.
   - Every phase downstream assumes this pattern.

4. **Phase 4 — Clock + Playhead Decoupling** (`phase-04-implement-clock.md`)
   `MasterTimelineClock` (AudioContext) becomes source of truth for time. `usePlayheadMs()` + `useIsPlaying()` via `useSyncExternalStore`. `PlayheadClockContext` deleted.

5. **Phase 5 — Unified Render Pipeline** (`phase-05-implement-render-pipeline.md`)
   `VideoEngine.renderFrame(args) → RenderedFrame`. Move compositor + decoders into `editor-core/video/`. Delete old `PreviewEngine.ts`, `usePreviewEngine.ts`.

6. **Phase 6 — LRU Frame Cache** (`phase-06-implement-frame-cache.md`)
   Single global frame cache; LRU with count + byte budget; preload planner; memory-pressure integration.

7. **Phase 7 — Pure-Function Captions** (`phase-07-implement-captions.md`)
   `renderCaptionFrame()` as pure fn. Delete `CaptionLayer.tsx`, `useCaptionCanvas.ts`, `captionBitmapVersion`. Captions paint inline in the main canvas.

8. **Phase 8 — Unified Export** (`phase-08-implement-unified-export.md`)
   `ExportEngine.exportVideo()` calls `videoEngine.renderFrame()`. `services/client-export.ts` shrinks from 760 → ~200 lines. Preview ≡ export pixels.

9. **Phase 9 — Autosave in Worker** (`phase-09-autosave-and-persist.md`)
   Autosave subscribes to `projectStore`, serializes + fingerprints in a Web Worker. `useEditorAutosave` deleted.

10. **Phase 10 — Cutover + Final Sweep** (`phase-10-cutover-and-delete-old.md`)
    Delete leftover engine files. Update `CLAUDE.md` + architecture docs. Write ADR. CI boundary check.

Perf budgets per phase: `phases/perf-budgets.md`.

## Execution Rules (strict)

1. **One phase per branch, one PR per phase.** No multi-phase PRs.
2. **No phase merges without:** (a) `bun run type-check` clean, (b) `bun run lint` clean, (c) `bun test` green, (d) manual smoke: open project → play → scrub → edit clip → save → export.
3. **Each phase keeps the editor working.** If mid-phase state would break it, split the phase.
4. **Delete the old code at the end of the phase that replaces it.** No `.old.ts`, no `@deprecated`, no "keep for reference."
5. **Perf budgets are gating.** If a phase misses budget, fix before merge.
6. **If a phase exceeds estimate by 1.5×, stop and re-plan.** Don't grind.
7. **No mixing concerns.** A phase touches one subsystem. State foundation doesn't sneak in clock changes; clock phase doesn't sneak in captions.

## Perf Targets (end of stage 3)

| Metric | Current | Target |
| --- | --- | --- |
| Preview FPS (1080p, ≤10 clips) | 5–10 | **58+** |
| Rerenders in 10s playback (tree) | ~300 | **≤ 10** |
| Main-thread ms / frame | ~31 | **≤ 8** |
| Scrub latency p95 | — | **≤ 50 ms** |
| Preview ↔ export pixel parity | diverges | **byte-identical (pre-encode), ΔE ≤ 1 post-encode** |
| Memory steady-state (1 h timeline) | unbounded | **≤ 350 MB** |
| Bundle size | — | **≤ current** (net deletion) |

## Quick Facts About Current State

Captured 2026-04-23 from direct reads of the codebase:

- **State blob:** `EditorState = EditorDocumentState & EditorPlaybackState & EditorUIState` (`types/editor.ts:16`). Playback, UI, and document concerns fused.
- **Undo:** snapshot-based, 50 deep, captured on every edit (`editor-reducer-helpers.ts:285-289`). Each snapshot is a full `EditorState` copy.
- **God hook:** `useEditorReducer` / `useEditorStore.ts` — 235 lines, 35 `useCallback` dispatchers returned as an object.
- **Contexts:** 8 files in `context/` (`EditorClipCommandsContext`, `EditorDocumentActionsContext`, `EditorDocumentStateContext`, `EditorPersistContext`, `EditorPlaybackContext`, `EditorSelectionContext`, `EditorUIContext`, `PlayheadClockContext`) + the rogue `contexts/asset-url-map-context.ts`. Nested 9-deep in `EditorProviders.tsx`.
- **Playback publish:** `REACT_PUBLISH_INTERVAL_MS = 250` in `PreviewEngine.ts:28`. `publishTimeUpdate` hits reducer → context chain 4× / sec during playback.
- **Rust:** `frontend/src/features/editor/wasm/` + `engine/editor-core-wasm.ts`. Consumers: only `PreviewEngine.ts` (lines 627–681, parity check) and `services/client-export.ts` (line 462). JS `buildCompositorClips` equivalent already exists.
- **Empty stub dirs** (legacy refactor): `renderers/`, `scene/`, `preview-root/`.
- **Caption pipeline:** hidden `<canvas>` in `components/caption/CaptionLayer.tsx` → `useCaptionCanvas.renderAtTime()` → async `createImageBitmap` → version-bump state → rerender cascade.
- **Export:** `services/client-export.ts` is 760 lines, duplicates compositor descriptor logic.
- **Action-based undo already exists** (`editor-reducer-clip-ops.ts` etc.) in spirit — it dispatches named actions. But the history mechanism is still snapshot-based, undermining any benefit.

## Reference Docs

- `docs/research/openreel-rendering-architecture.md` — OpenReel internals.
- `docs/research/openreel-vs-contentai-why-slow.md` — head-to-head + smoking-gun citations.
- `docs/plans/editor-unified-architecture.md` — earlier planning doc. Superseded by this migration.
- `docs/architecture/domain/editor-preview-rendering-flow.md` — current flow diagram (will be rewritten in phase 10).
- `docs/bugs/issues.md`, `docs/bugs/dump.md` — known issues.
- OpenReel source: `/Users/ken/Documents/workspace/openreel/openreel-video`.

## Architecture Parity Checklist (Non-Negotiable End State)

The editor after phase 10 must match OpenReel's architecture on every bullet. If any is violated, the migration is not done.

### Boundaries
- [ ] `frontend/src/editor-core/` contains engine code. Zero React, zero `react-dom`, zero Zustand, zero TanStack imports (ESLint-enforced).
- [ ] All React code in `features/editor/` talks to the engine **only** through `bridges/`. No direct imports of engine internals from components.
- [ ] `features/editor/engine/` directory is **deleted** by phase 10.

### State
- [ ] Zero React contexts for editor state. `features/editor/context/` directory is **deleted**.
- [ ] Exactly four stores: `projectStore`, `uiStore`, `playbackStore`, `engineStore`.
- [ ] Every component store read uses a typed selector. Bare `useStore()` is a lint error.
- [ ] No component uses `useReducer` for editor state.
- [ ] `EditorProviders.tsx` contains **zero** `<Context.Provider>` elements. It's just a mount/hydrate effect.
- [ ] No provider nest deeper than 1 level in the editor tree.

### Undo/Redo
- [ ] Undo/redo is action-based via `ActionExecutor` in `editor-core/timeline/`.
- [ ] Snapshot-based undo is gone. `snapshotEditorState` does not exist.
- [ ] History memory for a 100-edit session fits in < 1 MB.

### Clock & Playback
- [ ] `MasterTimelineClock` is an AudioContext-driven singleton on `engineStore`.
- [ ] `currentMs` is **never** in React state. No `setState({ currentTimeMs })` anywhere.
- [ ] UI reads playhead via `usePlayheadMs()` (`useSyncExternalStore` + rAF, per-hook).
- [ ] `REACT_PUBLISH_INTERVAL_MS` does not exist.

### Decode & Render
- [ ] **MediaBunny** is the decode path. No direct `VideoDecoder` chunk management in our code.
- [ ] **MediaBunny** is also the encode path (already true via `client-export.ts`).
- [ ] No `HTMLVideoElement.currentTime` seek is used for preview frames. Anywhere.
- [ ] `VideoEngine.renderFrame(args) → RenderedFrame` is the single render entry.
- [ ] Preview rAF loop and export loop both call that function.
- [ ] `RendererFactory` selects WebGL2, falls back to Canvas2D via one `Renderer` interface.

### Frame Cache
- [ ] One `FrameCache` (LRU, 100 frames / 500 MB) owns all decoded frames.
- [ ] Per-clip frame queues do **not** exist.
- [ ] `VideoFrame.close()` is called on every eviction.
- [ ] Preload planner fetches 30 frames ahead / 10 behind during playback.

### Captions
- [ ] `renderCaptionFrame(doc, preset, t, box) → Segment[]` is pure, synchronous, and lives in `editor-core/text/`.
- [ ] `CaptionLayer.tsx` does **not** exist.
- [ ] `useCaptionCanvas` does **not** exist.
- [ ] `captionBitmapVersion` does **not** exist.
- [ ] Captions are painted into the main preview canvas as a top-z layer, not a hidden DOM canvas.

### Export
- [ ] `ExportEngine` calls `videoEngine.renderFrame()` for each frame.
- [ ] `services/client-export.ts` is ≤ 250 lines (orchestration + audio mux only; no descriptor / compositor logic).
- [ ] Preview ↔ export pixel ΔE ≤ 2 at 5 sampled timestamps.

### Autosave
- [ ] JSON serialization + fingerprint happen in a dedicated Web Worker.
- [ ] `useEditorAutosave` does **not** exist.
- [ ] Autosave subscribes to `projectStore` via `subscribe(selector, onChange)`.

### Hygiene
- [ ] Rust / WASM (`frontend/src/features/editor/wasm/`, `engine/editor-core-wasm.ts`) is **deleted**.
- [ ] No `.old.ts`, no `@deprecated`, no commented-out code blocks.
- [ ] `bun run build` output is smaller than pre-migration.
- [ ] CI has a boundary check that fails the build if `editor-core/` contains a React import.

If any line above is unchecked at phase 10 exit, the migration isn't done — open a follow-up.

## Checklist

- [ ] Phase 1 — Cleanse
- [ ] Phase 2 — Scaffold
- [ ] Phase 3 — State Foundation (total rewrite)
- [ ] Phase 4 — Clock + playhead decoupling
- [ ] Phase 5 — Unified render pipeline (+ MediaBunny decode)
- [ ] Phase 6 — LRU frame cache
- [ ] Phase 7 — Pure-function captions
- [ ] Phase 8 — Unified export
- [ ] Phase 9 — Autosave in worker
- [ ] Phase 10 — Cutover + delete old
