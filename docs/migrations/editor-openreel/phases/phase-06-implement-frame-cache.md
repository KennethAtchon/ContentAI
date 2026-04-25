# Phase 6 — LRU Frame Cache + Global Memory Budget

> Replace the per-clip unbounded frame queues with a single LRU cache that bounds total memory.
> After this phase: preview memory is stable on long timelines; scrub is faster due to preload window.

## Goal

1. One `FrameCache` for all clips, sized by **count** and **bytes**.
2. LRU eviction; `VideoFrame.close()` on evict to release GPU texture.
3. Preload window: fetch N frames ahead and M frames behind the current playhead during playback.
4. `DecoderPool` integrates with the cache — decode output goes straight into the cache; `getFrameAt()` first checks cache, then enqueues if miss.
5. Memory-pressure observer (which exists in current code) shrinks the cache instead of only shrinking decoder budget.

## Preconditions

- Phase 5 merged. `VideoEngine.renderFrame()` drives preview.
- `DecoderPool` now lives in `editor-core/video/`.

## Files Touched

### Implement
- `frontend/src/editor-core/video/FrameCache.ts` — full LRU
- `frontend/src/editor-core/video/DecoderPool.ts` — wire to cache; drop internal per-clip queues
- `frontend/src/editor-core/video/preload-planner.ts` — NEW: decides which (clipId, timeUs) tuples to prefetch given current time, playback rate, tracks

### Modify
- `frontend/src/editor-core/video/VideoEngine.ts` — on `renderFrame`, consult `preloadPlanner.plan(t)` and warm the cache
- `frontend/src/editor-core/video/workers/compositor.worker.ts` — accept frames from main thread with new cache-backed shape (minor)
- `frontend/src/features/editor/stores/engineStore.ts` — construct `FrameCache` with config, pass into `DecoderPool` and `VideoEngine`

### Delete
- Any per-clip `frameQueues: Map<string, VideoFrame[]>` usage inside the moved `CompositorWorker`/`DecoderPool`

## Key Implementations

### `FrameCache.ts`

```ts
export interface FrameCacheConfig {
  readonly maxFrames: number;    // default 100
  readonly maxBytes: number;     // default 500 * 1024 * 1024
}

interface Entry {
  key: string;                   // `${clipId}:${timestampUs}`
  clipId: string;
  timestampUs: number;
  frame: VideoFrame;
  bytes: number;                 // estimated: width * height * 4
  lastAccessed: number;
}

export class FrameCache {
  private readonly entries = new Map<string, Entry>();  // insertion order = LRU order; we re-insert on access
  private totalBytes = 0;
  private config: FrameCacheConfig;

  constructor(config: Partial<FrameCacheConfig> = {}) {
    this.config = {
      maxFrames: config.maxFrames ?? 100,
      maxBytes: config.maxBytes ?? 500 * 1024 * 1024,
    };
  }

  get(clipId: string, timestampUs: number): VideoFrame | null {
    const key = `${clipId}:${timestampUs}`;
    const entry = this.entries.get(key);
    if (!entry) return null;
    // move to end (most recent)
    this.entries.delete(key);
    this.entries.set(key, { ...entry, lastAccessed: performance.now() });
    return entry.frame;
  }

  put(clipId: string, timestampUs: number, frame: VideoFrame): void {
    const key = `${clipId}:${timestampUs}`;
    if (this.entries.has(key)) { frame.close(); return; }
    const bytes = (frame.codedWidth * frame.codedHeight * 4) | 0;
    const entry: Entry = { key, clipId, timestampUs, frame, bytes, lastAccessed: performance.now() };
    this.entries.set(key, entry);
    this.totalBytes += bytes;
    this.evictIfNeeded();
  }

  /** Find nearest frame in the cache for a given time. Useful when exact miss. */
  findNearest(clipId: string, timestampUs: number, toleranceUs = 40_000): VideoFrame | null {
    let best: Entry | null = null;
    let bestDelta = Infinity;
    for (const entry of this.entries.values()) {
      if (entry.clipId !== clipId) continue;
      const d = Math.abs(entry.timestampUs - timestampUs);
      if (d < bestDelta && d <= toleranceUs) { best = entry; bestDelta = d; }
    }
    return best?.frame ?? null;
  }

  dropClip(clipId: string): void {
    for (const [key, entry] of this.entries) {
      if (entry.clipId === clipId) {
        this.entries.delete(key);
        this.totalBytes -= entry.bytes;
        entry.frame.close();
      }
    }
  }

  shrinkTo(targetBytes: number): void {
    while (this.totalBytes > targetBytes && this.entries.size > 0) {
      this.evictOldest();
    }
  }

  private evictIfNeeded(): void {
    while (
      (this.entries.size > this.config.maxFrames || this.totalBytes > this.config.maxBytes)
      && this.entries.size > 0
    ) {
      this.evictOldest();
    }
  }

  private evictOldest(): void {
    const firstKey = this.entries.keys().next().value;
    if (!firstKey) return;
    const entry = this.entries.get(firstKey);
    if (!entry) return;
    this.entries.delete(firstKey);
    this.totalBytes -= entry.bytes;
    entry.frame.close();
  }

  get stats() {
    return { frames: this.entries.size, bytes: this.totalBytes, ...this.config };
  }
}
```

### `preload-planner.ts`

```ts
export interface PreloadPlan {
  readonly items: ReadonlyArray<{ clipId: string; timestampUs: number; priority: number }>;
}

export interface PlannerConfig {
  readonly aheadMs: number;    // default 1000
  readonly behindMs: number;   // default 300
  readonly stepMs: number;     // default 1000/fps
}

export function planPreload(
  tracks: Track[],
  timelineMs: number,
  rate: number,
  cfg: PlannerConfig,
): PreloadPlan {
  const items: { clipId: string; timestampUs: number; priority: number }[] = [];
  const from = timelineMs - cfg.behindMs;
  const to = timelineMs + cfg.aheadMs * (rate > 0 ? rate : 1);

  for (const track of tracks) {
    if (track.type !== "video") continue;
    for (const clip of track.clips) {
      const clipEnd = clip.startMs + clip.durationMs;
      const windowStart = Math.max(from, clip.startMs);
      const windowEnd = Math.min(to, clipEnd);
      if (windowEnd <= windowStart) continue;
      for (let t = windowStart; t <= windowEnd; t += cfg.stepMs) {
        const sourceTimeUs = Math.round(
          getClipSourceTimeSecondsAtTimelineTime(clip, t) * 1_000_000,
        );
        const priority = Math.abs(t - timelineMs);  // lower = higher priority
        items.push({ clipId: clip.id, timestampUs: sourceTimeUs, priority });
      }
    }
  }
  items.sort((a, b) => a.priority - b.priority);
  return { items };
}
```

### `DecoderPool` adjustments

- On decode completion, call `frameCache.put(clipId, tsUs, frame)`.
- `getFrameAt(clipId, tsUs)`:
  1. `cache.get(clipId, tsUs)` → hit, return.
  2. `cache.findNearest(clipId, tsUs, tolerance)` → nearest within frame duration, return.
  3. Miss: enqueue a decode job, return `null`. `VideoEngine` re-requests next tick.
- `dropClip(id)` calls `cache.dropClip(id)` in addition to stopping the decoder.

### Memory pressure

- The existing `observeMemoryPressure()` in `PreviewEngine` should be moved to `editor-core/video/MemoryPressureObserver.ts`.
- Under pressure: `cache.shrinkTo(cache.stats.bytes * 0.5)` immediately. Lower decoder budget (as today).

### Wiring

`engineStore.initialize()`:
```ts
const cache = new FrameCache({ maxFrames: 100, maxBytes: 500 * 1024 * 1024 });
const decoderPool = new DecoderPool(cache);
const video = new VideoEngine(decoderPool, compositor, renderer);
```

## Step-by-Step

1. Branch `migration/phase-06-frame-cache`.
2. Implement `FrameCache` with unit tests:
   - `put` evicts on count overflow
   - `put` evicts on byte overflow
   - `get` moves entry to MRU
   - `dropClip` removes all entries + closes frames
   - `findNearest` respects tolerance
3. Implement `planPreload` with unit tests (sample tracks + time → expected plan).
4. Rewire `DecoderPool` to write into cache instead of local queue. Remove internal queues.
5. Update `VideoEngine.renderFrame()` to call the planner and kick prefetch jobs **after** the current frame is dispatched (non-blocking).
6. Move memory pressure observer; have it call `cache.shrinkTo(bytes/2)` on warn/critical.
7. Add a dev-only overlay (optional) showing cache size + hit rate — useful for tuning but delete before PR.
8. Type-check, lint, test, smoke. Run a 10-minute session — memory in DevTools should plateau, not climb.
9. Commit. PR.

## Validation

| Check | How |
| --- | --- |
| Unit tests | `bun test editor-core/video/FrameCache.test.ts` pass |
| Memory stable | Chrome DevTools → Performance Monitor → "JS heap" stays within ±50 MB over 10 min playback |
| No frame leaks | All tests end with `cache.stats.frames === 0` after `dispose()` |
| Scrub improves | Stop-watch a scrub from 0s → 30s; frames appear faster than before (preload warmed the cache) |
| No regressions | Preview still works; export still works (old export path untouched) |

## Exit Criteria

- `FrameCache` is the single place where decoded `VideoFrame`s live.
- `DecoderPool` has no internal queues.
- Memory is provably bounded under stress.

## Rollback

Revert phase-06 PR. The decoder pool API change is the biggest risk — keep its signature stable externally (so revert is clean).

## Estimate

2–3 days. The cache itself is a day; integrating with the decoder pool + tuning preload without jank is the rest.

## Perf Budget Gate

- 1-hour playback: heap size growth ≤ 100 MB.
- Scrub latency: p95 ≤ 80 ms (time from seek to first rendered frame).
- Cache hit rate during steady playback at 30 FPS: ≥ 85%.
