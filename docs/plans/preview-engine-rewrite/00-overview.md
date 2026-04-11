# Preview Engine Rewrite — Implementation Guide

> Parent plan: `docs/plans/editor-preview-engine-rewrite.md`  
> These documents are the **execution layer** of that plan. Each phase doc gives you the exact files to create, delete, and edit — with full code.

---

## What we are replacing

| Old file | Status |
|----------|--------|
| `runtime/usePreviewPlaybackBridge.ts` | **DELETE** |
| `runtime/usePreviewMediaSync.ts` | **DELETE** |
| `runtime/usePreviewMediaRegistry.ts` | **DELETE** |
| `scene/preview-scene.ts` | **DELETE** |
| `renderers/PreviewStageSurface.tsx` | **DELETE** |
| `preview-root/PreviewStageRoot.tsx` | **DELETE** |

All paths relative to `frontend/src/features/editor/`.

## What we are building

```
frontend/src/features/editor/
  engine/
    ClipDecodeWorker.ts      ← Phase 1: VideoDecoder + AudioDecoder in a Worker
    DecoderPool.ts           ← Phase 1: manages one Worker per active clip
    CompositorWorker.ts      ← Phase 2: OffscreenCanvas, composites frames
    AudioMixer.ts            ← Phase 3: AudioContext master clock + audio scheduling
    PreviewEngine.ts         ← Phase 3: top-level class wiring all subsystems
  hooks/
    usePreviewEngine.ts      ← Phase 3: React bridge to PreviewEngine
  components/
    PreviewCanvas.tsx        ← Phase 0 (stub) → Phase 2 (live canvas)
```

## What we are NOT touching

- `model/editor-reducer*.ts` — untouched
- `utils/editor-composition.ts` — untouched (especially `getClipSourceTimeSecondsAtTimelineTime`)
- `hooks/useEditorAssetMap.ts` — untouched
- `caption/layout-engine.ts`, `caption/renderer.ts` — read in Phase 4, adapted not rewritten
- All autosave, undo/redo, export, timeline interaction code

## Phase sequence

| # | Phase | Key deliverable |
|---|-------|-----------------|
| 0 | [Delete old runtime](./01-phase-0-delete-old-runtime.md) | Editor compiles with blank canvas placeholder |
| 1 | [Clip decode worker](./02-phase-1-clip-decode-worker.md) | Worker demuxes + decodes `VideoFrame` objects |
| 2 | [Compositor worker](./03-phase-2-compositor-worker.md) | Canvas shows composited video frames |
| 3 | [Audio mixer + engine](./04-phase-3-audio-mixer-and-engine.md) | Audio-clock-driven playback, full React bridge |
| 4 | [Transitions + edge cases](./05-phase-4-transitions-and-edge-cases.md) | Fades, dissolves, speed, disabled clips |
| 5 | [Observability + polish](./06-phase-5-observability.md) | Metrics, playhead Hz cleanup |

## Decisions already made

| Decision | Choice | Reason |
|----------|--------|--------|
| Demuxer | `mp4box.js` | All current assets are MP4/MOV; battle-tested |
| Audio fallback for Safari | `HTMLAudioElement` + `createMediaElementSource()` | `AudioDecoder` not available in Safari |
| Decoder workers | One Worker per active clip (DecoderPool) | Simpler ownership; revisit if dense timelines show resource pressure |
| React update Hz during playback | ~4 Hz (every 250ms) | Enough for playhead + timecode; never 60Hz React re-renders |
| Caption rendering | Serialize layout output to `CaptionFrame` struct, pass in TICK message | Layout engine uses `ctx.measureText` which requires a canvas context — adapt in Phase 4 |
