# Phase 3 — Implement Clock + Playhead Decoupling

> The highest-impact phase. Removes `currentTimeMs` from React state; replaces with an AudioContext-driven clock UI reads via `useSyncExternalStore`.
> Expected impact: rerenders during 10s playback drop from ~300 → ≤20. Preview FPS jumps meaningfully even before the new render pipeline.

## Goal

1. `MasterTimelineClock` is the single source of truth for playhead time.
2. UI that displays playhead (timecode, playhead line, clip highlights) subscribes via `useSyncExternalStore` directly against the clock.
3. `currentTimeMs` is NO LONGER in `EditorPlaybackContext`.
4. `useEditorAssetMap` no longer depends on `currentTimeMs`.
5. `REACT_PUBLISH_INTERVAL_MS = 250` and `publishTimeUpdate` are deleted.
6. Old `PreviewEngine` and `CompositorWorker` continue rendering, now driven by the new clock instead of internal RAF state.

## Preconditions

- Phase 2 merged (scaffold in place).
- `useEngineStore.getState().clock` exists but is `null`.

## Files Touched

### New (finish implementation of stubs)
- `frontend/src/editor-core/playback/MasterTimelineClock.ts` — full implementation
- `frontend/src/editor-core/playback/PlaybackController.ts` — full implementation
- `frontend/src/features/editor/bridges/PlaybackBridge.ts` — full implementation
- `frontend/src/features/editor/hooks/usePlayheadMs.ts` — NEW, `useSyncExternalStore` against clock
- `frontend/src/features/editor/hooks/useIsPlaying.ts` — NEW, `useSyncExternalStore` against controller

### Modify
- `frontend/src/features/editor/stores/engineStore.ts`
  - `initialize()` creates an `AudioContext`, constructs `MasterTimelineClock`, constructs `PlaybackController`, assigns to store
- `frontend/src/features/editor/engine/PreviewEngine.ts`
  - Accept `clock: MasterTimelineClock` in constructor instead of owning time internally
  - Remove `currentTimeMs` field, `lastPublishMs`, `rafStartWallMs`, `rafStartTimelineMs`
  - Remove `REACT_PUBLISH_INTERVAL_MS` constant (line 28)
  - Remove `publishTimeUpdate` method (line 985)
  - Remove `onTimeUpdate` callback from `PreviewEngineCallbacks`
  - RAF loop reads `clock.currentMs` instead of computing its own
- `frontend/src/features/editor/hooks/usePreviewEngine.ts`
  - Drop `currentTimeMs` / `isPlaying` from options
  - Drop the `onTimeUpdate` callback registration
  - Depend on `useEngineStore.getState().clock` instead
- `frontend/src/features/editor/components/layout/EditorProviders.tsx`
  - Remove `currentTimeMs` from the `playbackValue` useMemo deps + shape (lines 305–332)
  - Remove `currentTimeMs` from `useEditorAssetMap` input (line 87)
  - Initialize `engineStore` on mount, dispose on unmount
- `frontend/src/features/editor/context/EditorPlaybackContext.tsx`
  - Drop `currentTimeMs` from `EditorPlaybackContextValue`
- `frontend/src/features/editor/model/editor-reducer-session-ops.ts` (and `editor-reducer.ts` if relevant)
  - Remove `SET_CURRENT_TIME` action entirely
  - Remove `currentTimeMs` field from reducer state (if present)
- `frontend/src/features/editor/hooks/useEditorAssetMap.ts`
  - Drop `currentTimeMs` parameter
- All UI consumers of `useContext(EditorPlaybackContext).currentTimeMs`:
  - `components/caption/CaptionLayer.tsx`
  - `components/layout/EditorWorkspace.tsx`
  - `components/preview/PlaybackBar.tsx`
  - `components/preview/PreviewCanvas.tsx`
  - `components/timeline/Playhead.tsx`
  - `components/timeline/Timeline.tsx`
  - `components/timeline/TimelineClip.tsx`
  - `components/timeline/TimelineSection.tsx`
  - `components/timeline/TimelineToolstrip.tsx`
  - `components/layout/EditorHeader.tsx`
  - `components/dialogs/EditorDialogs.tsx`
  - Replace with `const playheadMs = usePlayheadMs();`

## Key Implementations

### `MasterTimelineClock.ts`

```ts
export type ClockState = "stopped" | "playing" | "paused";

export class MasterTimelineClock {
  private audioContext: AudioContext | null = null;
  private state: ClockState = "stopped";
  private startAudioContextTime = 0;
  private startTimelineMs = 0;
  private playbackRate = 1;
  private readonly listeners = new Set<() => void>();

  attach(ctx: AudioContext): void { this.audioContext = ctx; }

  play(fromMs: number): void {
    if (!this.audioContext) throw new Error("clock not attached");
    this.startTimelineMs = fromMs;
    this.startAudioContextTime = this.audioContext.currentTime;
    this.state = "playing";
    this.notify();
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.startTimelineMs = this.currentMs;
    this.state = "paused";
    this.notify();
  }

  seek(toMs: number): void {
    this.startTimelineMs = toMs;
    if (this.audioContext) this.startAudioContextTime = this.audioContext.currentTime;
    this.notify();
  }

  setRate(rate: number): void {
    this.startTimelineMs = this.currentMs;
    if (this.audioContext) this.startAudioContextTime = this.audioContext.currentTime;
    this.playbackRate = rate;
    this.notify();
  }

  get currentMs(): number {
    if (!this.audioContext || this.state !== "playing") return this.startTimelineMs;
    const elapsedSec =
      (this.audioContext.currentTime - this.startAudioContextTime) * this.playbackRate;
    return this.startTimelineMs + elapsedSec * 1000;
  }

  get playing(): boolean { return this.state === "playing"; }
  get rate(): number { return this.playbackRate; }

  /** Subscribe for a callback whenever state transitions (play/pause/seek/rate). NOT per-tick. */
  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void { for (const l of this.listeners) l(); }
}
```

Note: subscribers are notified on **state transitions**, not every frame. Per-frame updates come from `useSyncExternalStore` polling `getSnapshot()`. We drive that polling via rAF in `usePlayheadMs`.

### `PlaybackController.ts`

```ts
export class PlaybackController {
  constructor(private readonly clock: MasterTimelineClock) {}

  play(fromMs?: number): void {
    const start = fromMs ?? this.clock.currentMs;
    this.clock.play(start);
  }
  pause(): void { this.clock.pause(); }
  seek(ms: number): void { this.clock.seek(ms); }
  setRate(rate: number): void { this.clock.setRate(rate); }

  get currentMs(): number { return this.clock.currentMs; }
  get isPlaying(): boolean { return this.clock.playing; }
}
```

### `usePlayheadMs.ts`

```ts
import { useSyncExternalStore, useEffect, useState } from "react";
import { useEngineStore } from "../stores/engineStore";

/**
 * Returns the playhead in ms. During playback, triggers a re-render on rAF ticks
 * ONLY for components that call this hook — the broader tree is untouched.
 */
export function usePlayheadMs(): number {
  const clock = useEngineStore((s) => s.clock);
  const [tick, setTick] = useState(0);

  // Drive re-render on rAF only while playing.
  useEffect(() => {
    if (!clock) return;
    let handle = 0;
    let running = clock.playing;

    const loop = () => { setTick((n) => n + 1); handle = requestAnimationFrame(loop); };
    const start = () => { if (!handle) handle = requestAnimationFrame(loop); };
    const stop = () => { if (handle) cancelAnimationFrame(handle); handle = 0; };

    const unsub = clock.subscribe(() => {
      if (clock.playing !== running) {
        running = clock.playing;
        running ? start() : stop();
        setTick((n) => n + 1); // also redraw on pause/seek transition
      } else {
        setTick((n) => n + 1); // seek without play transition
      }
    });
    if (running) start();
    return () => { unsub(); stop(); };
  }, [clock]);

  return useSyncExternalStore(
    // subscribe is a no-op; rAF drives re-render, getSnapshot reads live clock
    () => () => {},
    () => (clock ? clock.currentMs : 0),
    () => 0,
  );
}
```

Why `useSyncExternalStore` + rAF instead of `setInterval(setState)`:
- Each hook call owns its own rAF. Only components that read the playhead re-render.
- `useSyncExternalStore` gives React a stable snapshot and tear-free reads during concurrent mode.
- Playhead display and playhead line use this hook; nobody else has to know about it.

### `useIsPlaying.ts`

```ts
export function useIsPlaying(): boolean {
  const clock = useEngineStore((s) => s.clock);
  return useSyncExternalStore(
    (cb) => (clock ? clock.subscribe(cb) : () => {}),
    () => (clock ? clock.playing : false),
    () => false,
  );
}
```

This one doesn't need rAF — it only changes on play/pause transitions.

### `PlaybackBridge.ts`

```ts
export class PlaybackBridge {
  constructor(private readonly controller: PlaybackController) {}
  play(fromMs?: number) { this.controller.play(fromMs); }
  pause() { this.controller.pause(); }
  seek(ms: number) { this.controller.seek(ms); }
  setRate(r: number) { this.controller.setRate(r); }
  getMs() { return this.controller.currentMs; }
  isPlaying() { return this.controller.isPlaying; }
}
```

UI components that call `play()`/`pause()`/`seek()` go through this, not the reducer.

### `engineStore.initialize()`

```ts
initialize: async () => {
  const ctx = new AudioContext();
  const clock = new MasterTimelineClock();
  clock.attach(ctx);
  const playback = new PlaybackController(clock);
  set({ clock, playback, initialized: true });
},
dispose: () => {
  const state = get();
  state.clock?.pause();
  set({ clock: null, playback: null, initialized: false });
},
```

Call `initialize()` from a top-level effect in `EditorProviders`. Call `dispose()` on unmount.

### `PreviewEngine` rewire (surgical)

Before (abridged, current):
```ts
class PreviewEngine {
  private currentTimeMs = 0;
  private rafStartWallMs = 0;
  private rafStartTimelineMs = 0;
  private rafLoop = () => {
    const audibleMs = this.audioMixer.getAudibleTimeMs();
    if (audibleMs - this.lastPublishMs >= REACT_PUBLISH_INTERVAL_MS) {
      this.publishTimeUpdate(audibleMs, "raf");
    }
    this.tickCompositor(audibleMs);
    ...
  };
}
```

After:
```ts
class PreviewEngine {
  constructor(
    private readonly clock: MasterTimelineClock,
    /* ...rest of existing ctor args... */
  ) {}

  private rafLoop = () => {
    const t = this.clock.currentMs;
    this.tickCompositor(t);
    // decoder reconcile, memory pressure — unchanged; all use `t`
    this.rafHandle = requestAnimationFrame(this.rafLoop);
  };
}
```

Playback state owned by the clock. `PreviewEngine` is now a pure renderer driven by the clock time. No React publishing.

## Step-by-Step

1. Branch `migration/phase-03-clock`.
2. Implement `MasterTimelineClock`, `PlaybackController`, `PlaybackBridge` (fill phase-2 stubs).
3. Wire `engineStore.initialize()`; call from `EditorProviders` on mount, `dispose` on unmount.
4. Add `hooks/usePlayheadMs.ts`, `hooks/useIsPlaying.ts`.
5. **Rewire `PreviewEngine`** to accept clock and stop publishing time. Also update its consumers (`usePreviewEngine`, anywhere it's constructed).
6. **Sweep all `EditorPlaybackContext.currentTimeMs` consumers** (list above). Replace with `usePlayheadMs()`.
7. **Sweep all `EditorPlaybackContext.isPlaying` consumers.** Replace with `useIsPlaying()`.
8. Delete `SET_CURRENT_TIME` action + `currentTimeMs` field from reducer.
9. Remove `currentTimeMs` from `EditorPlaybackContextValue`.
10. Remove `currentTimeMs` from `useEditorAssetMap` input.
11. `bun run type-check` → fix whatever broke.
12. `bun run lint`, `bun test`.
13. Manual smoke:
    - Open editor.
    - Playhead moves during playback.
    - Scrub the timeline — playhead updates.
    - Pause — playhead stops.
    - Open React DevTools Profiler → record 10 seconds of playback → count commits. Should be **drastically fewer** than before (most components never re-render).
14. Commit. PR.

## Validation

| Check | How |
| --- | --- |
| No `currentTimeMs` in React state | `grep -rn "currentTimeMs" frontend/src/features/editor/context frontend/src/features/editor/model` should only match removals/unrelated |
| Clock drives playhead | Pause AudioContext in DevTools; playhead freezes. |
| Rerender count | React DevTools Profiler: 10s playback → only timecode + playhead line commit. Target ≤ 20 total commits. |
| FPS | DevTools Perf: target 30+ FPS (we're not done — full 60 awaits phase 4) |
| All UI still works | Play, pause, scrub, click clip, edit text, save, export |
| No ESLint violations | `bun run lint` |
| Types clean | `bun run type-check` |

## Exit Criteria

- `currentTimeMs` deleted from reducer, context, asset map hook.
- `REACT_PUBLISH_INTERVAL_MS` and `publishTimeUpdate` gone from `PreviewEngine`.
- Every place that previously read `currentTimeMs` now uses `usePlayheadMs()` (or direct `clock.currentMs` in engine code).
- Profiler-verified commit-count drop during playback.

## Rollback

This is the riskiest phase to rollback because many files change. Keep the PR small and merged atomically. If a regression surfaces post-merge, revert the PR — no partial rollback. Old engine still works because the RAF loop is structurally identical, just reads from a different time source.

## Estimate

2–3 days. Risk concentrated in step 6 (sweep consumers) — the grep is large. Budget half a day for missed consumers surfacing as `undefined` at runtime.

## Out of Scope

- Render pipeline rewrite (phase 4).
- Caption decoupling (phase 6).
- Export unification (phase 7).

## Perf Budget Gate

Must hit before merging:

- Playback profiler: ≤ 30 component commits during 10s continuous playback.
- No `SET_CURRENT_TIME` dispatches in the Redux-style action log (if you have devtools hooked).

If either fails, do NOT merge. Find the stray consumer still driving state on tick.
