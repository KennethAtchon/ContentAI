# Editor Preview Engine — Ground-Up Rewrite Plan

> **Date:** 2026-04-09
> **Status:** Draft
> **Deciders:** Studio frontend owner, product owner

## 1. Problem Statement

The current preview system is architecturally incompatible with smooth video playback. It works by running a JavaScript `requestAnimationFrame` clock, writing time into React state 60 times per second, letting React re-render `PreviewStageRoot` and all its children on every tick, and then running an imperative `usePreviewMediaSync` effect that compares the JS clock against `HTMLVideoElement.currentTime` and calls `element.currentTime = targetTime` whenever drift exceeds 100 ms. On paper this sounds tolerable. In practice it is not, for reasons that cannot be patched away:

`HTMLMediaElement.currentTime` is not a position property — it is a seek command. Every assignment interrupts the browser's internal decode pipeline, causes a buffer flush, and forces a key-frame search. During 1x forward playback this fires repeatedly because the JS clock drifts against the media clock even when nothing is wrong, which means the browser is executing seeks during what should be silent steady-state playback. Audio comes from the same `<video>` elements that are being seek-corrected, so every seek is also an audible glitch. Meanwhile the rAF → React state → re-render chain runs at full frame rate, keeping the entire editor shell in a React diffing loop sixty times per second even while the user is simply watching a clip play. More features (captions, effects, AI overlays) mean more components in that tree and exponentially more wasted main-thread work.

These are not bugs that can be fixed with a threshold tweak or a useMemo. The model is wrong: it uses the browser's media element as a visual surface while simultaneously fighting its own internal clock. Professional browser editors — CapCut, Runway, Diffusion Studio — do not do this. They decode frames with `VideoDecoder`, composite on `OffscreenCanvas`, and use the `AudioContext` hardware clock as the master timeline. That is the only architecture that produces smooth, frame-accurate, audio-stable preview in a browser.

The existing preview code — `usePreviewPlaybackBridge`, `usePreviewMediaSync`, `usePreviewMediaRegistry`, `preview-scene.ts`, `PreviewStageRoot`, `PreviewStageSurface` — must be completely deleted and replaced. The timeline data model, reducer, autosave, and export pipeline do not need to change. Only the preview runtime is being replaced.

## 2. Goals & Non-Goals

**Goals**

| # | Goal | Success Looks Like |
|---|------|--------------------|
| 1 | Frame-accurate, glitch-free 1x playback | No seek commands during steady forward playback. Video and audio stay locked. |
| 2 | Zero frame-rate React re-renders | The React tree does not re-render at the display frame rate. Canvas is updated imperatively. |
| 3 | Audio-clock-driven sync | `AudioContext.currentTime` is the master clock. Video frames are scheduled against it, not the other way around. |
| 4 | Decoder work off the main thread | `VideoDecoder` and `AudioDecoder` run in a `Worker`. Main thread only composites to `<canvas>`. |
| 5 | Correct seek and scrub behavior | Scrubbing decodes to the exact target frame without audible artifacts. |
| 6 | Full deletion of the old runtime | No legacy paths, no feature flags preserving broken code, no backwards shims. |

**Non-Goals**

| # | Non-Goal | Reason |
|---|----------|--------|
| 1 | Change the export pipeline | Export runs server-side. Only the browser preview is being replaced. |
| 2 | Change the timeline data model or reducer | The model is sound. This plan touches only the preview runtime. |
| 3 | Build a full professional NLE with multi-cam, LUT grading, etc. | Those are future product decisions. This rewrite establishes the correct foundation; it does not need to solve features that do not yet exist. |
| 4 | Perfect reverse or extreme-rate (>4x) playback | Browser decoders are not designed for this. Graceful degradation is acceptable; promising parity is not. |
| 5 | Mobile browser support beyond best effort | The editor is a desktop-class tool. Mobile is not a primary runtime target for this plan. |

## 3. Background & Context

### What works and is not being replaced

- `editorReducer` and the full state model in `frontend/src/features/editor/model/` — correct and stable.
- `getClipSourceTimeSecondsAtTimelineTime()` in `editor-composition.ts` — the math is right.
- `useEditorAssetMap` — asset URL resolution stays. The new engine will receive asset URLs from the same source.
- Autosave, undo/redo, timeline interactions, keyboard shortcuts, export — untouched.

### Files that must be deleted entirely

| File | Why |
|------|-----|
| `runtime/usePreviewPlaybackBridge.ts` | Replaced by the audio-clock-driven engine. |
| `runtime/usePreviewMediaSync.ts` | The entire seek-correction loop disappears. |
| `runtime/usePreviewMediaRegistry.ts` | No more DOM media element registry. |
| `scene/preview-scene.ts` | The concept of deriving a "mount window" of `<video>` elements is gone. |
| `renderers/PreviewStageSurface.tsx` | HTML media element renderer replaced by a `<canvas>`. |
| `preview-root/PreviewStageRoot.tsx` | Replaced by `PreviewCanvas` + `usePreviewEngine`. |

### Current broken flow (for reference only — this is being deleted)

```
rAF tick (60fps) →
  setPreviewCurrentTimeMs() →
    React re-renders PreviewStageRoot + children →
      usePreviewMediaSync effect fires →
        element.currentTime = targetTime   ← seek command, also glitches audio
        element.play() / element.pause()   ← browser must restart decode
```

### Current state of the browser platform (2026)

- `VideoDecoder` (WebCodecs): supported in Chrome, Edge, Firefox, Safari.
- `AudioDecoder` (WebCodecs): supported in Chrome, Edge, Firefox. Safari: VideoDecoder only; AudioDecoder is not available as of this writing — fallback required.
- `OffscreenCanvas`: supported in all major browsers.
- `AudioContext` / `AudioWorklet`: supported everywhere.
- `VideoFrame` is transferable between Workers.
- `mp4box.js` (GPAC) and `web-demuxer` (Bilibili/ForeverSc) are the two production-grade browser demuxers.

## 4. Research Summary

**WebCodecs VideoDecoder architecture and seeking**

WebCodecs gives a `VideoDecoder` that accepts `EncodedVideoChunk` objects and calls an `output` callback with decoded `VideoFrame` objects. The decoder is asynchronous and processes chunks in order; `flush()` awaits all pending work. The critical constraint for editors: after `flush()` or `reset()`, the next chunk fed to the decoder must be a keyframe (IDR frame). This means seeking requires finding the preceding keyframe in the GOP (Group of Pictures), resetting the decoder, and feeding all chunks from that keyframe up to the target frame to reconstruct inter-frame dependencies. Skipping this step produces corrupted output. For a 30fps asset with a 2-second GOP (60 frames), a seek to a non-keyframe requires decoding up to 59 throwaway frames before the target frame is available. Decoder work should run entirely in a Worker thread; `VideoFrame` is transferable, so decoded frames can be posted to the compositor without copying pixel data.

- Sources: [Chrome Developers — Video processing with WebCodecs](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs) · [w3c/webcodecs — frame-stepping/random access seeking #396](https://github.com/w3c/webcodecs/issues/396) · [MDN — WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)

**AudioContext as the master clock**

The Web Audio API's `AudioContext.currentTime` ticks against the audio hardware clock, not `performance.now()` or `Date.now()`. This is the most stable reference available in a browser — it is not throttled, not coarse-grained, and not subject to the jitter that affects JS timers and rAF. The correct sync model for audio-visual preview is: audio is authoritative, video frames are scheduled to arrive when the corresponding audio sample reaches the speaker. `AudioContext.outputLatency` provides the hardware pipeline delay; subtracting it from `currentTime` gives the contextTime of the audio currently audible. Video frames should target that time value, not the rAF wall-clock time. An `AudioWorklet` running on the audio rendering thread can emit a timing pulse or expose the precise sample position for frame scheduling, completely bypassing main-thread timer jitter.

- Sources: [web.dev — Synchronize audio and video playback](https://web.dev/articles/audio-output-latency) · [sonoport.github.io — Understanding the Web Audio Clock](https://sonoport.github.io/web-audio-clock.html) · [MDN — BaseAudioContext.currentTime](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime)

**CapCut's production WebCodecs migration**

CapCut ported their C++ editing engine to WebAssembly via Emscripten and integrated WebCodecs for hardware-accelerated decode/encode. The migration improved audio and video processing speed by approximately 300% and enabled real-time multi-stream 4K editing that was impossible with `HTMLVideoElement`. The case study makes clear that the bottleneck at scale is raw decode throughput — even SIMD-optimized software decode of a 4K frame takes tens of milliseconds. WebCodecs hardware-acceleration is not a nice-to-have; it is load-bearing for anything beyond 1080p source assets. CapCut moved entirely away from browser media elements for their edit preview.

- Source: [web.dev case study — CapCut boosts organic traffic 83% with WebAssembly and WebCodecs](https://web.dev/case-studies/capcut)

**Diffusion Studio Core: browser video compositing engine design**

Diffusion Studio Core describes itself as "a game engine optimized for video, audio and image workloads." It uses WebCodecs for hardware-accelerated decode, Canvas 2D for compositing decoded frames, and provides both an interactive playback mode for editing and a high-fidelity rendering mode for export — the same data model serves both. This is the right mental model: the preview engine and the render pipeline share a compositor; they differ only in whether they run in real time or as fast as the decoder can go. The library supports keyframing, transitions, speed ramps, effects, captions, and masking — all the capabilities needed by this editor.

- Source: [github.com/diffusionstudio/core](https://github.com/diffusionstudio/core)

**Replit: time virtualization for deterministic browser rendering**

Replit's approach to browser-based video rendering patches JavaScript timing APIs (`setTimeout`, `requestAnimationFrame`, `Date.now`, `performance.now`) to replace wall-clock time with a synthetic virtual clock that advances exactly `1000/fps` ms per frame. This decouples rendering quality from rendering speed: a 500ms-to-render frame still contributes to a 60fps output stream from the browser's perspective. For an interactive editor, we do not need full time virtualization, but the core principle applies: the preview clock must be controlled and monotonic. Letting `rAF` timestamps drive playback time introduces jitter that seeks and corrections only amplify. The audio clock is our equivalent of their virtual time source.

- Source: [blog.replit.com — We Built a Video Rendering Engine by Lying to the Browser About What Time It Is](https://blog.replit.com/browsers-dont-want-to-be-cameras)

**WebCodecs + Streams pipeline design and Worker threading**

The WebRTC Hacks pipeline article establishes the canonical pattern: a single Worker owns all `VideoFrame` objects and stream manipulation. Multiple Workers sharing frames via `postMessage` create an unsolvable problem — it is impossible to know when to call `frame.close()` because serialization timing is non-deterministic, and exhausting the hardware decoder's fixed-size frame buffer pool causes silent pipeline freezes. Backpressure through WHATWG Streams is the correct flow control mechanism; breaking the chain with `MediaStreamTrack` disables backpressure and causes frames to be silently dropped.

- Source: [webrtchacks.com — Real-Time Video Processing with WebCodecs and Streams](https://webrtchacks.com/real-time-video-processing-with-webcodecs-and-streams-processing-pipelines-part-1/)

## 5. Options Considered

**Option A: Do nothing / incremental patching of the current engine**

Keep `HTMLVideoElement`-based preview, seek-correction loop, and rAF React state updates. Apply targeted fixes: raise the seek threshold, debounce React renders, mute embedded audio.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Very low — only config and threshold changes. |
| Performance | Marginally better at best. The seek-on-drift model is structurally wrong; raising the threshold trades correction frequency for larger visible drift. |
| Reliability | Remains poor. Audio glitches, seek interruptions, and render churn are symptoms of the model, not of specific threshold values. |
| Cost | Lowest immediate engineering cost; highest accumulated debugging cost as features pile onto a broken foundation. |
| Reversibility | Trivially reversible — nothing changes. |
| Stack fit | Fits the existing code only because it is already there. |
| Team readiness | High, but readiness does not justify keeping a model that cannot produce smooth playback. |

Risks: Every new feature added to the editor increases main-thread pressure and makes playback worse. The editor becomes unreliable by design. This option has no long-term path to smooth preview.

Open questions: None. This is explicitly the rejected path.

---

**Option B: Hybrid — keep HTMLVideoElement visuals, decouple audio into Web Audio graph**

Keep `<video>` elements for visual display but mute them and route audio through dedicated `<audio>` elements connected to an `AudioContext` graph. Reduce seek frequency by raising thresholds. Keep the rAF → React state loop.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium — Web Audio routing has CORS, autoplay, and Safari AudioContext resume constraints. |
| Performance | Better audio continuity since audio is no longer attached to seek-corrected video elements. But the rAF → React re-render loop and seek-on-drift model remain. Visual seek glitches persist. |
| Reliability | Medium. Fixes the audio-from-`<video>` coupling but does not fix the JS clock model or unnecessary seeking. |
| Cost | Lower than Option C in the short term; higher in the medium term because the fundamental problems remain. |
| Reversibility | High — changes are additive and can be flagged. |
| Stack fit | Fits the current architecture by extending it. |
| Team readiness | High. |

Risks: CORS on signed R2 URLs complicates `createMediaElementSource()`. Safari's `AudioContext.resume()` requires a user gesture and its resumption behavior differs from Chrome. The rAF-driven React tree still rerenders at 60fps. This is the old plan's Option C and still treats symptoms rather than the disease.

Open questions: Would audio isolation alone make playback acceptable? Answer: No — visual seek glitches remain, and the 60fps React render loop remains.

---

**Option C: Full rewrite — WebCodecs decode pipeline + OffscreenCanvas compositor + AudioContext master clock**

Delete the current preview runtime entirely. Build a `PreviewEngine` class that owns the decode pipeline, compositor, and audio mixer. React provides a single `<canvas>` element and calls `engine.play()`, `engine.seek(ms)`, `engine.update(timeline)`. The engine does everything else imperatively, off the React render cycle.

| Dimension | Assessment |
|-----------|------------|
| Complexity | High. WebCodecs seek semantics, GOP-aware demuxing, Worker threading, OffscreenCanvas compositing, and AudioContext timing all need careful implementation. |
| Performance | Definitively correct. No seeks during steady playback. No main-thread React renders at frame rate. Hardware-accelerated decode. Audio-clock-driven. |
| Reliability | High — the engine owns the full pipeline with no competing imperative loops. |
| Cost | 2–4 weeks of focused frontend engineering. No backend changes. |
| Reversibility | Low after commitment — but there is nothing worth preserving in the old runtime, so rollback risk is minimal. |
| Stack fit | Strong. WebCodecs, OffscreenCanvas, and AudioContext are standard browser APIs. Safari AudioDecoder absence requires one fallback path. |
| Team readiness | Medium. WebCodecs and Worker message passing require learning, but the API surface is well-documented and has prior art. |

Risks:
- Safari `AudioDecoder` is unavailable — audio decode needs an HTMLAudioElement fallback for Safari. Medium likelihood, high importance to handle correctly.
- GOP-aware seeking requires a demuxer that exposes the keyframe index. `mp4box.js` or `web-demuxer` needed as a dependency. Low risk if chosen upfront.
- `OffscreenCanvas` transferToImageBitmap per frame has non-zero cost on complex compositions. Measure early.
- The engine needs to handle asset URL changes, track mutations, and speed/trim changes mid-playback without corrupting decoder state.

Open questions:
- Which demuxer: `mp4box.js` (MP4-only, well-tested) or `web-demuxer` (broader format support, newer)? Must decide before Phase 1.
- Should the decoder pool be one Worker per clip or a shared pool? One-per-clip is simpler for ownership but wastes resources on dense timelines. Pool is better at scale.
- How to handle captions and text overlays in the compositor? Canvas 2D text rendering is straightforward, but caption layout engine currently runs on the main thread via `useCaptionCanvas` — that hook needs to be adapted.

---

**Option D: Adopt Diffusion Studio Core or similar open-source engine as-is**

Integrate `@diffusionstudio/core` as a dependency and drive it from the existing timeline model.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium upfront — API mapping. High over time — opaque dependency, breaking changes risk. |
| Performance | The library uses the right primitives. Performance would be comparable to Option C. |
| Reliability | Dependent on library maintenance. We cannot fix pipeline bugs in production ourselves. |
| Cost | Lower initial cost, higher long-term cost from dependency ownership risk. |
| Reversibility | Low — once the editor is deeply integrated with a third-party engine API, switching is a full rewrite. |
| Stack fit | Moderate — the library API may not map cleanly to our timeline model (trimStartMs, speed, source time math). |
| Team readiness | Medium — learning the library API vs. learning the browser APIs directly. |

Risks: The library is MIT-licensed but not a stable widely-adopted standard. Adopting it locks the editor's core behavior to someone else's maintenance schedule. Option C gives full ownership over the most critical piece of the editor. Option D is only worthwhile if the team cannot invest the engineering time for Option C.

Open questions: Minimal — this is essentially a build-vs-buy question and the answer is build given how precisely the engine needs to map to our specific timeline model.

## 6. Recommendation

**We recommend Option C: Full rewrite with WebCodecs + OffscreenCanvas + AudioContext master clock.**

This wins over Option A and B because both of those preserve the structural error: a JS clock fighting an internal browser media clock, with audio attached to the wrong element. No amount of threshold tuning or additive audio routing fixes the seek-on-drift model. It will never produce a smooth preview because smooth preview requires that the browser's own media clock drives everything — you do not fight it with corrections, you use it as the authoritative reference.

It wins over Option D because the engine must map precisely to this editor's timeline model (trimStartMs, speed multipliers, multi-track layering, transition windows) and must integrate with the existing asset URL resolution, caption system, and React component tree. A general-purpose library would need to be adapted so deeply that we would be maintaining a fork.

The recommendation rests on three assumptions: (1) the team can invest approximately 3 weeks of focused frontend engineering, (2) Safari's partial WebCodecs support (no AudioDecoder) is handled with an explicit HTMLAudioElement fallback rather than treated as a blocker, and (3) the demuxer dependency decision (mp4box.js vs web-demuxer) is made before Phase 1 begins.

## 7. Implementation Plan

### Phase 0: Erase the Old Runtime

**Goal and done criteria.** Every file in the old preview runtime is deleted. The editor compiles and the preview area shows a blank canvas placeholder. No seek-correction logic remains.

Deliverables:

- [ ] Delete `runtime/usePreviewPlaybackBridge.ts`
- [ ] Delete `runtime/usePreviewMediaSync.ts`
- [ ] Delete `runtime/usePreviewMediaRegistry.ts`
- [ ] Delete `scene/preview-scene.ts`
- [ ] Delete `renderers/PreviewStageSurface.tsx`
- [ ] Delete `preview-root/PreviewStageRoot.tsx`
- [ ] Remove `previewCurrentTimeMs` from `useEditorLayoutRuntime` — the engine will own playhead time
- [ ] Add a placeholder `<PreviewCanvas>` component: a `<canvas>` element with a gray background and "Preview engine loading" text, accepting a `ref`
- [ ] The editor compiles with zero TypeScript errors and the preview area renders the placeholder

Dependencies: None.

Risks: Removing `previewCurrentTimeMs` from `useEditorLayoutRuntime` means the playhead timecode display and timeline scrub indicator need a temporary static value. Wire them to `store.state.currentTimeMs` (the reducer's value) as a stopgap — this is fine since there is no playing yet.

Rollback plan: The old files are in git. Reverting this phase is a single `git revert`. There is no production traffic to protect.

---

### Phase 1: Demuxer Integration and Clip Decode Worker

**Goal and done criteria.** A `Worker` can receive an asset URL and a time range, demux the container, and emit decoded `VideoFrame` objects at correct timestamps. Seeking to an arbitrary frame works correctly (GOP-aware). The worker handles configure, decode, flush, and reset lifecycle correctly.

Architecture:

```
Main thread
  PreviewEngine
    → worker.postMessage({ type: 'LOAD', assetUrl, clipMeta })
    → worker.postMessage({ type: 'SEEK', targetMs })
    → worker.postMessage({ type: 'PLAY' })
    ← worker messages: { type: 'FRAME', frame: VideoFrame, timestampUs: number }

Worker (ClipDecodeWorker.ts)
  Demuxer (mp4box.js)  →  VideoDecoder  →  frame queue  →  postMessage FRAME
  AudioDecoder (where available)  →  AudioData queue  →  postMessage AUDIO_CHUNK
```

Deliverables:

- [ ] Choose and add demuxer dependency: `mp4box.js` for Phase 1 (MP4/MOV assets only, which covers all current asset types). `web-demuxer` can be evaluated in Phase 3 if broader format support is needed.
- [ ] Create `frontend/src/features/editor/engine/ClipDecodeWorker.ts`:
  - Accepts `LOAD` message: fetch asset URL, initialize demuxer, extract keyframe index, configure `VideoDecoder` and `AudioDecoder` (with Safari fallback: skip `AudioDecoder`, post audio start time instead).
  - Accepts `SEEK` message: flush decoder, find nearest preceding keyframe in index, feed chunks from keyframe to target, post `FRAME` messages as frames are decoded.
  - Accepts `PLAY` message: enter continuous decode mode — feed chunks ahead of playback position, post frames as they are ready.
  - Accepts `PAUSE` message: stop feeding chunks. Do not flush.
  - Accepts `DESTROY` message: `decoder.reset()`, close worker.
  - Always calls `frame.close()` after posting (frame is transferred, not copied).
- [ ] Create `frontend/src/features/editor/engine/DecoderPool.ts`: manages one `ClipDecodeWorker` per active clip, creates/destroys workers as clips enter/leave the playhead window, routes frames to the compositor.
- [ ] Unit test: given a known test asset, seek to frame at 1.5s, receive a `VideoFrame` with timestamp ≈ 1.5s ± one frame. Test in a Jest/jsdom environment with a mocked Worker or in a real browser test.

Dependencies: demuxer library decision.

Risks: 
- Fetching asset URLs from a Worker requires CORS headers on R2. Test cross-origin fetch from a Worker context early. If headers are not present, use a same-origin proxy endpoint (the existing `/api/media` route is sufficient).
- Safari's `AudioDecoder` absence: the worker must detect `typeof AudioDecoder === 'undefined'` and skip audio decode silently. Audio for Safari falls back to `HTMLAudioElement` in Phase 3.

Rollback plan: The decode worker is not yet wired to the visible preview. Deleting the worker files reverts this phase cleanly.

---

### Phase 2: OffscreenCanvas Compositor

**Goal and done criteria.** A `CompositorWorker` receives `VideoFrame` objects from the `DecoderPool`, composites the active frames for a given playhead time, draws text overlays and filter transforms (scale, position, opacity, contrast, warmth), and posts an `ImageBitmap` to the main thread for display. The `<canvas>` in `PreviewCanvas` shows composed video.

Architecture:

```
CompositorWorker (OffscreenCanvas)
  frameQueues: Map<clipId, VideoFrame[]>    ← receives frames from DecoderPool
  onTick(audioTimeMs):
    for each active clip at audioTimeMs:
      pick correct frame from queue (nearest timestamp ≤ audioTimeMs)
      drawImage(frame, x, y, w, h) with CSS transforms replicated as canvas transforms
      apply contrast/warmth via compositeOperation or ImageData filter
      close used frames
    drawText overlays
    postMessage({ type: 'BITMAP', bitmap: canvas.transferToImageBitmap() })

Main thread PreviewCanvas:
  onmessage BITMAP:
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
```

Deliverables:

- [ ] Create `frontend/src/features/editor/engine/CompositorWorker.ts`:
  - Receives an `OffscreenCanvas` transferred from the main thread on init.
  - Accepts `FRAMES` messages: stores incoming `VideoFrame` objects in per-clip queues, sorted by timestamp.
  - Accepts `TICK` messages: composites current frames for the given playhead time and posts an `ImageBitmap`.
  - Applies clip transforms (scale, position, rotation, opacity) as `ctx.save()` / `ctx.restore()` blocks.
  - Applies filter effects (contrast, warmth) as canvas filter strings.
  - Handles clip ordering by z-index (track order).
  - Prunes old frames from each queue (frames whose timestamp is more than one frame behind playhead time are closed and discarded).
- [ ] Update `PreviewCanvas.tsx` to transfer its `OffscreenCanvas` to the `CompositorWorker` and render received `ImageBitmap` objects to a visible `<canvas>`.
- [ ] Wire `DecoderPool` → `CompositorWorker` frame transfer.
- [ ] At this point: with a static timeline and no audio clock yet, verify the compositor renders a correct frame when `TICK` is sent manually with a specific timestamp.

Dependencies: Phase 1 complete.

Risks:
- `canvas.transferToImageBitmap()` plus `ctx.drawImage()` on every frame has measurable cost. If it exceeds one frame budget (~16ms at 60fps), transfer to `VideoFrame` directly via `ImageBitmapRenderingContext` instead.
- Canvas 2D filter strings for warmth and contrast effects may have browser-specific quirks. Test on Chrome and Safari.

Rollback plan: Remove the compositor worker and PreviewCanvas wiring. The editor returns to the Phase 0 placeholder state.

---

### Phase 3: AudioContext Master Clock and Audio Mixer

**Goal and done criteria.** `AudioContext.currentTime` drives the preview clock. Audio plays smoothly from dedicated `AudioBufferSourceNode` (or `HTMLAudioElement` on Safari) objects. Video compositor ticks are triggered by the audio clock, not by rAF. Play, pause, and seek all work correctly.

Architecture:

```
PreviewEngine
  audioContext: AudioContext              ← single shared context, resumed on user gesture
  masterGainNode: GainNode               ← master volume
  trackMixerNodes: Map<trackId, GainNode>  ← per-track mute/volume

  For each audio/music clip (and video clip audio where useClipAudio is true):
    Chrome/Firefox: AudioDecoder → AudioData → AudioBufferSourceNode scheduled at clip.startMs
    Safari: HTMLAudioElement → createMediaElementSource() → trackMixerNode

  Clock source:
    audioContext.currentTime + baseLatency = audible clock
    rAF loop reads audioContext.currentTime → sends TICK to CompositorWorker
    rAF also publishes currentTimeMs to React ~4 times/second for UI (playhead, timecode display)
```

Key insight: rAF is still used here, but only to read `audioContext.currentTime` and tick the compositor. It does not write to React state at frame rate. The React tree sees a time update at ~4 Hz (every ~250ms), not 60 Hz.

Deliverables:

- [ ] Create `frontend/src/features/editor/engine/AudioMixer.ts`:
  - Owns a single `AudioContext`.
  - On `play(startMs)`: for each audio/music clip active at or near `startMs`, schedule an `AudioBufferSourceNode` with `start(startTimeInContext, offsetInBuffer)` where offset accounts for `clip.trimStartMs` and `clip.speed`.
  - On `pause()`: `audioContext.suspend()` or stop all scheduled sources and record position.
  - On `seek(ms)`: stop all sources, re-schedule from new position.
  - On `trackMute(trackId, muted)`: adjust gain on track mixer node (does not require rescheduling).
  - Safari fallback: use `HTMLAudioElement` per clip, `createMediaElementSource()`, and set `.currentTime` only on seek (not during steady playback).
  - Exposes `getAudibleTimeMs(): number` = `(audioContext.currentTime - startContextTime) * 1000 + seekOriginMs`, compensated for `baseLatency`.
- [ ] Create `frontend/src/features/editor/engine/PreviewEngine.ts` (top-level class):
  - `constructor(canvasRef, timeline, assetUrlMap)`: init `AudioMixer`, `DecoderPool`, `CompositorWorker`.
  - `play()`: resume `AudioContext`, start decode workers, enter rAF loop.
  - `pause()`: suspend `AudioContext`, stop rAF loop, notify React of final position.
  - `seek(ms)`: flush decoders, re-seek audio, send a single `TICK` to compositor to show correct frame.
  - `update(timeline, assetUrlMap)`: called on every editor edit. Pauses playing if needed, resyncs clip state without destroying decoders for unaffected clips.
  - `destroy()`: terminate all workers, close `AudioContext`.
  - rAF loop: reads `audioMixer.getAudibleTimeMs()`, sends `TICK` to compositor, publishes to React every 250ms.
- [ ] Create `frontend/src/features/editor/hooks/usePreviewEngine.ts`:
  - Creates `PreviewEngine` once per editor mount (using `useRef` + `useEffect`).
  - Calls `engine.update(timeline, assetUrlMap)` whenever tracks or assetUrlMap change.
  - Calls `engine.play()` / `engine.pause()` when `store.state.isPlaying` changes.
  - Calls `engine.seek(ms)` when `store.state.currentTimeMs` changes and the engine is not playing (i.e., scrub/explicit seek).
  - Exposes `playheadMs: number` state updated at ~4 Hz for playhead display and timecode.
  - On engine playback end, calls `store.setPlaying(false)`.
- [ ] Replace `<PreviewStageRoot>` usage in `EditorLayout` / `EditorWorkspace` with `<PreviewCanvas ref={canvasRef} />` + `usePreviewEngine`.
- [ ] Text overlays and captions: the compositor worker receives text and caption data with the `TICK` message and renders them via `ctx.fillText` / canvas operations. The existing caption layout engine output (word positions, colors, animation) must be adapted to a serializable message format passable to the worker.

Dependencies: Phases 1–2 complete. Decision on Safari audio fallback approach.

Risks:
- `AudioContext.resume()` must be called from a user gesture. The first `play()` call will handle this. Safari is stricter — test that `resume()` from a button click handler works before relying on it.
- For Chrome: `AudioDecoder` + `AudioBufferSourceNode` requires buffering decoded audio before scheduling, which adds latency on scrub. Pre-decode ~500ms of audio ahead of the playhead.
- For clips with speed != 1.0: audio playback rate must be set on the source node. Pitch shifting is not required.

Rollback plan: This phase completes the engine. If it needs to be reverted before shipping, disable `usePreviewEngine` and show the Phase 0 placeholder. There is no old code to fall back to.

---

### Phase 4: Transitions, Speed, and Edge Cases

**Goal and done criteria.** All transition types (fade, dissolve, slide, wipe) render correctly in the compositor. Variable-speed clips display at the correct source time. Disabled clips are skipped. Multi-track video composites correctly.

Deliverables:

- [ ] Transitions: the compositor receives transition metadata alongside clip data in the `TICK` message. During a transition window, both the outgoing and incoming clip frames are drawn with appropriate alpha, clip-path, or transform — the same math as `getOutgoingTransitionStyle` / `getIncomingTransitionStyle` but implemented as canvas draw operations.
- [ ] Speed: `getClipSourceTimeSecondsAtTimelineTime()` already computes the correct source time accounting for speed. The decode worker uses this value to determine which source frame to seek/decode. No change to the formula needed.
- [ ] Disabled clips: `enabled === false` clips are excluded from `TICK` messages entirely (zero render cost).
- [ ] Multi-video-track compositing: compositor draws lower z-index tracks first, upper tracks on top. Track order from the reducer maps to draw order.
- [ ] Effect preview (`effectPreviewOverride`): the engine accepts an optional `{ clipId, patch }` that is applied on top of the clip's stored properties when compositing. This replaces the equivalent logic in the old `derivePreviewScene`.
- [ ] Verify: transition from clip A to clip B while audio plays does not stutter or produce a blank frame.

Dependencies: Phase 3 complete.

Risks: Wipe transitions require clipping the canvas draw region (`ctx.rect` / `ctx.clip`), which must be reset correctly per frame. Missing a `ctx.restore()` produces cumulative compositing corruption.

Rollback plan: Same as Phase 3 — disable the engine and show the placeholder if a critical regression is found.

---

### Phase 5: Observability and Polish

**Goal and done criteria.** The new engine exposes measurable diagnostics. React components that previously relied on per-frame time updates are updated to use the ~4 Hz signal without visual regressions.

Deliverables:

- [ ] Add `PreviewEngine.getMetrics()`:
  - `decodedFrameCount` / `droppedFrameCount` since last play start.
  - `seekCount` (should be zero during steady 1x forward playback).
  - `audioClockDriftMs` (difference between audio clock and rAF wall clock, measured each tick).
  - `compositorFrameMs` (time to composite each frame).
  - Log these to console in dev mode; expose via a `data-` attribute on the canvas for tooling.
- [ ] Verify zero seeks during a 30-second continuous 1x playback session with one video clip. Log `seekCount` to the console.
- [ ] Verify `decodedFrameCount / totalPlaybackFrames > 0.99` (less than 1% dropped frames) on a supported 1080p asset.
- [ ] Waveform bars (`WaveformBars.tsx`) and playhead scroll (`use-timeline-playhead-scroll.ts`) currently consume `previewCurrentTimeMs`. Wire them to `playheadMs` from `usePreviewEngine` (the ~4 Hz value). The waveform is a visual indicator, not a frame-accurate display — 4 Hz is sufficient.
- [ ] Clean up any `previewCurrentTimeMs` references remaining in `useEditorLayoutRuntime` and sibling hooks.

Dependencies: Phases 1–4.

Risks: The ~4 Hz playhead update may make the timeline scrubber feel less smooth during playback. If this is visually unacceptable, increase to ~15 Hz. Do not go back to 60 Hz React state updates.

Rollback plan: Metrics can be removed without affecting functionality. The Hz rate of React time updates can be adjusted independently of the engine.

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Safari `AudioDecoder` unavailable causes silent audio failure | High (Safari does not support it) | High | Detect at runtime. Use `HTMLAudioElement` + `createMediaElementSource()` for all audio on Safari. Test explicitly on Safari 18+. |
| 2 | CORS blocks asset URL fetch from a Worker thread | Medium (R2 signed URLs may lack `Access-Control-Allow-Origin` for worker fetches) | High | Test Worker fetch against staging R2 bucket in Phase 1. If blocked, route all asset fetches through `/api/media` proxy which is same-origin. |
| 3 | GOP-aware seeking is too slow for dense timelines (keyframe every 2+ seconds) | Medium | Medium | Use a decode-ahead buffer: pre-decode 500ms–1s of frames during play so scrub latency is hidden. Also: re-encode uploaded assets to a shorter GOP at ingest time (backend concern, Phase 3+). |
| 4 | OffscreenCanvas + ImageBitmap transfer overhead exceeds frame budget | Low–Medium | Medium | Measure in Phase 2. If transferToImageBitmap is too slow, consider VideoFrame → ImageBitmapRenderingContext path, or keep the OffscreenCanvas on the main thread and run the compositor there (loses Worker isolation but preserves the rest of the architecture). |
| 5 | `AudioContext.resume()` fails silently on Safari before user gesture | Medium | Medium | Always call `resume()` inside a user interaction handler (`play` button click). Gate playback on a resolved `resume()` promise. |
| 6 | Caption layout engine cannot be serialized to Worker messages | Medium | Low–Medium | The caption layout engine (`layout-engine.ts`, `renderer.ts`) produces canvas draw instructions. Convert its output to a serializable `CaptionFrame` type that the compositor worker can consume directly, instead of passing a canvas render function. |
| 7 | Speed ramp or reverse playback produces out-of-order decoder chunks | Low | Medium | Reverse playback is out of scope (Non-Goal 4). Speed > 4x: seek-decode mode instead of continuous decode, accept dropped frames. Document the degradation threshold. |
| 8 | Multi-video-track compositing performance degrades on dense timelines | Low | Low | Prune frames aggressively: any frame more than 2 frames behind playhead is closed. The compositor only holds the current frame per clip, not a full buffer. |

## 9. Success Criteria

| Goal | Metric | Baseline | Target | How Measured |
|------|--------|----------|--------|--------------|
| No seeks during steady playback | `seekCount` per 30s of 1x forward play | Unknown (current model seeks continuously) | 0 seeks | `PreviewEngine.getMetrics().seekCount` |
| Zero frame-rate React re-renders | React Profiler commit count per second while playing | ~60/s (current rAF → setState) | 0 frame-driven commits outside `usePreviewEngine`'s ~4 Hz publish | React Profiler |
| Smooth frame delivery | `droppedFrameCount / totalFrames` | Not measured | < 1% on 1080p 30fps asset, Chrome on MacBook Pro | `getMetrics().droppedFrameCount` |
| Audio continuity | Audible glitches during playback | Current reports: "choppy" | Zero audible glitches in 5-minute play session on benchmark project | Manual QA + recorded session |
| Correct seek | Frame accuracy on scrub | Not measured | Displayed frame ≤ 1 frame from target position | Manual frame-step comparison |
| Audio-video sync | Drift between audio clock and compositor tick | Not measured | < 1 frame (< 33ms at 30fps) | `getMetrics().audioClockDriftMs` |

Leading indicators (visible during Phase 3):
- `seekCount` drops to zero immediately.
- React Profiler commit rate drops to ~4 commits/second during playback.
- No `waiting` or `stalled` events on the audio context clock.

Lagging indicators (visible after Phase 5 ships):
- User reports of choppy or laggy preview disappear.
- Editors can reliably judge clip timing during playback.

## 10. Open Questions

| # | Question | Owner | Needed By | Status |
|---|----------|-------|-----------|--------|
| 1 | Does the R2 bucket that serves signed asset URLs include `Access-Control-Allow-Origin` headers that allow fetch from a Worker context? | Backend | Before Phase 1 | Open |
| 2 | Which demuxer: `mp4box.js` or `web-demuxer`? mp4box.js is more battle-tested; web-demuxer supports more formats. Are there WebM or MKV assets in the system? | Frontend | Before Phase 1 | Open |
| 3 | What is the typical GOP length of AI-generated video assets? Affects seek latency. | Backend/Infrastructure | Before Phase 2 | Open |
| 4 | Should clip audio (video tracks with embedded audio) default to muted in preview unless explicitly enabled via `useClipAudio`? Or match the current default-on behavior? This is a product semantics question, not an engine question. | Product | Before Phase 3 | Open |
| 5 | Caption layout engine (`layout-engine.ts`, `renderer.ts`) — can its output be serialized to a message format? Or does it require DOM/canvas APIs that must stay on the main thread? | Frontend | Before Phase 4 | Open |

## 11. Alternatives Rejected

| Option | Why Rejected |
|--------|-------------|
| Incremental patching of the seek-correction loop | Patching thresholds treats symptoms. The model is wrong: audio attached to a seek-corrected video element cannot produce smooth playback by design. |
| Web Audio graph layered on top of existing HTMLVideoElement preview | Fixes audio coupling but leaves 60fps React re-renders, visual seek glitches, and the JS clock fighting the media clock. Postpones the real fix. |
| Adopting Diffusion Studio Core or similar library | Third-party ownership of the editor's most latency-sensitive component. Their timeline model will not map cleanly to ours; integration becomes a maintained fork. Build cost is comparable and we get full control. |
| Full WebCodecs pipeline running on the main thread (no Workers) | Decode is CPU-intensive. Running `VideoDecoder` callbacks on the main thread competes with React rendering and user interactions. Worker isolation is not optional for multi-clip timelines. |
