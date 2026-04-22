# Preview System Bug Execution Notes

## Executed Fix — `VideoDecoder needs a key chunk`

**Status:** Implemented in `frontend/src/features/editor/engine/ClipDecodeWorker.ts`.

**Issue:** `seekTo()` decodes from the GOP keyframe to the target and calls `videoDecoder.flush()` once the target sample has been crossed. During that seek loop, `decodeSample()` clears `decoderNeedsKeyFrame` as soon as it feeds the GOP keyframe. If the browser clears decoder reference state during `flush()`, the worker can resume playback at `playheadSampleIndex = index + 1` and feed a delta chunk while the decoder now needs a key chunk.

**Fix applied:** After the seek flush completes, set `decoderNeedsKeyFrame = true` before returning from the successful seek path. The existing playback feed path already calls `rewindToKeyframeIfNeeded()` before feeding the next chunk, so resumed playback rewinds to the GOP keyframe instead of feeding a delta chunk into a decoder that has lost reference frames.

```typescript
await this.videoDecoder.flush();
this.decoderNeedsKeyFrame = true;
if (this.didEmitFrameForActiveSeek) {
  this.playheadSampleIndex = index + 1;
  return;
}
```

**Why this should fix the crash:** The reported error is `VideoDecoder.decode: VideoDecoder needs a key chunk` at the continuous feed path. The worker already has a keyframe rewind guard for exactly that state, but the flag was stale after `flush()`. Marking the decoder as keyframe-hungry reconnects the seek path to the existing guard.

## Executed Cleanup — AudioContext Autoplay Warnings

**Status:** Implemented in `frontend/src/features/editor/engine/AudioMixer.ts` and `frontend/src/features/editor/hooks/useWaveformData.ts`.

`AudioMixer` no longer creates an output `AudioContext` in its constructor. It creates one lazily from `prime()` or `play()`, so the existing pointer/key gesture priming path can create/resume audio without triggering autoplay warnings during preview initialization.

`useWaveformData.ts` now prefers `OfflineAudioContext` for waveform decoding. That keeps non-playback audio analysis off the browser output-audio autoplay policy path when the browser supports offline decoding.

## Executed Cleanup — WebGL `u_resolution` Link Warning

**Status:** Implemented in `frontend/src/features/editor/engine/compositor/Webgl2CompositorRenderer.ts`.

The shared `u_resolution` uniform was split into `u_positionResolution` for the vertex shader and `u_canvasSize` for the fragment shader. The math stays the same, but Firefox should no longer warn about linking the same uniform across both shader stages.

## Executed Cleanup — Editor API Request Timeout

**Status:** Implemented in `frontend/src/features/auth/hooks/use-authenticated-fetch.ts`, `frontend/src/shared/services/api/authenticated-fetch.ts`, `frontend/src/shared/hooks/use-query-fetcher.ts`, and `frontend/src/features/editor/hooks/useEditorProjectPoll.ts`.

The authenticated-fetch React hook accepted only `url` and `options`, so callers that passed a `timeout` argument had it silently dropped. The hook and JSON wrapper now pass timeout through to the underlying safe-fetch layer.

`useEditorProjectPoll()` now gives `/api/editor/:id` polling an explicit 15 second timeout. This does not hide backend failures, but it prevents editor project polling from being constrained by a too-short or accidentally ignored timeout.

## Executed Cleanup — Performance Metrics Visibility

**Status:** Implemented in `frontend/src/shared/utils/system/performance.ts`.

`PreviewEngine.logMetricsIfDevelopment()` still logs with `console.table(this.getMetrics())` when playback is paused or ends, and only when `IS_DEVELOPMENT` is true.

The debug runtime is now available as both `window.__REEL_EDITOR_DEBUG__` and the easier browser-console alias `window.reelEditorDebug`. Use `window.reelEditorDebug.snapshot()` to inspect preview metrics on demand.

## Executed Fix — Playhead Clock Provider Crash

**Status:** Implemented in `frontend/src/features/editor/components/layout/EditorProviders.tsx`, `frontend/src/features/editor/hooks/useEditorClipActions.ts`, and `frontend/src/features/editor/hooks/useEditorTransport.ts`.

`EditorProviders` created the `PlayheadClockContext.Provider` in its returned JSX, but it also called `useEditorClipActions()` and `useEditorTransport()` before returning. Those hooks called `usePlayheadClock()`, so they tried to read the context before the provider existed in the tree.

`EditorProviders` now passes its stable `PlayheadClock` instance into those provider-owned hooks directly. Descendant components still read the clock from `PlayheadClockContext`.

## Executed Fix — Aborted Editor Fetch Retries

**Status:** Implemented in `frontend/src/shared/services/api/safe-fetch.ts`, `frontend/src/shared/services/api/authenticated-fetch.ts`, and `frontend/src/features/editor/components/layout/EditorRoutePage.tsx`.

The first editor project load can abort an in-flight request when a newer load supersedes it. `safeFetch()` then retried the already-aborted caller signal, producing a noisy retry failure that lasted about three seconds.

`safeFetch()` and authenticated fetch now disable retries when the caller-provided signal is already aborted. The initial editor project open request also uses an explicit 15 second timeout, matching editor project polling.

## Executed Fix — Waveform Decode Requests Aborting Immediately

**Status:** Implemented in `frontend/src/shared/services/api/safe-fetch.ts`.

`useWaveformData()` intentionally calls authenticated fetch with `timeout: 0` for `/api/assets/:id/media-for-decode`, meaning no timeout for larger media payloads. `safeFetch()` previously treated `0` as a real `setTimeout(..., 0)`, which aborted the request immediately and retried it for about three seconds.

`safeFetch()` now treats `timeout: 0` as disabled timeout behavior. The waveform proxy fetch can now complete normally or fall back to the signed URL only on a real auth/network failure.
