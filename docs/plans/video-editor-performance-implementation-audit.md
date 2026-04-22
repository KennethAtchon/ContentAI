# Video Editor Performance Implementation Audit

> Date: 2026-04-21
> Source plan: `docs/plans/video-editor-performance-strategy.md`
> Scope: sanity check of the current repo against the plan, with emphasis on what will fail or surprise us when this path is exercised for real.

## Executive Summary

The preview/runtime side is substantially implemented through Phase 5: typed descriptors exist, the hot-path regex transform parsing is gone, the decoder pool exposes useful metrics and shared demux metadata, Rust/WASM is wired into `PreviewEngine`, WebGL2 has a Canvas 2D fallback on initial context creation, and adaptive preview quality is present.

The biggest gap is Phase 6. Client export is not actually implemented yet. The UI calls the client export service first, but `runClientExport()` always returns `fallback`, `mediabunny` is not installed, no `VideoEncoder` encode loop exists, no MP4 muxing exists, and no playable client MP4 can be produced. This is safe in the sense that server export remains the path, but it does not satisfy the plan's client export goal.

There are also measurement and confidence gaps: no recorded baseline benchmark note, no manual benchmark fixture set, no Canvas2D-vs-WebGL visual tolerance tests, no compositor p95 benchmark, and no worker/VideoFrame cleanup tests.

## Phase Coverage

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0: Performance baseline/debug surface | Partial | Debug runtime exists, metrics are exposed, and marks/measures are wired. Missing benchmark fixture set and recorded baseline numbers. |
| Phase 1: Typed compositor descriptors | Mostly done | Runtime descriptors are numeric/typed and worker parsing is gone. The old TypeScript descriptor builder still exists for tests/parity. |
| Phase 2: Decode scheduler hardening | Mostly done | Worker budgets, seek metrics, shared demux metadata cache, and queue closing are implemented. Missing scrub p95 benchmark evidence and explicit close-path tests. |
| Phase 3: Rust timeline core | Mostly done | Rust crate and WASM wrapper exist and `PreviewEngine` uses Rust descriptors. Rollback/fallback is no longer a runtime feature flag. |
| Phase 4: WebGL2 compositor | Partial | WebGL2 renderer exists and falls back to Canvas2D only if initial WebGL2 creation fails. Missing visual tolerance tests, p95 benchmark proof, and robust context-loss fallback. |
| Phase 5: Adaptive preview quality | Partial | Full/half/low quality and effect disabling under frame pressure exist. Missing memory-pressure worker budget adjustment. |
| Phase 6: Client-side export V1 | Not done | Capability gate and Rust frame iterator shell exist, but encode/mux/export never completes client-side. |

## Critical Misses

### 1. Client export can never succeed

Evidence:

- `frontend/src/features/editor/services/client-export.ts:118` requires a client MP4 muxer.
- `frontend/package.json:34` through `frontend/package.json:114` does not include `mediabunny`.
- `frontend/src/features/editor/services/client-export.ts:151` through `frontend/src/features/editor/services/client-export.ts:157` always returns `status: "fallback"` even after frame requests and audio rendering.
- There is no `new VideoEncoder(...)`, no encoded chunk handling, and no muxer output path in `client-export.ts`.

Impact:

The export modal correctly falls back to the server, but the plan's Phase 6 "30-second and 5-minute benchmark timeline export to playable MP4" cannot happen.

Fix:

Wire the real export pipeline before treating Phase 6 as complete:

- Add/evaluate `mediabunny` or explicitly choose another modern muxer.
- Implement a `VideoEncoder` loop.
- Feed compositor/export frames into the encoder.
- Mux encoded video plus rendered audio.
- Return `{ status: "done", blob, objectUrl, filename }`.
- Add real browser integration tests for 30-second and 5-minute exports.

### 2. WebGL context loss can produce a blank renderer instead of falling back

Evidence:

- `frontend/src/features/editor/engine/compositor/Webgl2CompositorRenderer.ts:182` through `frontend/src/features/editor/engine/compositor/Webgl2CompositorRenderer.ts:191` handles loss by setting `webgl = null` and tries `initializeWebgl()` on restore.
- If restore fails, `render()` returns early because `!this.webgl || this.contextLost` at `frontend/src/features/editor/engine/compositor/Webgl2CompositorRenderer.ts:95` through `frontend/src/features/editor/engine/compositor/Webgl2CompositorRenderer.ts:97`.
- The Canvas2D fallback in `frontend/src/features/editor/engine/compositor/index.ts:21` through `frontend/src/features/editor/engine/compositor/index.ts:36` only runs during initial renderer creation.

Impact:

Initial WebGL2 unsupported browsers are covered, but runtime context loss or failed restore can leave preview blank instead of reverting to Canvas2D.

Fix:

Bubble a renderer failure/context-lost signal to `CompositorWorker`, then replace the renderer with `Canvas2dCompositorRenderer` or rebuild WebGL2 with a bounded retry.

### 3. Phase 0/4 success criteria are not measurable yet

Evidence:

- I found no sibling benchmark note containing baseline p95 compositor, frame interval, scrub latency, queue, or export values.
- I found no repeatable benchmark fixture set for "1-track, 2-track transition, caption-heavy, and long-timeline cases."
- I found no visual tolerance tests comparing Canvas2D and WebGL2 output.

Impact:

The implementation may work, but we cannot prove it meets the stated targets: p95 compositor under 8ms, p95 frame interval under 40ms, warm/cold seek latency, or WebGL parity.

Fix:

Add a benchmark note and fixture harness before declaring the performance plan complete. At minimum, capture:

- 1-track baseline
- 2-track transition
- caption-heavy
- long timeline
- Canvas2D vs WebGL2 renderer mode
- p95 compositor tick, frame interval, seek-to-visible, queue sizes, dropped frames

## Important Gaps

### Phase 0

Done:

- `window.__REEL_EDITOR_DEBUG__.snapshot()` exists via `frontend/src/shared/utils/system/performance.ts:252` through `frontend/src/shared/utils/system/performance.ts:270`.
- `PreviewEngine` registers a debug snapshot provider at `frontend/src/features/editor/engine/PreviewEngine.ts:346` through `frontend/src/features/editor/engine/PreviewEngine.ts:349`.
- Seek, first decoded frame, first compositor tick, React publish, and caption render marks/measures exist in `PreviewEngine.ts` and `useCaptionCanvas.ts`.

Missing:

- No recorded baseline numbers in the strategy doc or a benchmark sibling note.
- No repeatable manual benchmark fixture set.

### Phase 1

Done:

- Descriptors use typed `transform`, `effects`, and `clipPath` fields in `frontend/src/features/editor/engine/compositor/types.ts:1` through `frontend/src/features/editor/engine/compositor/types.ts:44`.
- `Canvas2dCompositorRenderer.applyTransform()` uses numeric fields directly at `frontend/src/features/editor/engine/compositor/Canvas2dCompositorRenderer.ts:150` through `frontend/src/features/editor/engine/compositor/Canvas2dCompositorRenderer.ts:188`.
- Golden tests cover dissolve, transform, wipe descriptors, and shared Rust fixture parity in `frontend/__tests__/unit/features/editor/preview-engine.test.ts`.

Potential cleanup:

- `buildCompositorClips()` still exists in `frontend/src/features/editor/engine/PreviewEngine.ts:203` through `frontend/src/features/editor/engine/PreviewEngine.ts:275`. It is useful for tests/parity, but the plan said to delete compatibility adapters before moving on.

### Phase 2

Done:

- Decoder metrics include active count, per-asset counts, metadata cache info, and per-clip seek metrics in `frontend/src/features/editor/engine/DecoderPool.ts:43` through `frontend/src/features/editor/engine/DecoderPool.ts:57`.
- Shared demux metadata cache and waiter flow exist in `DecoderPool.ts:621` through `DecoderPool.ts:747`.
- Compositor queues are bounded to 16 and close evicted frames in `frontend/src/features/editor/engine/CompositorWorker.ts:231` through `frontend/src/features/editor/engine/CompositorWorker.ts:247` and `CompositorWorker.ts:320` through `CompositorWorker.ts:329`.

Missing:

- No test specifically asserts replaced/dropped `VideoFrame.close()` behavior.
- No scrub p95 benchmark or outlier note.

### Phase 3

Done:

- Rust crate exists under `frontend/editor-core/`.
- Required functions exist: `compute_duration`, `resolve_frame`, `sanitize_no_overlap`, `build_compositor_descriptors`, and `build_export_frame_requests`.
- `PreviewEngine.create()` preloads WASM at `frontend/src/features/editor/engine/PreviewEngine.ts:325` through `frontend/src/features/editor/engine/PreviewEngine.ts:330`.
- `PreviewEngine.tickCompositor()` calls Rust descriptors at `frontend/src/features/editor/engine/PreviewEngine.ts:508` through `frontend/src/features/editor/engine/PreviewEngine.ts:517`.
- Cargo golden tests pass.

Setup note:

- WASM output is intentionally ignored by git through `.gitignore:15`, and build/test scripts regenerate it through `frontend/package.json:8` through `frontend/package.json:30`. This is okay, but local/dev/CI machines need Rust plus either `wasm-bindgen` or `wasm-pack`; otherwise `bun run editor-core:build` fails.

### Phase 4

Done:

- Worker protocol remains stable in `frontend/src/features/editor/engine/CompositorWorker.ts:48` through `frontend/src/features/editor/engine/CompositorWorker.ts:71`.
- WebGL2 renderer initializes from the transferred `OffscreenCanvas` at `frontend/src/features/editor/engine/compositor/Webgl2CompositorRenderer.ts:139` through `frontend/src/features/editor/engine/compositor/Webgl2CompositorRenderer.ts:180`.
- VideoFrame textures, transform quads, opacity, contrast, warmth, and clip uniforms exist.
- Text/caption overlays remain on a 2D overlay canvas, then upload as a texture.
- Initial Canvas2D fallback exists in `frontend/src/features/editor/engine/compositor/index.ts:18` through `frontend/src/features/editor/engine/compositor/index.ts:36`.
- Renderer can be forced with `VITE_EDITOR_COMPOSITOR_RENDERER=canvas2d` or `webgl2` from `frontend/src/shared/utils/config/envUtil.ts:83` through `frontend/src/shared/utils/config/envUtil.ts:87`.

Missing:

- No visual tolerance tests.
- No compositor p95 benchmark proof.
- Context loss does not fallback to Canvas2D if WebGL restore fails.

### Phase 5

Done:

- Preview quality levels exist in `frontend/src/features/editor/engine/PreviewEngine.ts:33` through `frontend/src/features/editor/engine/PreviewEngine.ts:60`.
- Scrubbing drops to half quality and restores after idle in `PreviewEngine.ts:424` through `PreviewEngine.ts:431` and `PreviewEngine.ts:581` through `PreviewEngine.ts:590`.
- Dropped-frame pressure can drop to low quality and disable effects in `PreviewEngine.ts:600` through `PreviewEngine.ts:618`.
- Debug state includes preview quality in `PreviewEngine.ts:845` through `PreviewEngine.ts:855`.

Missing:

- No memory-pressure signal lowers decode window or active worker budget.
- No benchmark proving heavy timelines remain interactive.

### Phase 6

Done:

- Capability gate checks `VideoEncoder`, `OfflineAudioContext`, duration, resolution budget, asset URL availability, encoder config support, and muxer availability in `frontend/src/features/editor/services/client-export.ts:57` through `frontend/src/features/editor/services/client-export.ts:127`.
- Rust export frame request iterator exists in `frontend/editor-core/src/lib.rs:178` through `frontend/editor-core/src/lib.rs:225`.
- Export modal falls back to server export with the client fallback reason in `frontend/src/features/editor/components/dialogs/ExportModal.tsx:48` through `frontend/src/features/editor/components/dialogs/ExportModal.tsx:83`.

Missing:

- No actual `VideoEncoder` pipeline.
- No muxer dependency installed.
- No MP4 mux/write code.
- Offline audio render result is discarded.
- Audio fetch/decode failures are swallowed in `frontend/src/features/editor/services/client-export.ts:195` through `frontend/src/features/editor/services/client-export.ts:221`.
- No 30-second or 5-minute playable MP4 benchmark tests.

## Verification Ran

Passed:

```sh
cd frontend/editor-core && cargo test
```

Result: 5 Rust tests passed.

Passed:

```sh
cd frontend && bun test __tests__/unit/features/editor/preview-engine.test.ts __tests__/unit/features/editor/client-export.test.ts
```

Result: 12 Bun tests passed.

Passed:

```sh
cd frontend && bunx tsc --noEmit --pretty false
```

Result: no TypeScript errors.

## Recommended Next Steps

1. Add the benchmark fixture/report first, so WebGL2 and adaptive quality can be judged against the plan's numbers.
2. Add compositor worker tests for frame queue eviction, `VideoFrame.close()`, and context-loss fallback.
3. Decide whether the old TypeScript descriptor builder stays as a named parity test helper or gets deleted per the plan.
4. Treat client export as unfinished: install/evaluate the muxer, implement encode/mux, then add browser integration tests for playable output.
