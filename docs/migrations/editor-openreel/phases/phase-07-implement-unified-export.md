# Phase 7 — Unified Export (Preview ≡ Export)

> Collapse `services/client-export.ts` (760 lines) into a thin `ExportEngine` that calls the same `VideoEngine.renderFrame()` as preview. Eliminate the parallel export render path.
> After this phase: whatever appears in preview will appear in export, byte-identical (modulo encoder).

## Goal

1. `ExportEngine.exportVideo(args)` is a generator that:
   - Walks frames `for i in 0..totalFrames`, calls `videoEngine.renderFrame({ ..., timelineMs: i / fps * 1000 })`.
   - Feeds each `RenderedFrame` into the encoder (same as today's `client-export.ts` — MediaBunny / `VideoSample`).
   - Yields `ExportProgress` per frame.
2. Disables frame cache preload during export (sequential, deterministic — no parallel decode races).
3. No bespoke compositor descriptor code in the export service — uses `editor-core/timeline/buildCompositorDescriptors` via `VideoEngine`.
4. Audio export remains in `client-export.ts` for now (it's orthogonal); just video path unifies.
5. `services/client-export.ts` shrinks to an orchestrator: set up writable stream → call `ExportEngine` → mux audio.

## Preconditions

- Phases 4, 5, 6 merged. `VideoEngine.renderFrame()` produces correct pixels including captions.

## Files Touched

### Implement
- `frontend/src/editor-core/export/ExportEngine.ts` — full implementation (replace phase-2 stub)
- `frontend/src/editor-core/export/types.ts` — `ExportProgress`, `VideoExportSettings`, `ExportResult`

### Modify
- `frontend/src/features/editor/services/client-export.ts` — delete the frame-building / compositor code; call `ExportEngine.exportVideo(...)`. Shrink from 760 lines to ~200 (audio mux + orchestration only).
- `frontend/src/features/editor/components/dialogs/ExportDialog.tsx` (or wherever export is triggered) — call the new entry point. API stays the same from the UI's perspective if possible.
- `frontend/src/editor-core/video/VideoEngine.ts` — add `setParallelDecoding(enabled: boolean)` so export can disable it

### Delete
- Any private helpers in `client-export.ts` duplicating compositor logic: descriptor builders, transition math, etc.
- Inline caption rendering in `client-export.ts` if present (captions now come from `VideoEngine` automatically).

## Key Implementations

### `ExportEngine.ts`

```ts
import type { VideoEngine } from "../video/VideoEngine";
import type { Track, Subtitle } from "../types/timeline";

export interface VideoExportSettings {
  readonly width: number;
  readonly height: number;
  readonly frameRate: number;
  readonly videoBitrate: number;
  readonly codec: "h264" | "h265" | "vp9" | "av1";
}

export interface ExportProgress {
  readonly phase: "preparing" | "rendering" | "encoding" | "muxing" | "complete";
  readonly progress: number;              // 0..1
  readonly currentFrame: number;
  readonly totalFrames: number;
  readonly estimatedTimeRemainingMs: number;
}

export interface ExportResult {
  readonly durationMs: number;
  readonly bytes: number;
}

export class ExportEngine {
  constructor(private readonly videoEngine: VideoEngine) {}

  async *exportVideo(args: {
    tracks: Track[];
    subtitles: Subtitle[];
    caption: unknown;
    durationMs: number;
    settings: VideoExportSettings;
    addSample: (frame: ImageBitmap | OffscreenCanvas, timestampUs: number) => Promise<void>;
  }): AsyncGenerator<ExportProgress, ExportResult> {
    const { tracks, subtitles, caption, durationMs, settings, addSample } = args;
    const totalFrames = Math.ceil((durationMs / 1000) * settings.frameRate);
    const startWall = performance.now();

    this.videoEngine.setParallelDecoding(false);    // deterministic
    try {
      for (let frame = 0; frame < totalFrames; frame++) {
        const t = (frame / settings.frameRate) * 1000;
        const rendered = await this.videoEngine.renderFrame({
          tracks, subtitles, caption,
          timelineMs: t,
          width: settings.width,
          height: settings.height,
        });

        const tsUs = Math.round((frame / settings.frameRate) * 1_000_000);
        await addSample(rendered.image as ImageBitmap, tsUs);

        const progress = (frame + 1) / totalFrames;
        const elapsed = performance.now() - startWall;
        const estimatedTotal = elapsed / progress;
        yield {
          phase: "rendering",
          progress,
          currentFrame: frame + 1,
          totalFrames,
          estimatedTimeRemainingMs: Math.max(0, estimatedTotal - elapsed),
        };
      }

      yield { phase: "complete", progress: 1, currentFrame: totalFrames, totalFrames, estimatedTimeRemainingMs: 0 };
      return { durationMs: performance.now() - startWall, bytes: 0 };
    } finally {
      this.videoEngine.setParallelDecoding(true);
    }
  }
}
```

The caller (`client-export.ts`) wires MediaBunny: creates `VideoSampleSource`, passes its `.add()` as `addSample`. `ExportEngine` doesn't know about the encoder — swap MediaBunny for another encoder later without touching this class.

### `VideoEngine.setParallelDecoding`

```ts
setParallelDecoding(enabled: boolean): void {
  this.decoderPool.setParallelDecoding(enabled);
  if (!enabled) this.frameCache?.clear?.();   // start from a clean slate
}
```

Deterministic = cache purge + no concurrent decode, so frame N is decoded only after frame N-1 is consumed.

### `client-export.ts` (new shape)

```ts
export async function exportClientSide(args: {
  project: Project;
  settings: VideoExportSettings;
  onProgress(p: ExportProgress): void;
}): Promise<void> {
  const { project, settings, onProgress } = args;
  const file = await makeOutputFile(settings);
  const videoSource = file.addVideoTrack(settings);
  const audioSource = file.addAudioTrack(project);   // audio path unchanged for now

  const exportEngine = new ExportEngine(useEngineStore.getState().video!);

  // Video pass
  for await (const progress of exportEngine.exportVideo({
    tracks: project.tracks,
    subtitles: project.subtitles,
    caption: project.caption,
    durationMs: project.durationMs,
    settings,
    addSample: (bmp, tsUs) => videoSource.add(new VideoSample(bmp, { timestamp: tsUs, /* ... */ })),
  })) {
    onProgress(progress);
  }

  // Audio pass — existing implementation
  await exportAudioPass(audioSource, project, onProgress);

  await file.save(`${project.name}.mp4`);
}
```

## Step-by-Step

1. Branch `migration/phase-07-unified-export`.
2. Implement `ExportEngine` with a unit test that exports a 1-second synthetic project, counts frames produced, asserts `yields.length === fps`.
3. Add `setParallelDecoding` to `VideoEngine` + `DecoderPool`.
4. Rewrite `client-export.ts` video pass to use `ExportEngine`. Delete duplicated descriptor/compositor code.
5. Preserve audio pass as is (separate concern).
6. Smoke:
   - Export a 3-clip project with captions.
   - Compare exported frames (ffmpeg extract at t=0, 1, 2, 3 seconds) vs preview canvas screenshots at same times. Diff < 2 ΔE per pixel.
   - Export a project with transitions — transitions render correctly.
   - Progress bar updates smoothly.
7. Type-check, lint, test. PR.

## Validation

| Check | How |
| --- | --- |
| Preview ≡ export | Pixel diff script: `ffmpeg -ss N -vframes 1 out.mp4 frame.png` vs `preview.png` |
| No duplicate compositor code | `grep -rn "buildCompositorDescriptors\|buildCompositorClips" frontend/src/features/editor/services` → no hits |
| Export still muxes correctly | Open exported MP4 in VLC; plays through; audio in sync |
| Progress yields | UI progress bar advances smoothly, not jumping |
| Determinism | Export twice; byte-compare video track — should be identical (same frames, same encoder) |

## Exit Criteria

- `client-export.ts` no longer builds frames; delegates to `ExportEngine`.
- `ExportEngine` calls `videoEngine.renderFrame`.
- Preview and export pixels match within encoder noise.
- `client-export.ts` under 300 lines.

## Rollback

Revert phase-07 PR. Old export code is gone, so revert restores it. Validate export manually post-revert.

## Estimate

2–3 days. Most risk is in adapter semantics between `ExportEngine.exportVideo` and MediaBunny's `VideoSampleSource.add()` — get the timestamp units right (µs), the pixel format right, and the codec config right.

## Perf Budget Gate

- Export 30s, 1080p, 30fps project: ≤ 2× realtime (i.e., ≤ 60s wall time).
- Pixel parity with preview: ΔE < 2 per pixel on all sampled frames.
