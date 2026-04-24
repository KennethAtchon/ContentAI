# Phase 6 — Pure-Function Captions

> Replace the React-coupled caption rendering (`useCaptionCanvas` + `CaptionLayer.tsx` + async `createImageBitmap` + `captionBitmapVersion` counter) with a pure `renderCaptionFrame(caption, t) → Segment[]` function painted inline by the main compositor.
> After this phase: captions appear in the same canvas as video. Preview ≡ export for captions (export is unified in phase 7, but the caption path is ready).

## Goal

1. `renderCaptionFrame(caption, t)` is a pure function returning `CaptionSegment[]`.
2. `VideoEngine.renderFrame()` queries the caption (subtitles + text clips) and paints segments to an offscreen canvas used as a top-z composite layer.
3. `CaptionLayer.tsx` (hidden React canvas) and `useCaptionCanvas` hook are **deleted**.
4. No more `captionBitmapVersion` rerender loop.
5. `EditorWorkspace` drops all caption-specific state.
6. Caption inspector panel (user edits style, transcript, preset) continues to work: mutations flow into timeline store; no separate "bitmap version" plumbing.

## Preconditions

- Phase 4 merged (unified render pipeline).
- Phase 5 merged (frame cache) — not strictly required but keeps us linear.

## Files Touched

### Implement
- `frontend/src/editor-core/text/renderCaptionFrame.ts` — pure fn
- `frontend/src/editor-core/text/caption-types.ts` — `CaptionSegment`, `AnimatedCaptionFrame`
- `frontend/src/editor-core/text/paintCaptionToCanvas.ts` — takes `Segment[]` + a 2D context, paints. No React.
- `frontend/src/editor-core/text/SubtitleEngine.ts` — CRUD (add, remove, update, SRT import). Keep simple; this is the data layer.
- `frontend/src/editor-core/text/TitleEngine.ts` — text-clip data layer (separate from subtitles)
- `frontend/src/features/editor/bridges/TextBridge.ts` — glue: React caption-editor UI calls this, which calls engines

### Modify
- `frontend/src/editor-core/video/VideoEngine.ts` — in `renderFrame()`: after video layers added, build a caption canvas via `paintCaptionToCanvas`, add as top-z layer
- `frontend/src/features/editor/caption/renderer.ts` — rewrite as thin wrapper that delegates to `renderCaptionFrame` + `paintCaptionToCanvas`; the existing `slice-tokens.ts`, `layout-engine.ts`, `page-builder.ts`, `apply-style-overrides.ts`, `font-loader.ts`, `text-transform.ts`, `easing.ts` MOVE into `editor-core/text/` and lose any React-coupled imports
- `frontend/src/features/editor/caption/hooks/useCaptionCanvas.ts` — **delete**
- `frontend/src/features/editor/components/caption/CaptionLayer.tsx` — **delete**
- `frontend/src/features/editor/components/layout/EditorWorkspace.tsx` — remove caption canvas mount, remove `captionBitmapVersion` state, remove `onBitmapReady` callbacks
- `frontend/src/features/editor/caption/hooks/useCaptionDoc.ts`, `useCaptionPresets.ts`, `useUpdateCaptionDoc.ts`, `useTranscription.ts` — keep; they feed the timeline store. Just ensure they no longer call `renderAtTime`

### Files That Already Exist And Will Be Moved (no logic change inside the move)
- `frontend/src/features/editor/caption/slice-tokens.ts` → `frontend/src/editor-core/text/slice-tokens.ts`
- `frontend/src/features/editor/caption/layout-engine.ts` → `frontend/src/editor-core/text/layout-engine.ts`
- `frontend/src/features/editor/caption/page-builder.ts` → `frontend/src/editor-core/text/page-builder.ts`
- `frontend/src/features/editor/caption/apply-style-overrides.ts` → `frontend/src/editor-core/text/apply-style-overrides.ts`
- `frontend/src/features/editor/caption/font-loader.ts` → `frontend/src/editor-core/text/font-loader.ts`
- `frontend/src/features/editor/caption/text-transform.ts` → `frontend/src/editor-core/text/text-transform.ts`
- `frontend/src/features/editor/caption/easing.ts` → `frontend/src/editor-core/text/easing.ts`
- `frontend/src/features/editor/caption/types.ts` → `frontend/src/editor-core/text/caption-types.ts`

After moves: `frontend/src/features/editor/caption/` contains only `components/` and `hooks/` (the React side — panels, transcript editor, preset picker).

## Key Implementations

### `renderCaptionFrame.ts`

```ts
import { sliceTokens } from "./slice-tokens";
import { buildPages } from "./page-builder";
import { applyStyleOverrides } from "./apply-style-overrides";
import type { CaptionDoc, CaptionPreset, CaptionSegment, LayoutBox } from "./caption-types";

export interface RenderCaptionArgs {
  doc: CaptionDoc;
  preset: CaptionPreset;
  timelineMs: number;
  layoutBox: LayoutBox;
}

export function renderCaptionFrame(args: RenderCaptionArgs): CaptionSegment[] {
  const { doc, preset, timelineMs, layoutBox } = args;
  const slice = sliceTokens(doc, timelineMs);
  if (!slice.visible) return [];
  const pages = buildPages(slice, preset, layoutBox);
  return applyStyleOverrides(pages, preset, timelineMs);
}
```

Pure. No canvas, no React, no async. Given `(doc, preset, t, box)` → `CaptionSegment[]`. Unit-testable trivially.

### `paintCaptionToCanvas.ts`

```ts
export function paintCaptionToCanvas(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  segments: CaptionSegment[],
): void {
  for (const seg of segments) {
    ctx.save();
    ctx.globalAlpha = seg.opacity;
    ctx.fillStyle = seg.color;
    ctx.font = `${seg.fontWeight} ${seg.fontSize}px ${seg.fontFamily}`;
    if (seg.background) {
      ctx.fillStyle = seg.background.color;
      ctx.fillRect(seg.background.x, seg.background.y, seg.background.width, seg.background.height);
      ctx.fillStyle = seg.color;
    }
    ctx.fillText(seg.text, seg.x, seg.y);
    ctx.restore();
  }
}
```

(Adapt to whatever richer rendering the current `renderer.ts` does — shadows, outlines, word-highlight colors. Key point: sync function, no `createImageBitmap`.)

### VideoEngine wiring

```ts
async renderFrame(args: RenderFrameArgs): Promise<RenderedFrame> {
  this.compositor.clear();

  // ... video layers (unchanged from phase 4)

  // Caption layer (top z):
  const { doc, preset } = args.caption;  // passed from RenderBridge via timeline store
  if (doc && preset) {
    const segments = renderCaptionFrame({
      doc, preset,
      timelineMs: args.timelineMs,
      layoutBox: { x: 0, y: 0, width: args.width, height: args.height },
    });
    if (segments.length > 0) {
      const captionCanvas = this.getOrCreateCaptionCanvas(args.width, args.height);
      const cctx = captionCanvas.getContext("2d")!;
      cctx.clearRect(0, 0, args.width, args.height);
      paintCaptionToCanvas(cctx, segments);
      this.compositor.addLayer({
        id: "__caption__",
        texture: captionCanvas,
        transform: DEFAULT_TRANSFORM,
        opacity: 1,
        zIndex: 1_000_000,
        visible: true,
      });
    }
  }

  this.compositor.render(this.renderer, args.width, args.height);
  return this.renderer.readFrame(args.width, args.height, args.timelineMs);
}
```

`getOrCreateCaptionCanvas` reuses one `OffscreenCanvas` per `VideoEngine` instance. No new canvas per frame.

### `RenderBridge.renderAt` (updated)

```ts
async renderAt(timelineMs: number): Promise<void> {
  const { video } = useEngineStore.getState();
  const tl = useTimelineStore.getState();
  const frame = await video.renderFrame({
    tracks: tl.tracks,
    subtitles: tl.subtitles,
    caption: { doc: tl.captionDoc, preset: tl.captionPreset },
    timelineMs,
    width: this.canvas.width,
    height: this.canvas.height,
  });
  this.ctx.drawImage(frame.image, 0, 0);
}
```

### `TextBridge.ts`

```ts
export class TextBridge {
  importSRT(srt: string): void { /* SubtitleEngine.importSRT + push to timelineStore */ }
  updateCaptionDoc(patch: Partial<CaptionDoc>): void { /* push to timelineStore */ }
  setPreset(presetId: string): void { /* push to timelineStore */ }
}
```

## Step-by-Step

1. Branch `migration/phase-06-captions`.
2. **Commit 1: moves.** Move all `caption/*.ts` files (slice-tokens, layout-engine, etc.) into `editor-core/text/`. Update imports. No logic changes.
3. **Commit 2: add `renderCaptionFrame` + `paintCaptionToCanvas`.** Extract the pure pieces from the current `caption/renderer.ts`. Verify via snapshot test: given a known `(doc, preset, t)`, segments match a golden file.
4. **Commit 3: integrate into `VideoEngine.renderFrame`.** Captions now paint on the main canvas.
5. **Commit 4: delete React caption plumbing.**
   - Delete `CaptionLayer.tsx`.
   - Delete `useCaptionCanvas.ts`.
   - Remove `captionBitmapVersion`, `onBitmapReady`, the hidden caption canvas from `EditorWorkspace.tsx`.
6. **Commit 5: TextBridge** for the caption editor UI (existing panels continue working by calling it instead of the old hook plumbing). Only the wiring changes; the panels themselves don't change.
7. Smoke:
   - Open a project with captions.
   - Play — captions appear in the preview canvas.
   - Scrub — captions update instantly, no async lag.
   - Edit transcript — preview updates.
   - Change preset — preview updates.
   - Play a project without captions — no regressions.
8. Type-check, lint, test. PR.

## Validation

| Check | How |
| --- | --- |
| Pure fn snapshot tests | Golden tests pass |
| No more `useCaptionCanvas` | `grep -rn "useCaptionCanvas" frontend/src` → no hits |
| No `captionBitmapVersion` | `grep -rn "captionBitmapVersion" frontend/src` → no hits |
| No React imports in `editor-core/text/` | `grep -rn "from \"react" frontend/src/editor-core/text` → no hits |
| Captions render every frame | Visually verify during playback; no flicker on preset change |
| Commits drop further | Profiler: caption editing no longer triggers whole-workspace rerender |

## Exit Criteria

- Captions paint inline in the main canvas via pure function.
- No more hidden React canvas.
- No more bitmap version rerender loop.
- `editor-core/text/` is React-free.

## Rollback

Revert phase-06 PR. Moves in commit 1 may conflict with any parallel edits in `caption/`; keep PR short-lived.

## Estimate

3–4 days. The logic in `slice-tokens`, `layout-engine`, `page-builder`, `apply-style-overrides` is already substantially pure — moving is straightforward. The tricky part is extracting any hidden coupling (font loading, measurements) that assumed a React canvas lifecycle.

## Perf Budget Gate

- Caption-heavy project (karaoke, word-by-word): FPS still ≥ 55.
- Commits during 10s playback on caption-heavy project: only playhead consumers. No `EditorWorkspace` commits.
