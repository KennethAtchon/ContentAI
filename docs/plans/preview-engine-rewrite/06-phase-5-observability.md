# Phase 5: Observability and Polish

**Goal:** The engine exposes measurable diagnostics. The `previewCurrentTimeMs` thread-through is fully replaced by `playheadMs` from `usePreviewEngine`. The preview footer shows a live timecode. All stale references to the old runtime are gone.

**Done criteria:**
- `PreviewEngine.getMetrics()` returns seek count, dropped frame count, decoded frame count, audio clock drift
- `seekCount` is 0 during 30 seconds of steady 1x forward playback (log to console in dev mode)
- `WaveformBars` and `use-timeline-playhead-scroll` use `playheadMs`, not `previewCurrentTimeMs`
- `PreviewCanvas` footer shows live timecode from `playheadMs`
- `previewCurrentTimeMs` is gone from `useEditorLayoutRuntime` return value and `EditorLayout` props
- `bun run type-check` passes with zero errors

---

## Step 1 — Complete `PreviewEngine.getMetrics()`

**File:** `frontend/src/features/editor/engine/PreviewEngine.ts`

The `metrics` object already exists. Fill in the audio clock drift measurement.

In the rAF loop, add a wall-clock drift diagnostic:

```ts
// Add to PreviewEngine class:
private rafStartWallMs = 0;
private rafStartTimelineMs = 0;

// In startRafLoop(), before the tick function:
this.rafStartWallMs = performance.now();
this.rafStartTimelineMs = this.currentTimeMs;

// In the tick function, after computing audibleMs:
const wallElapsedMs = performance.now() - this.rafStartWallMs;
const audioElapsedMs = audibleMs - this.rafStartTimelineMs;
this.metrics.audioClockDriftMs = audioElapsedMs - wallElapsedMs;
```

Add a `compositorFrameMs` measurement. In `PreviewEngine.ts`, wrap the compositor tick call:

```ts
// In the callbacks.onTimeUpdate implementation inside PreviewEngine constructor:
onTimeUpdate(ms) {
  const t0 = performance.now();
  // ... existing tick logic ...
  this.metrics.compositorFrameMs = performance.now() - t0;
}
```

Log metrics in dev mode at the end of each play session:

```ts
// In PreviewEngine.pause():
if (process.env.NODE_ENV === "development") {
  console.table(this.getMetrics());
}
```

---

## Step 2 — Wire `playheadMs` to `WaveformBars`

`WaveformBars` currently receives `currentTimeMs` from `useEditorLayoutRuntime` via `previewCurrentTimeMs`. After Phase 3, `playheadMs` from `usePreviewEngine` is the correct value.

**Find usages of `previewCurrentTimeMs` in `EditorTimelineSection` or `WaveformBars`:**

```bash
cd frontend
grep -r "previewCurrentTimeMs" src/
```

For each usage:
- If it is passed to a component that only needs it for visual playhead display, replace with `playheadMs` threaded from `EditorWorkspace` → `EditorLayout` → `EditorTimelineSection`.
- If it is used for a precise calculation (e.g., waveform trim math), keep using `store.state.currentTimeMs` instead — `playheadMs` is a display value, not the authoritative time.

The typical pattern:

**In `EditorLayout.tsx`**, pass `playheadMs` down:
```tsx
// playheadMs comes from useEditorLayoutRuntime (Option A from Phase 3) or from a new ref.
// For clean threading: add playheadMs to useEditorLayoutRuntime return value.
// It reads from the previewEngine ref if available, otherwise from store.state.currentTimeMs.
```

Simplest approach: in `useEditorLayoutRuntime.ts`, rename:
```ts
// Change:
previewCurrentTimeMs: store.state.currentTimeMs,
// To:
playheadMs: store.state.currentTimeMs, // engine overrides this value in EditorWorkspace
```

And have `usePreviewEngine` expose `playheadMs` which `EditorWorkspace` passes up via a callback:

```ts
// In usePreviewEngine params, add:
onPlayheadMs?: (ms: number) => void;

// In onTimeUpdate:
this.callbacks.onPlayheadMs?.(ms);
```

Then in `EditorWorkspace`, call `onPlayheadMs` to lift the value up to `EditorLayout`.

> This is a bit of prop-threading churn. If it's too noisy, keep `previewCurrentTimeMs: store.state.currentTimeMs` in `useEditorLayoutRuntime` for `WaveformBars` (the 4Hz vs 60Hz difference is invisible in the waveform visual). Only do the full thread if timeline scroll jitter is noticeable.

---

## Step 3 — Wire live timecode to `PreviewCanvas`

**File:** `frontend/src/features/editor/components/PreviewCanvas.tsx`

Add `playheadMs` and `durationMs` props:

```tsx
interface PreviewCanvasProps {
  resolution: string;
  playheadMs: number;
  durationMs: number;
}
```

Replace the static footer:
```tsx
// Change:
<span className="text-xs text-dim-3">0:00 / 0:00</span>

// To:
<span className="text-xs text-dim-3 font-mono">
  {formatMMSS(playheadMs)} / {formatMMSS(durationMs)}
</span>
```

Import `formatMMSS` from `../utils/timecode`.

Pass `playheadMs` and `durationMs` from `EditorWorkspace` to `PreviewCanvas`:
```tsx
<PreviewCanvas
  ref={canvasRef}
  resolution={resolution}
  playheadMs={playheadMs}
  durationMs={durationMs}
/>
```

---

## Step 4 — Remove `previewCurrentTimeMs` entirely

Once `WaveformBars`, `use-timeline-playhead-scroll`, and `PreviewCanvas` all consume `playheadMs`:

1. Remove the `previewCurrentTimeMs` return from `useEditorLayoutRuntime.ts`.
2. Remove the `previewCurrentTimeMs` prop from `EditorLayout.tsx` and `EditorWorkspace.tsx`.
3. Run:
   ```bash
   grep -r "previewCurrentTimeMs" frontend/src/
   ```
   The result should be empty.

---

## Step 5 — Validate success metrics

Run a benchmark session:

```
1. Open a project with one 1080p 30fps video clip and one music clip.
2. Press play.
3. Let it run for 30 seconds.
4. Open DevTools console.
5. Pause.
```

**Expected console output (from `console.table(this.getMetrics())`):**

| Metric | Target |
|--------|--------|
| `seekCount` | 0 |
| `decodedFrameCount` | ~900 (30s × 30fps) |
| `droppedFrameCount` | < 9 (< 1%) |
| `audioClockDriftMs` | < 33ms |
| `compositorFrameMs` | < 10ms on a MacBook Pro |

**React Profiler:**
- During playback: ~4 commits/second in the `EditorWorkspace` subtree.
- Zero commits in `PreviewCanvas` at frame rate.

---

## Step 6 — Clean up any remaining dead references

```bash
cd frontend
grep -r "usePreviewPlaybackBridge\|usePreviewMediaSync\|usePreviewMediaRegistry\|PreviewStageRoot\|preview-scene\|PreviewStageSurface" src/
```

All results should be empty. If any references remain, trace them and delete.

---

## Step 7 — Final type check and lint

```bash
cd frontend
bun run type-check   # zero errors
bun run lint         # zero warnings in modified files
bun test             # existing tests pass
```

---

## What good looks like after Phase 5

- Play a 5-minute project. No audible glitches. No visual frame drops on 1080p source.
- Scrub the timeline. Canvas updates within one frame decode time (~33ms for a 30fps GOP).
- Edit a clip while playing. The engine calls `update()`, the affected decoder restarts, unaffected clips continue uninterrupted.
- Open the editor in Safari. Audio plays (via HTMLAudioElement fallback). Video plays.
- Open DevTools → Memory. No `VideoFrame` objects accumulating. No growing JS heap during steady playback.
