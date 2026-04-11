# Phase 4: Transitions, Speed, and Edge Cases

**Goal:** All transition types render correctly in the compositor. Variable-speed clips display at the correct source frame. Captions appear. Disabled clips are invisible. `effectPreviewOverride` works. Multi-track video composites in the correct z-order.

**Done criteria:**
- Fade, dissolve, slide, and wipe transitions render correctly while audio plays
- A speed-2x clip shows source frames at double rate
- A `enabled: false` clip contributes nothing to the compositor output
- Caption overlays appear on the canvas
- No blank frame appears at the transition boundary

---

## Transitions are already wired

`PreviewEngine.buildCompositorClips()` already calls `getOutgoingTransitionStyle` and `getIncomingTransitionStyle` (the same functions used by the old renderer). The results land as `opacity`, `transform`, and `clipPath` on each `CompositorClipDescriptor`. The compositor worker reads these and applies them during `composite()`.

**What remains:**
1. The `applyClipPath` function in `CompositorWorker.ts` handles only `inset()` — extend it for `polygon()` (used by slide transitions).
2. During a transition, **both** the outgoing and incoming clip must be in the compositor's frame queue simultaneously. Confirm `DecoderPool.update()` keeps both clips warm during the transition window.

---

## Step 1 — Extend `applyClipPath` for slide transitions

Slide transitions use a CSS `transform` (not `clipPath`) to move frames on/off screen. No clipPath change needed for slides — `applyTransform` already handles translate.

Wipe transitions use `clipPath: "inset(0 50% 0 0)"` style values. The existing `applyClipPath` in `CompositorWorker.ts` handles `inset()`. Confirm the regex handles percentages correctly with a manual test:

```ts
// In CompositorWorker.ts — verify inset regex covers "inset(0 50% 0 0)":
// Input: "inset(0 50% 0 0)"
// Expected: clip to left 50% of canvas width
const clipPath = "inset(0 50% 0 0)";
const match = clipPath.match(/inset\(\s*([\d.]+)%?\s+([\d.]+)%?\s+([\d.]+)%?\s+([\d.]+)%?\s*\)/);
// match[1]=0, match[2]=50, match[3]=0, match[4]=0
// right = 50/100 * canvasWidth = 640px → rect(0, 0, 640, canvasHeight) ✓
```

For `fade` transitions: opacity is already applied via `ctx.globalAlpha`. No additional code needed.

For `dissolve` transitions: same as fade — opacity-based. Already handled.

---

## Step 2 — Keep both transition clips warm in `DecoderPool`

**File:** `frontend/src/features/editor/engine/DecoderPool.ts`

The current `update()` method checks only `clip.startMs` and `clip.startMs + clip.durationMs` against `playheadMs ± DECODE_WINDOW_MS`. This already covers both clips in a transition because:
- The outgoing clip's `startMs + durationMs` extends to the end of the transition window
- The incoming clip's `startMs` is within the transition window

No change needed here. But add a comment to make this explicit:

```ts
// In DecoderPool.update(), inside the clip loop — add this comment:
// DECODE_WINDOW_MS is intentionally large enough to overlap transition windows.
// Both the outgoing and incoming clip in a transition will be within the window simultaneously.
```

---

## Step 3 — Speed: correct source frame selection

Speed is already handled correctly by `getClipSourceTimeSecondsAtTimelineTime()`. The `DecoderPool` passes `trimStartMs` and `speed` to the worker on `LOAD`. When the compositor sends a `TICK` at `playheadMs`, the engine calls `getClipSourceTimeSecondsAtTimelineTime(clip, playheadMs)` and the decoder has already decoded the correct source frame at that source position.

**Verify this end-to-end:**
1. Add a video clip with `speed: 2`.
2. At timeline position 1000ms, the source frame should be at `trimStartMs + 1000 * 2 = trimStartMs + 2000ms`.
3. Confirm the canvas shows a visually "later" frame than a `speed: 1` clip at the same timeline position.

No code change needed — the math is correct. Add a note in `ClipDecodeWorker.ts`:

```ts
// In ClipDecodeWorker.ts, LOAD handler — add this comment:
// speed is stored for reference but source time calculations are performed
// by the main thread (PreviewEngine.buildCompositorClips → getClipSourceTimeSecondsAtTimelineTime).
// The worker receives seek targets already in source-media time.
```

---

## Step 4 — Disabled clips

`buildCompositorClips()` in `PreviewEngine.ts` already sets `enabled: false` when `clip.enabled === false`, and `opacity: 0`. The compositor worker skips the `drawImage` call when `!clip.enabled || clip.opacity === 0`.

**Add an early-exit for disabled clips in the compositor:**

**File:** `frontend/src/features/editor/engine/CompositorWorker.ts`

In the `composite()` function, change:
```ts
// Existing code:
for (const clip of sorted) {
  if (!clip.enabled || clip.opacity === 0) continue;
```

This is already correct. Confirm the check is at the top of the loop body.

---

## Step 5 — Caption integration

The caption layout engine (`caption/layout-engine.ts`) uses `ctx.measureText()` and produces a `CaptionLayout` object. The renderer (`caption/renderer.ts`) draws to a canvas context. Both require a canvas context — they cannot run inside `CompositorWorker` directly.

**Solution:** Run the caption renderer on the main thread, convert the output to an `ImageBitmap`, and transfer it to the compositor as part of the `OVERLAY` message.

**Step 5a — Adapt `useCaptionCanvas` to produce an `ImageBitmap`**

The existing `useCaptionCanvas` hook already draws captions to an offscreen `<canvas>` element (the `captionCanvasRef`). Extend it to also produce an `ImageBitmap` that can be posted to the compositor worker.

**File:** `frontend/src/features/editor/caption/hooks/useCaptionCanvas.ts`

Read this file first to understand its current shape before editing. Then add an `onBitmapReady` callback parameter:

```ts
interface UseCaptionCanvasParams {
  clip: CaptionClip | null;
  doc: CaptionDoc | null;
  preset: TextPreset | null;
  currentTimeMs: number;
  canvasW: number;
  canvasH: number;
  /** Called after each frame render with a transferable ImageBitmap. */
  onBitmapReady?: (bitmap: ImageBitmap) => void;
}
```

At the end of the render effect (wherever `ctx.fillText` or the renderer draws to the canvas), add:

```ts
// After drawing is complete:
if (onBitmapReady && canvasRef.current) {
  createImageBitmap(canvasRef.current).then((bitmap) => {
    onBitmapReady(bitmap);
  });
}
```

**Step 5b — Wire into `usePreviewEngine`**

In `usePreviewEngine.ts`, the `onTimeUpdate` callback currently calls `canvas.tick(ms, clips, [], null)`. To add captions, we need the latest caption bitmap from `useCaptionCanvas`.

Add a `captionBitmapRef` to `usePreviewEngine`:

```ts
// In usePreviewEngine.ts params:
captionBitmapRef: React.MutableRefObject<ImageBitmap | null>;
```

In `onTimeUpdate`:
```ts
onTimeUpdate(ms) {
  setPlayheadMs(ms);
  if (!canvasRef.current) return;
  const clips = engine.buildCompositorClips(ms);
  const captionBitmap = captionBitmapRef.current;
  captionBitmapRef.current = null; // consume it
  canvas.tick(
    ms,
    clips,
    textObjects, // see Step 5c
    captionBitmap ? { bitmap: captionBitmap } : null
  );
},
```

**Step 5c — Text overlays (non-caption text clips)**

Text clips (`type: "text"`) need to be serialized to `SerializedTextObject[]` for the compositor. Add a helper in `PreviewEngine.ts`:

```ts
buildTextObjects(timelineMs: number): SerializedTextObject[] {
  const textTrack = this.tracks.find((t) => t.type === "text");
  if (!textTrack) return [];

  return textTrack.clips
    .filter((c) => c.type === "text")
    .filter((c) => timelineMs >= c.startMs && timelineMs < c.startMs + c.durationMs)
    .map((c) => {
      const clip = c as import("../types/editor").TextClip;
      return {
        text: clip.textContent ?? "",
        x: this.canvasWidth / 2 + (clip.positionX ?? 0),
        y: this.canvasHeight / 2 + (clip.positionY ?? 0),
        fontSize: clip.textStyle?.fontSize ?? 32,
        fontWeight: clip.textStyle?.fontWeight ?? "normal",
        color: clip.textStyle?.color ?? "#fff",
        align: (clip.textStyle?.align as CanvasTextAlign) ?? "center",
        opacity: clip.opacity ?? 1,
      };
    });
}
```

> Add `canvasWidth` and `canvasHeight` to `PreviewEngine` constructor, received from `PreviewCanvas` via `usePreviewEngine`. These are the resolution dimensions (e.g. 1080×1920), not the displayed canvas size. Pass them when constructing the engine in `usePreviewEngine.ts`.

---

## Step 6 — Verify

1. Add two clips with a fade transition. Play through the transition — opacity should animate smoothly, no black flash.
2. Add a wipe-right transition. The incoming clip should appear from the right edge during the transition window.
3. Add a speed-2x clip. Confirm visual playback is faster than a 1x clip.
4. Disable a clip (`enabled: false`). Confirm it is invisible in the preview.
5. Add a text overlay clip. Confirm the text appears on the canvas.
6. If captions exist in the project, confirm they render over the video.
7. Run `bun run type-check` — zero errors.

---

## Known gaps deferred to Phase 5

- The `previewCurrentTimeMs` from `useEditorLayoutRuntime` is still threaded through `EditorWorkspace` as a prop. It is only used by `WaveformBars` and `use-timeline-playhead-scroll`. Replace it with `playheadMs` from `usePreviewEngine` in Phase 5.
- `PreviewCanvas` currently shows "0:00 / 0:00" in the footer. Wire `playheadMs` and `durationMs` to show the live timecode in Phase 5.

---

## Rollback

Same as Phase 3 — disable `usePreviewEngine` and show the static canvas placeholder. No data loss.
