# ReelStudio Video Editor Performance - Plan

> **Date:** 2026-04-19
> **Status:** Draft
> **Deciders:** Engineering
> **Related:** `docs/plans/rust-web-video-editor-strategy.md`, `docs/plans/editor-unified-architecture.md`

---

## 1. Problem Statement

The editor has crossed the line where React state was the main bottleneck. The refactor gives us better UI ownership boundaries, but preview performance still depends on a fragile rendering pipeline: `PreviewEngine` computes compositor descriptors on the main thread, those descriptors carry CSS transform/filter strings, and `CompositorWorker` parses those strings on every tick before drawing with Canvas 2D. Decode is already worker-based, but each active video clip can own a decoder worker and the system still has to fetch, demux, seek, decode, queue, composite, and close `VideoFrame`s under frame-budget pressure.

The forcing function is straightforward: if we add more tracks, effects, transitions, captions, and client-side export on top of this pipeline, performance bugs will become harder to debug than feature bugs. The editor needs an explicit performance architecture before Rust/WASM compositor work begins.

---

## 2. Goals & Non-Goals

**Goals**

| # | Goal | Success Looks Like |
|---|------|--------------------|
| 1 | Smooth preview playback | 1080x1920 timelines with 2 video tracks, captions, and text maintain p95 compositor time under 8ms and p95 frame interval under 40ms at 30fps on a normal laptop. |
| 2 | Fast scrubbing | Seek-to-visible-frame p95 under 200ms for cached/nearby clips and under 600ms for cold clips. |
| 3 | Bounded memory | VideoFrame queues are bounded, old frames are closed, and active decode workers stay within a fixed budget. |
| 4 | Debuggable runtime | A developer can inspect dropped frames, decode queue, compositor time, active workers, seek latency, and audio drift without adding ad hoc logs. |
| 5 | Incremental delivery | Each phase ships independently and leaves the editor usable. |
| 6 | Client export path | Standard timelines up to 5 minutes can export in browser when WebCodecs support exists; server export remains fallback. |

**Non-Goals**

| # | Non-Goal | Reason |
|---|----------|--------|
| 1 | Rewriting the React editor UI | The recent React refactor addressed state ownership; performance work should not reopen that surface. |
| 2 | Building our own codec implementation | Browser-native WebCodecs should handle decode/encode where available. |
| 3 | Removing server-side export | Long timelines, unsupported browsers, and failure recovery still need server fallback. |
| 4 | Supporting every container/codec in v1 | Start with the formats ReelStudio already creates and uploads most often. |
| 5 | Shipping all Rust/WebGL/export work in one branch | The risk is too high; every phase needs measurable rollback. |

---

## 3. Background & Context

Current runtime shape:

```
React editor UI
  -> usePreviewEngine
    -> PreviewEngine
      -> AudioMixer                       Web Audio clock + playback
      -> DecoderPool                      active video decode worker budget
        -> ClipDecodeWorker               mp4box demux + WebCodecs VideoDecoder
      -> PreviewCanvas
        -> CompositorWorker               OffscreenCanvas + Canvas 2D
```

Good pieces to keep:

- `DecoderPool` already isolates decode in workers and limits active workers with `MAX_ACTIVE_VIDEO_WORKERS` and `MAX_WORKERS_PER_ASSET_URL`.
- `ClipDecodeWorker` uses `VideoDecoder` with hardware preference, transfers `VideoFrame`s, and handles stale seek tokens.
- `CompositorWorker` already owns an `OffscreenCanvas` in a worker.
- `AudioMixer` uses Web Audio as the playback clock, which is a sensible preview authority.
- `PreviewEngineMetrics` already tracks seek count, decoded frames, dropped frames, compositor time, and audio drift.

The performance debt is concentrated in three places:

- `PreviewEngine.buildCompositorClips()` emits string-based transform/filter/clip descriptors on the main thread.
- `CompositorWorker.applyTransform()` parses CSS strings with regex and uses Canvas 2D for blend, transform, clip, text, and captions.
- Export is still server-first; client export needs a bounded, browser-native path.

---

## 4. Research Summary

**WebCodecs For Decode And Encode**

MDN describes WebCodecs as a low-level API for working with individual video frames and encoded audio/video chunks, specifically useful for video editors and apps that need full media-processing control. `VideoDecoder` and `VideoEncoder` are available in dedicated workers, but both are still marked limited availability rather than Baseline, so the plan must keep capability checks and fallback paths. The key design implication is that the browser should own codec work when supported, while ReelStudio owns scheduling, memory discipline, and fallback policy.

Sources: [MDN WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API), [MDN VideoDecoder](https://developer.mozilla.org/en-US/docs/Web/API/VideoDecoder), [MDN VideoEncoder](https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder)

**OffscreenCanvas And WebGL2 In Workers**

MDN documents `OffscreenCanvas` as a way to decouple Canvas from the DOM and run rendering work in a worker; it is transferable and widely available. MDN also notes that `WebGL2RenderingContext` is available in Web Workers and broadly supported. This supports the current worker-owned compositor direction, but points away from Canvas 2D as the long-term renderer for transforms, opacity, blending, and color effects.

Sources: [MDN OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas), [MDN WebGL2RenderingContext](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext)

**Frame Timing APIs**

`requestVideoFrameCallback()` is now Baseline 2024 and provides per-frame metadata tied to video compositing, but it runs on the main thread and is most useful when playback is driven by native `<video>` elements. ReelStudio's current design decodes clips directly with WebCodecs and composites multiple tracks, so `requestVideoFrameCallback()` is not the core clock. It is still valuable as a fallback/probe for simple single-source playback and for debugging browser timing behavior.

Source: [MDN requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)

**Audio Export And Offline Rendering**

`OfflineAudioContext` renders a Web Audio graph into an `AudioBuffer` instead of a hardware output and can render faster than realtime. That makes it the right browser-native tool for client-side audio mixdown during export, while `AudioMixer` remains the realtime preview path.

Source: [MDN OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext)

**MP4 Muxing**

The older `mp4-muxer` package is deprecated in favor of Mediabunny. Mediabunny's docs position it as a browser media toolkit for reading, writing, and converting files, with hardware-accelerated decode/encode via WebCodecs and support for MP4 and other containers. For a new client-export path, evaluate Mediabunny first instead of adding `mp4-muxer`.

Sources: [mp4-muxer deprecation notice](https://vanilagy.github.io/mp4-muxer/), [Mediabunny introduction](https://mediabunny.dev/guide/introduction), [Mediabunny supported formats/codecs](https://mediabunny.dev/guide/supported-formats-and-codecs)

---

## 5. Options Considered

### Option A: Status Quo Plus Small Tuning

Keep the current TypeScript descriptor math, worker decode pool, Canvas 2D compositor, and server export. Add minor queue-size tweaks and more logs.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low. No architecture change. |
| Performance | Limited. It may smooth small timelines but cannot remove regex transform parsing, Canvas 2D effect cost, or main-thread descriptor work. |
| Reliability | Moderate. Few changes, but existing fragile paths remain. |
| Cost | Low engineering cost now, higher debugging cost later. |
| Reversibility | Easy. |
| Stack fit | Fits current code because it changes almost nothing. |
| Team readiness | High. |

Risks: hides real bottlenecks until more editor features arrive; normalizes ad hoc performance work; keeps export server-bound.

Open questions: none. This is the easiest path and the least useful long term.

### Option B: TypeScript Matrix Compositor Without Rust

Replace CSS strings with typed matrices and numeric effect descriptors, then update `CompositorWorker` to apply Canvas 2D transforms from numbers. Keep decode and export mostly unchanged.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium. Descriptor protocol changes but no Rust build chain. |
| Performance | Better than status quo, especially by removing regex/string parsing. Still limited by Canvas 2D effects and CPU compositing. |
| Reliability | Good intermediate step because typed descriptors are testable. |
| Cost | Moderate. |
| Reversibility | Good. The descriptor protocol can feed future WebGL/Rust work. |
| Stack fit | Strong. Pure TypeScript and existing worker protocol. |
| Team readiness | High. |

Risks: can become a plateau if treated as the final compositor; Canvas 2D filter support and clipping remain uneven performance surfaces.

Open questions: how much preview improvement do typed descriptors alone deliver on real timelines?

### Option C: Rust Timeline Math + TypeScript WebGL2 Compositor

Move timeline resolution, transition interpolation, effect math, and matrix generation into Rust/WASM, but implement the GPU compositor in TypeScript using WebGL2 in `CompositorWorker`.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium-high. Adds Rust/WASM but keeps WebGL integration easier to debug in browser devtools. |
| Performance | Strong. Removes per-frame JS math/string churn and moves blend/transform/effects to GPU. |
| Reliability | Good if the Rust output is covered by golden tests and the worker protocol remains stable. |
| Cost | Higher initial setup, lower long-term complexity for timeline math. |
| Reversibility | Moderate. Descriptor protocol can fall back to TS builders during rollout. |
| Stack fit | Good. React stays UI-only; engine remains behind `PreviewEngine`. |
| Team readiness | Medium. Requires Rust/WASM comfort, but avoids `wgpu` complexity at first. |

Risks: WASM load failures, type conversion overhead if JS/Rust data crossing is too chatty, WebGL shader bugs.

Open questions: whether raw WebGL2 implementation is simpler than `wgpu` for the first production GPU compositor.

### Option D: Rust Timeline Math + Rust/WASM GPU Compositor

Move both timeline math and compositor implementation into Rust/WASM, potentially using `wgpu` or raw WebGL bindings through `web-sys`.

| Dimension | Assessment |
|-----------|------------|
| Complexity | High. Harder build pipeline, harder browser debugging, larger WASM surface. |
| Performance | Potentially strongest if implemented well. |
| Reliability | Depends heavily on tooling and browser coverage. |
| Cost | Highest. |
| Reversibility | Lower. More code moves across the JS/Rust boundary. |
| Stack fit | Conceptually aligned with the long-term architecture, but may be too much for the first performance pass. |
| Team readiness | Medium-low until a small spike proves the toolchain. |

Risks: build-tool churn, browser-specific GPU behavior, larger WASM payload, test environment mocking complexity.

Open questions: whether `wgpu` WebGL2 backend is worth the weight versus raw WebGL2 for 2D affine compositing.

### Option E: Server-Rendered Preview

Move preview rendering to the backend and stream frames/video to the browser.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Very high. Requires low-latency render infrastructure. |
| Performance | Could be strong on powerful servers but poor for interactive latency. |
| Reliability | Network-dependent; every scrub depends on server availability. |
| Cost | High ongoing infrastructure cost. |
| Reversibility | Poor. |
| Stack fit | Weak for a local-first editor. |
| Team readiness | Low. |

Risks: makes scrubbing network-bound, increases server load, introduces new queue/streaming failure modes.

Open questions: none for current scope. This is not the right direction for interactive editing.

---

## 6. Recommendation

**We recommend Option C: Rust Timeline Math + TypeScript WebGL2 Compositor**, delivered through a measurement-first ladder.

This beats the status quo because it attacks the actual expensive surfaces: main-thread descriptor math, CSS string parsing, Canvas 2D compositing, and opaque runtime behavior. It beats the pure TypeScript matrix option because it sets up the Rust timeline/export path already planned for the editor. It beats a full Rust compositor because raw WebGL2 in TypeScript is easier to debug, easier to feature-flag, and easier to roll back while still moving rendering to the GPU.

Key assumptions:

- WebCodecs remains the preferred browser-native decode/encode path for supported browsers.
- The worker message protocol can evolve from CSS strings to numeric descriptors without rewriting React.
- WebGL2 covers the required 2D transform, opacity, blend, filter, wipe, text/caption composition needs for the first GPU renderer.

Conditions that would change this recommendation:

- If the WebGL2 compositor spike takes longer than the Rust/wgpu spike to render parity frames.
- If typed TypeScript descriptors alone meet the performance targets on representative timelines.
- If client export audio requires a muxing/audio dependency that changes package strategy.

---

## 7. Implementation Plan

### Phase 0: Performance Baseline And Debug Surface

Goal: know where time goes before moving code.

Deliverables:

- Add an editor dev runtime object, gated to development builds, for `PreviewEngine.getMetrics()`, active decoder count, frame queue sizes, seek latency, and compositor worker timing.
- Add `performance.mark()` / `performance.measure()` around seek request, first decoded frame, first compositor tick, caption bitmap render, and React publish.
- Add a lightweight debug panel or console helper: `window.__REEL_EDITOR_DEBUG__.snapshot()`.
- Add a repeatable manual benchmark fixture: 1-track, 2-track transition, caption-heavy, and long-timeline cases.

Done when:

- A developer can answer "decode, compose, React, or audio clock?" from one debug snapshot.
- Baseline numbers are recorded in this doc or a sibling benchmark note.

Rollback:

- Remove the debug registration and performance marks; no runtime behavior changes.

### Phase 1: Typed Compositor Descriptor Protocol

Goal: remove string parsing from the hot path while preserving Canvas 2D rendering.

Deliverables:

- Replace `transform: string | null` with a numeric affine matrix or `{ scale, translateX, translateY, rotationDeg }`.
- Replace `filter: string | null` with numeric effect fields: `contrast`, `warmth`, eventually color matrix.
- Replace `clipPath: string | null` with typed wipe descriptors, for example `{ type: "inset"; top; right; bottom; left }`.
- Keep a compatibility adapter only during the phase; delete it before moving on.
- Add golden tests for transition opacity, transform, and wipe descriptor output.

Done when:

- `CompositorWorker.applyTransform()` has no regex parsing.
- Existing preview engine tests pass.
- Canvas 2D compositor output behavior remains unchanged.

Rollback:

- Re-enable the old descriptor builder behind a local feature flag while keeping tests for the new descriptor model.

### Phase 2: Decode Scheduler Hardening

Goal: make scrubbing predictable under multi-clip load.

Deliverables:

- Keep `DecoderPool` worker budgeting, but expose active worker count and per-asset worker count in metrics.
- Add seek-latency tracking per clip: request time, first accepted `FRAME`, stale-frame drops.
- Add a small global LRU for demux/keyframe metadata by `assetUrl`, so multiple clip instances of the same asset do not rebuild the same keyframe index.
- Consider range-fetch demux after measuring full-file fetch cost; do not implement range loading until the baseline proves it matters.
- Keep the compositor frame queues bounded and assert that every replaced/dropped `VideoFrame` is closed.

Done when:

- Scrub benchmarks have p95 latency targets and metrics explain outliers.
- Duplicate clips using the same asset avoid duplicated metadata work.

Rollback:

- Disable metadata cache and fall back to per-worker demux.

### Phase 3: Rust Timeline Core

Goal: move deterministic timeline math out of JavaScript and make frame descriptors stable across preview and export.

Deliverables:

- Create `editor-core/` Rust crate with `wasm-bindgen` and serde bindings.
- Implement `compute_duration`, `sanitize_no_overlap`, `resolve_frame`, and `build_compositor_descriptors`.
- Keep `PreviewEngine` as the only WASM entry point in the React app.
- Add Rust golden tests using serialized timeline fixtures from current TypeScript tests.
- Add a TypeScript fallback path until Rust parity is proven, then delete the fallback.

Done when:

- Rust and current TypeScript descriptor output match on golden fixtures.
- Preview uses Rust descriptors behind `PreviewEngine`.
- No React component imports WASM directly.

Rollback:

- Switch `PreviewEngine` back to the TypeScript descriptor builder for the release while keeping the Rust crate in-tree.

### Phase 4: WebGL2 Compositor In `CompositorWorker`

Goal: move blending, transforms, effects, and transition wipes to GPU.

Deliverables:

- Keep the worker protocol stable: `INIT`, `RESIZE`, `FRAME`, `TICK`, `OVERLAY`, `CLEAR_CLIP`, `DESTROY`.
- Initialize WebGL2 from the existing `OffscreenCanvas`.
- Upload/refresh textures from `VideoFrame`s and render sorted clip quads.
- Apply transform matrix, opacity, contrast, warmth, and wipe uniforms in shaders.
- Keep text overlays and caption bitmaps on a 2D overlay path initially; move them to texture layers only after video parity.
- Add Canvas 2D fallback if WebGL2 context creation fails.

Done when:

- The same fixture timelines render with Canvas 2D and WebGL2 within visual tolerance.
- Compositor p95 is below target on the benchmark fixture.
- WebGL context loss is handled by fallback or re-init.

Rollback:

- Feature flag returns to Canvas 2D compositor.

### Phase 5: Adaptive Preview Quality

Goal: preserve interaction quality under load instead of stalling.

Deliverables:

- Add preview quality levels: full, half, low.
- During scrubbing, optionally render at lower scale and restore full quality when idle.
- Lower decode window or active worker budget under memory pressure.
- Add a dropped-frame threshold that temporarily disables nonessential effects in preview, never in export.

Done when:

- Heavy timelines stay interactive even if full-quality playback would miss frames.
- UI clearly distinguishes preview quality from export quality in dev/debug tooling.

Rollback:

- Disable adaptive quality and use full-quality preview always.

### Phase 6: Client-Side Export V1

Goal: export standard short timelines without server jobs when browser support exists.

Deliverables:

- Add `ExportPipeline` timeline iterator in Rust: frame index -> frame request(s).
- Use WebCodecs `VideoEncoder` for video when available.
- Use `OfflineAudioContext` to render the audio graph into an `AudioBuffer`.
- Evaluate Mediabunny as the muxer before adding a dependency; do not add deprecated `mp4-muxer` unless there is a compelling reason.
- Gate client export on capability checks: `VideoEncoder`, supported codec config, muxer availability, timeline duration, and memory budget.
- Keep server export fallback for unsupported browsers, long timelines, and failures.

Done when:

- A 30-second and 5-minute benchmark timeline export to playable MP4 with correct duration, resolution, fps, and audio sync.
- Failed client export falls back to server export with a clear reason.

Rollback:

- Disable client export gate; server export remains the only path.

---

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | WebCodecs unavailable or codec config unsupported | Medium | High | Capability checks, server export fallback, simple-preview fallback where possible. |
| 2 | WebGL2 compositor has browser-specific bugs | Medium | High | Canvas 2D fallback, visual fixtures, feature flag rollout. |
| 3 | WASM boundary overhead eats Rust gains | Medium | Medium | Pass compact typed descriptors, avoid per-clip chatty calls, benchmark before migration. |
| 4 | VideoFrame leaks cause GPU memory blowups | Medium | High | Centralize frame ownership rules, assert close paths in worker tests, expose queue sizes. |
| 5 | Audio export drifts from video export | Medium | High | Use frame-indexed export timeline and `OfflineAudioContext`; test known duration fixtures. |
| 6 | Adaptive preview hides real export output | Low | Medium | Make adaptive quality preview-only and visible in debug UI. |
| 7 | Adding a muxing library increases bundle cost | Medium | Medium | Evaluate tree-shaking and lazy-load export code only when modal starts export. |

---

## 9. Success Criteria

| Goal | Metric | Baseline | Target | How Measured |
|------|--------|----------|--------|--------------|
| Smooth playback | p95 compositor frame time | TBD Phase 0 | <8ms at 1080x1920, 30fps | `PreviewEngineMetrics` + worker measures |
| Smooth playback | dropped frames per 60s playback | TBD Phase 0 | <30 on benchmark timeline | audio-clock frame-budget counter |
| Fast scrubbing | seek-to-visible p95 | TBD Phase 0 | <200ms warm, <600ms cold | seek marks |
| Bounded memory | active VideoFrame queue size | TBD Phase 0 | <=16 per active clip, explicit close on eviction | worker debug snapshot |
| Worker budget | active decode workers | Current guarded by constants | within configured limit, no accidental duplicates per asset | `DecoderPool` debug metrics |
| Export | 5-minute client export | no client export | succeeds when capabilities pass | export integration fixture |

---

## 10. Open Questions

| # | Question | Owner | Needed By | Status |
|---|----------|-------|-----------|--------|
| 1 | Which browser/device matrix is the minimum target for client export? | Engineering/Product | Phase 6 | Open |
| 2 | Do we choose raw WebGL2 or `wgpu` after the WebGL2 spike? | Engineering | Phase 4 | Open |
| 3 | Should export V1 include audio, or should silent video export ship first behind a flag? | Engineering/Product | Phase 6 | Open |
| 4 | What benchmark media set represents real ReelStudio projects? | Engineering | Phase 0 | Open |
| 5 | Should uploads/transcodes normalize source codec/resolution server-side to reduce browser decode variance? | Engineering | Phase 2 | Open |

---

## 11. Alternatives Rejected

| Option | Why Rejected |
|--------|--------------|
| Status quo only | Leaves the string-parsing compositor and server-only export path in place. |
| Full Rust compositor first | Too much build/tooling/debugging risk before proving typed descriptors and WebGL2 parity. |
| Server-rendered interactive preview | Makes scrubbing network-bound and increases infrastructure cost. |
| `ffmpeg.wasm` as the default path | Large payload and slower startup; better as an edge-case fallback than the primary architecture. |
| Deprecated `mp4-muxer` as the default new dependency | It is superseded by Mediabunny, so new export work should evaluate Mediabunny first. |

---

## Ship-It Summary

Do this in order:

1. Measure the current engine and expose one debug snapshot.
2. Replace CSS strings with typed numeric descriptors.
3. Harden decode scheduling and shared asset metadata.
4. Move timeline/transition/effect math to Rust/WASM.
5. Replace Canvas 2D video compositing with WebGL2 in the existing worker.
6. Add adaptive preview quality.
7. Add client export through WebCodecs, `OfflineAudioContext`, and a modern muxer, with server fallback.

The important discipline is sequencing. Do not start with client export or a full Rust compositor. First make the preview engine measurable and typed; then GPU and Rust work becomes a controlled migration instead of a heroic rewrite.
