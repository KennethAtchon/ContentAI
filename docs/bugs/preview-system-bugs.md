# Preview System Bug Diagnosis

## Bug 1 — `VideoDecoder needs a key chunk` (ClipDecodeWorker.ts:536)

**Root cause:** After `seekTo()` calls `videoDecoder.flush()`, the browser's WebCodecs implementation clears its internal reference frame buffer. The `decoderNeedsKeyFrame` flag is `false` at this point (it was cleared when the keyframe was decoded during the seek loop). So when playback resumes, `rewindToKeyframeIfNeeded()` does NOT rewind, and `feedNextChunk` starts feeding delta frames from `playheadSampleIndex` into a decoder that has lost its reference state — producing the `DataError: VideoDecoder needs a key chunk` crash.

**Precise location:** `ClipDecodeWorker.ts`, `seekTo()` method. The early-return path at:
```typescript
await this.videoDecoder.flush();
if (this.didEmitFrameForActiveSeek) {
    this.playheadSampleIndex = index + 1;
    return; // ← decoderNeedsKeyFrame is still false here
}
```

**Fix (targeted, one line):** Set `this.decoderNeedsKeyFrame = true` immediately after `await this.videoDecoder.flush()`. The existing `rewindToKeyframeIfNeeded()` will then do the right thing when playback resumes — rewinding to the GOP start before feeding the first delta frame.

```typescript
await this.videoDecoder.flush();
this.decoderNeedsKeyFrame = true; // ← add this
if (this.didEmitFrameForActiveSeek) {
    this.playheadSampleIndex = index + 1;
    return;
}
```

---

## Bug 2 — React rendering on every playback tick (THE MAJOR BUG)

**Observed:** Million devtools shows EditorWorkspace (and all its context consumers) re-rendering ~100x/sec during playback.

**Expected:** React should be involved at 4Hz max (the `REACT_PUBLISH_INTERVAL_MS = 250` throttle in `PreviewEngine`).

### Root cause chain

**Step 1 — `currentTimeMs` lives in the reducer.**

`PreviewEngine.publishTimeUpdate()` calls `callbacks.onTimeUpdate(ms)` every 250ms. That callback is `store.setCurrentTime` which dispatches `SET_CURRENT_TIME` to the `useReducer`. This updates `store.state.currentTimeMs`.

**Step 2 — `transport` callbacks capture `currentTimeMs` in their closures.**

In `useEditorTransport.ts`:
```typescript
const rewind = useCallback(() => {
    store.setCurrentTime(Math.max(0, state.currentTimeMs - 5000));
}, [store, state.currentTimeMs]); // ← re-created every time currentTimeMs changes

const fastForward = useCallback(() => {
    store.setCurrentTime(Math.min(state.durationMs, state.currentTimeMs + 5000));
}, [store, state.durationMs, state.currentTimeMs]); // ← same
```

Every time `store.state.currentTimeMs` changes, `rewind` and `fastForward` are recreated → `transport` is a new object reference.

**Step 3 — `transport` is a dependency of `playbackValue` useMemo.**

In `EditorProviders.tsx`:
```typescript
const playbackValue = useMemo(
    () => ({ ...transport, ... }),
    [..., transport, ...]  // ← transport changing invalidates this
);
```

Every time `currentTimeMs` updates (every 250ms), `transport` changes → `playbackValue` changes → **ALL consumers of `EditorPlaybackContext` re-render**.

**Step 4 — Many components consume the same context.**

`EditorPlaybackContext` is consumed by `EditorWorkspace`, `Timeline`, `Playhead`, `PlaybackBar`, `TimelineSection`, `TimelineToolstrip`, `Inspector`, and anything else that calls `useEditorPlaybackContext()`. With ~30+ components, 4 Hz × 30 = 120 renders/sec. That explains the 900 renders in 9 seconds.

---

### Options (ordered by scope)

#### Option A — Quick partial fix (low scope, doesn't fully solve it)

Change `rewind` and `fastForward` to not capture `currentTimeMs`. Use a ref instead:

In `EditorProviders.tsx`, add:
```typescript
const currentTimeMsRef = useRef(store.state.currentTimeMs);
useEffect(() => { currentTimeMsRef.current = store.state.currentTimeMs; }, [store.state.currentTimeMs]);
```

Pass `currentTimeMsRef` into `useEditorTransport`, and read `currentTimeMsRef.current` inside `rewind`/`fastForward` rather than depending on `state.currentTimeMs`. This breaks the `transport` identity change chain and stops the cascade.

**Impact:** Stops the ~100/sec renders caused by `transport` invalidation. But `playbackValue` still contains `store.state.currentTimeMs` directly, so all context consumers still re-render 4x/sec when the time updates. That's 30+ components × 4 = 120 renders/min, which is acceptable but not zero.

#### Option B — Split the context (medium scope, correct architecture)

Extract time-varying playback state (`currentTimeMs`, `playheadMs`) into a separate `EditorPlaybackTimeContext`. All components that only need `isPlaying`, `zoom`, transport controls, etc. consume only the stable context and never re-render during playback. Only `Playhead`, `PlaybackBar`, and the timeline ruler consume `EditorPlaybackTimeContext`.

This is the right long-term fix and reduces playback re-renders to only the components that actually display time. Estimate: ~3-4 components re-render at 4Hz instead of 30+.

#### Option C — Take React completely out of the playback loop (big scope, ideal)

Remove `currentTimeMs` from the reducer entirely during playback. The `PreviewEngine` owns the clock. The timeline playhead should be updated imperatively via a CSS transform (ref → DOM style), not React state. React state is only needed when playback stops (for scrubbing, displaying time in the bar, etc.).

This is the correct architecture for any frame-rate UI. React is not designed for 4Hz+ state updates across large subtrees. With this approach, zero React renders happen during playback for the playhead position.

**What to decide:** Option A is a targeted fix you can do right now (15 min). Option B is the architecturally right fix (a day's work). Option C is the ideal but requires the most rewiring.

---

## Bug 3 — AudioContext autoplay warnings

**Sources:** `AudioMixer.ts` constructor, `useWaveformData.ts` `getSharedAudioContext()`, and one from a library in `index.mjs`.

These are browser policy warnings, not failures. Modern browsers suspend `AudioContext` on creation until a user gesture. The `primeAudioContext()` mechanism in `usePreviewEngine.ts` correctly resumes it on `pointerdown`/`keydown`. Audio WILL work after the first user gesture.

The `useWaveformData.ts` and `AudioMixer.ts` are creating separate `AudioContext` instances. This is slightly wasteful but not broken. If you want to clean it up: expose the mixer's `AudioContext` and reuse it in `useWaveformData.ts`.

**Priority:** Low. Cosmetic warnings only.

---

## Bug 4 — WebGL `u_resolution` not linkable warning

**Location:** `Webgl2CompositorRenderer.ts`, `createProgram()`.

`u_resolution` is declared as `uniform vec2` in BOTH the vertex shader AND the fragment shader. In WebGL2, sharing a uniform between both stages is valid when types match. Firefox emits a "not linkable" warning for this pattern even though the program links and runs correctly. This is a Firefox quirk.

The shader compiles and links (`LINK_STATUS` passes, otherwise `getShaderLocations` would return null and the renderer would fall back). No functional impact.

**Fix (optional):** Remove `u_resolution` from the vertex shader and pass canvas size as two separate attributes or compute it differently. But verify it doesn't break the coordinate normalization. Not worth doing unless the visual output is wrong.

---

## Bug 5 — External API request failed (editor fetch)

```
url: "http://localhost:3000/api/editor/6d262766..."  method: "GET"  attempts: 3  duration: 3002
```

This is the `useEditorProjectPoll` or `safe-fetch` retrying a GET to the editor API and timing out after 3 seconds. Likely a race condition on first load — the editor polls for project state before the backend is ready or the DB record exists.

Check the backend: `GET /api/editor/:id` is likely failing with 404 or returning a timeout. This may be a dev-only issue if you started the frontend before the backend was up.

---

## Bug 6 — Performance metrics not visible

**Where they go:** `console.table(this.getMetrics())` is called in `PreviewEngine.logMetricsIfDevelopment()` after each playback session ends. Look in the **browser DevTools console** (F12, Console tab), not the terminal.

It only fires when:
- `IS_DEVELOPMENT` is `true` (check `envUtil.ts`)
- Playback finishes or you press pause

**Also available:** `window.reelEditorDebug.snapshot()` in the browser console — returns a full snapshot of all marks, measures, and debug values from `systemPerformance`. This gives you seek latency, compositor frame times, decoder state, etc. at any moment.

If `IS_DEVELOPMENT` is somehow `false` in your local dev build, check `frontend/src/shared/utils/config/envUtil.ts`.
