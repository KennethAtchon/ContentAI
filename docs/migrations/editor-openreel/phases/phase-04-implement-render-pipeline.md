# Phase 4 — Unified Render Pipeline

> Replace the current `PreviewEngine.tickCompositor` + `CompositorWorker` + `DecoderPool` split with a single `VideoEngine.renderFrame(args) → RenderedFrame` inside `editor-core/`.
> After this phase: the preview rAF loop calls `videoEngine.renderFrame()` each tick and paints to a visible canvas. Export still uses the old path (unified in phase 7).

## Goal

1. `VideoEngine.renderFrame({ tracks, subtitles, timelineMs, width, height })` is pure — input project state + time → `ImageBitmap`.
2. `RendererFactory` chooses WebGL2 first, Canvas2D fallback.
3. `GpuCompositor` layers clips with z-index, opacity, blend, transform.
4. Decoding is via `DecoderPool` (moved into `editor-core/video/`), still workers, still WebCodecs.
5. Preview rAF calls `videoEngine.renderFrame()` with the clock's current ms and draws the returned bitmap to the visible canvas.

## Preconditions

- Phase 3 merged (clock is live).
- `usePreviewEngine` no longer reads/writes `currentTimeMs` to React state.
- Old `CompositorWorker` + `PreviewEngine` still exist and are driving pixels.

## Files Touched

### Move (no logic change inside the move commit)

Moves first, logic changes second, in separate commits inside the phase:

- `frontend/src/features/editor/engine/CompositorWorker.ts` → `frontend/src/editor-core/video/workers/compositor.worker.ts`
- `frontend/src/features/editor/engine/ClipDecodeWorker.ts` → `frontend/src/editor-core/video/workers/clip-decode.worker.ts`
- `frontend/src/features/editor/engine/DecoderPool.ts` → `frontend/src/editor-core/video/DecoderPool.ts`
- `frontend/src/features/editor/engine/decode-guard.ts` → `frontend/src/editor-core/video/decode-guard.ts`
- `frontend/src/features/editor/engine/compositor/Canvas2dCompositorRenderer.ts` → `frontend/src/editor-core/video/Canvas2dRenderer.ts`
- `frontend/src/features/editor/engine/compositor/Webgl2CompositorRenderer.ts` → `frontend/src/editor-core/video/Webgl2Renderer.ts`
- `frontend/src/features/editor/engine/compositor/types.ts` → `frontend/src/editor-core/video/compositor-types.ts`
- `frontend/src/features/editor/engine/compositor/index.ts` → merge into `frontend/src/editor-core/video/renderer-factory.ts`

Keep imports working during the move by updating all call sites in the same commit. One move = one atomic commit.

After moves: `features/editor/engine/` still contains `PreviewEngine.ts` and `AudioMixer.ts`. `AudioMixer.ts` stays for now (audio is a later phase if needed); `PreviewEngine.ts` becomes a thin shim around `VideoEngine` and dies in this phase.

### Implement

- `frontend/src/editor-core/video/VideoEngine.ts` — fill stub
- `frontend/src/editor-core/video/renderer-factory.ts` — detect WebGL2 → Canvas2D fallback
- `frontend/src/editor-core/video/GpuCompositor.ts` — z-order + layer add/remove
- `frontend/src/editor-core/video/FrameCache.ts` — empty-shell LRU (cache implementation is phase 5; in this phase just an in-flight decode queue)
- `frontend/src/editor-core/timeline/buildCompositorDescriptors.ts` — move the existing `buildCompositorClips` function here; make it the canonical builder
- `frontend/src/features/editor/bridges/RenderBridge.ts` — implement: holds canvas ref, calls `videoEngine.renderFrame(...)`, `drawImage` to canvas

### Modify

- `frontend/src/features/editor/stores/engineStore.ts` — `initialize()` also constructs `VideoEngine`, `DecoderPool`, stores them
- `frontend/src/features/editor/components/preview/PreviewCanvas.tsx` — replace old preview mount with a thin component that:
  - Holds a `<canvas ref>`
  - On mount: `renderBridge.setCanvas(canvas)`
  - Runs a rAF loop that calls `renderBridge.renderAt(clock.currentMs)` **while playing**
  - During pause/seek: renders one frame on demand (also handled by bridge)
- `frontend/src/features/editor/hooks/usePreviewEngine.ts` — **delete** this hook. Its job is now split between `engineStore.initialize()` and `RenderBridge`.

### Delete (after the new path is proven with smoke test)

- `frontend/src/features/editor/engine/PreviewEngine.ts` — the old god class
- `frontend/src/features/editor/hooks/usePreviewEngine.ts`

## Architecture After This Phase

```
engineStore.initialize()
  └── AudioContext → MasterTimelineClock → PlaybackController (from phase 3)
  └── DecoderPool (workers)
  └── VideoEngine
        ├── RendererFactory → Webgl2Renderer | Canvas2dRenderer
        ├── GpuCompositor
        └── FrameCache (placeholder)

PreviewCanvas
  └── <canvas ref>
  └── useEffect:
        renderBridge.setCanvas(canvas);
        rAF loop while clock.playing:
          renderBridge.renderAt(clock.currentMs);
        on pause/seek (clock state transition):
          renderBridge.renderAt(clock.currentMs);

renderBridge.renderAt(t):
  const frame = await videoEngine.renderFrame({
    tracks: timelineStore.tracks,
    subtitles: timelineStore.subtitles, // phase 6 wires this
    timelineMs: t,
    width, height,
  });
  ctx.drawImage(frame.image, 0, 0);

videoEngine.renderFrame(args):
  descriptors = buildCompositorDescriptors(args.tracks, args.timelineMs, null);
  for each descriptor:
    frame = await decoderPool.getFrame(descriptor);
    compositor.addLayer({ texture: frame, transform, z, opacity, ... });
  compositor.render(renderer);
  return { image: renderer.readBitmap(), ... };
```

## Key Implementations

### `VideoEngine.renderFrame` (shape — fill in from moved code)

```ts
export class VideoEngine {
  constructor(
    private readonly decoderPool: DecoderPool,
    private readonly compositor: GpuCompositor,
    private readonly renderer: Renderer,
  ) {}

  async renderFrame(args: RenderFrameArgs): Promise<RenderedFrame> {
    const { tracks, timelineMs, width, height } = args;
    this.compositor.clear();

    const descriptors = buildCompositorDescriptors(tracks, timelineMs, null);
    for (const d of descriptors) {
      if (!d.enabled || d.opacity === 0) continue;
      const videoFrame = await this.decoderPool.getFrameAt(d.clipId, d.sourceTimeUs);
      if (!videoFrame) continue;
      this.compositor.addLayer({
        id: d.clipId,
        texture: videoFrame,
        transform: d.transform,
        opacity: d.opacity,
        zIndex: d.zIndex,
        clipPath: d.clipPath,
        effects: d.effects,
        visible: true,
      });
    }

    // Subtitles handled in phase 6 as a top-z layer.
    this.compositor.render(this.renderer, width, height);
    return this.renderer.readFrame(width, height, timelineMs);
  }
}
```

Note: `decoderPool.getFrameAt()` is the hot primitive. It must:
- Serve from an in-flight or cached frame immediately if available.
- Enqueue a decode + return the nearest available frame (not block the tick).
- Let the caller know if a frame is approximate (for metrics).

### `RendererFactory.ts`

```ts
export async function createRenderer(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Renderer> {
  const webgl2 = canvas.getContext("webgl2");
  if (webgl2) return new Webgl2Renderer(webgl2, canvas);
  const c2d = canvas.getContext("2d");
  if (!c2d) throw new Error("no render context");
  return new Canvas2dRenderer(c2d, canvas);
}
```

WebGPU is deferred (noted in roadmap). Do not add it in this phase.

### `GpuCompositor.ts`

```ts
export interface CompositeLayer {
  id: string;
  texture: VideoFrame | ImageBitmap | HTMLCanvasElement | OffscreenCanvas;
  transform: ClipTransform;
  opacity: number;
  zIndex: number;
  clipPath?: ClipPath | null;
  effects?: { contrast?: number; warmth?: number };
  visible: boolean;
}

export class GpuCompositor {
  private layers = new Map<string, CompositeLayer>();
  private sorted: string[] = [];

  clear(): void { this.layers.clear(); this.sorted = []; }

  addLayer(layer: CompositeLayer): void {
    this.layers.set(layer.id, layer);
    this.sortLayers();
  }

  render(renderer: Renderer, width: number, height: number): void {
    renderer.beginFrame(width, height);
    for (const id of this.sorted) {
      const l = this.layers.get(id);
      if (!l || !l.visible) continue;
      renderer.drawLayer(l);
    }
    renderer.endFrame();
  }

  private sortLayers(): void {
    this.sorted = [...this.layers.keys()].sort((a, b) => {
      return (this.layers.get(a)!.zIndex - this.layers.get(b)!.zIndex);
    });
  }
}
```

### `RenderBridge.ts` (full)

```ts
export class RenderBridge {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafHandle = 0;

  setCanvas(el: HTMLCanvasElement | null): void {
    this.canvas = el;
    this.ctx = el?.getContext("2d") ?? null;
  }

  async renderAt(timelineMs: number): Promise<void> {
    const { video: engine } = useEngineStore.getState();
    if (!engine || !this.canvas || !this.ctx) return;
    const frame = await engine.renderFrame({
      tracks: /* from timeline store */,
      subtitles: /* from timeline store */,
      timelineMs,
      width: this.canvas.width,
      height: this.canvas.height,
    });
    this.ctx.drawImage(frame.image, 0, 0);
  }

  start(): void {
    if (this.rafHandle) return;
    const loop = () => {
      const { clock } = useEngineStore.getState();
      if (!clock || !clock.playing) { this.rafHandle = 0; return; }
      void this.renderAt(clock.currentMs);
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafHandle) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = 0;
  }
}
```

`PreviewCanvas` calls `start()` on mount when `isPlaying` becomes true, `stop()` on unmount or pause. Also calls `renderAt()` once on seek/pause transitions (subscribe to clock).

## Step-by-Step

1. Branch `migration/phase-04-render`.
2. **Commit 1: moves.** Move all files listed in "Move" section, updating every import. Zero logic changes. `bun run type-check` must pass.
3. **Commit 2: factor `buildCompositorDescriptors` into `editor-core/timeline/`.** Remove the old export from `PreviewEngine.ts`; all callers import from new location.
4. **Commit 3: implement `VideoEngine`, `GpuCompositor`, `RendererFactory`.** They should produce the same pixels the old `CompositorWorker` did. Unit-test against a known tracks array + time → snapshot the `RenderedFrame` bytes.
5. **Commit 4: rewire `engineStore.initialize()` to construct them.**
6. **Commit 5: implement `RenderBridge.renderAt` / `start` / `stop`.**
7. **Commit 6: swap `PreviewCanvas` to use `RenderBridge`.** Keep old `PreviewEngine` running in parallel behind a flag? **No flags per CLAUDE.md.** Swap outright; if smoke fails, revert commit 6.
8. **Commit 7: delete `PreviewEngine.ts`, `usePreviewEngine.ts`.**
9. Smoke test thoroughly:
   - Single video clip plays.
   - Multi-track (overlay on base video) composites correctly.
   - Transitions (fade, slide) still render.
   - Scrub is responsive.
   - Effects preview (contrast / warmth adjust) still works.
10. Type-check / lint / test. Commit. PR.

## Validation

| Check | How |
| --- | --- |
| Pixel parity with old engine | Snapshot 5 frames at fixed times before & after; diff. Max ΔE < 2 per pixel. |
| FPS | DevTools Perf: target **≥ 55 FPS** on 1080p, 3-clip project. |
| No `PreviewEngine` imports | `grep -rn "PreviewEngine" frontend/src` — no hits. |
| Engine is React-free | `grep -rn "react" frontend/src/editor-core` — no hits (except in *.md). |
| ESLint boundary | `bun run lint` still enforces the boundary. |
| Export still works | Old export path untouched in this phase — must still succeed. |

## Exit Criteria

- `PreviewEngine.ts` and `usePreviewEngine.ts` **deleted**.
- Preview canvas driven by `RenderBridge` + `VideoEngine`.
- `editor-core/video/` owns compositor + decoders + renderers.
- Pixel parity validated.
- FPS ≥ 55.

## Rollback

Revert phase-04 PR. The move commits are benign, so a revert cleanly restores everything. Risk is moderate — validate pixel parity carefully before merging.

## Estimate

4–5 days. Biggest phase. The moves are mechanical but numerous. The logic consolidation is subtle (frame timing, decoder pool integration). Plan for at least a day of pixel-diff debugging.

## Out of Scope

- Proper LRU cache (phase 5)
- Caption rendering through this pipeline (phase 6)
- Export unification (phase 7)
- WebGPU (later, separate phase if ever)

## Perf Budget Gate

Do not merge unless:

- FPS ≥ 55 on a 3-clip 1080p project during continuous playback.
- Scrub responds within 50 ms visually (drop one "low-quality" frame then ≤1 frame later the full one).
- Profiler commits in 10s playback: only `PlayheadDisplay` + `PlayheadLine` components (the only `usePlayheadMs` consumers) should commit. ≤ 60×10×2 = 1200 commits total, but only on those two components.

If any fails, investigate before merging. The whole point of phase 3 + 4 is the measurable FPS lift.
