# Video Preview Black Screen Root Cause

## Summary

The editor preview had two different rendering paths layered together:

1. A compositor canvas that draws captions, text, and decoded video frames.
2. A video decode path that depends on `VideoDecoder` / WebCodecs producing `VideoFrame` objects in a worker.

The reason captions could render while video stayed black is that captions do not depend on the video decode path. Caption pixels are generated separately as a bitmap and drawn onto the compositor canvas. Video pixels only appear if the decode worker successfully produces `VideoFrame`s and the compositor later picks those frames from its queue.

So the canvas was alive. The caption renderer was alive. The missing piece was video pixels.

## What Was Actually Wrong

There were three problems mixed together.

### 1. The WebGL path could draw uploaded pixels upside down

`Webgl2CompositorRenderer` uploaded video frames and overlay canvases with:

```ts
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
```

But the compositor geometry and shader were already using top-left canvas coordinates. That meant uploaded textures were flipped relative to the UVs. Captions were the easiest symptom to see because caption text that belonged at the bottom appeared at the top and upside down.

This was a real bug, but it was not the whole black-screen issue.

### 2. WebGL video-frame upload failures did not trigger fallback

Some browsers/drivers can reject:

```ts
gl.texImage2D(..., frame)
```

when `frame` is a `VideoFrame`.

Before the fix, that exception could abort the compositor tick after the canvas had already been cleared. Since the renderer did not report failure, the app did not switch to the Canvas2D compositor. Result: black preview.

This was also a real bug, but it still assumed the decode worker had successfully produced frames.

### 3. The bigger issue: video preview depended entirely on WebCodecs

The decode pipeline uses `VideoDecoder` in `ClipDecodeWorker` to turn MP4 samples into `VideoFrame`s. If `VideoDecoder` is missing, unsupported, partially implemented, or fails for that browser/codec, no video frames ever reach the compositor.

That explains the important symptom:

- Captions render because they are just bitmap overlays.
- The preview background remains black because no video frame is available underneath those overlays.

The debug snapshot you showed had compositor/caption activity, but no useful video-frame proof. That pointed away from "canvas is broken" and toward "video frames are not reaching the canvas."

This is especially relevant in Firefox or any browser where WebCodecs support is incomplete compared with Chromium.

## Why Previous Fixes Fell Short

The earlier fixes attacked pieces of the compositor/decode stack:

- texture orientation
- texture upload exceptions
- decoder description extraction
- repaint after decoded frames arrive while paused

Those are legitimate fixes, but they were still WebCodecs-first. If the browser never produces `VideoFrame`s, the compositor has nothing to draw regardless of those fixes.

That is why captions could keep rendering while video stayed black.

## Current Fix Direction

The editor should stay compositor-only. The preview should not use a hidden or layered DOM `<video>` as a parallel rendering path.

The fixes kept in the compositor/decode path are:

- correct WebGL texture orientation
- report WebGL `VideoFrame` upload failure instead of silently staying black
- repaint the compositor when a decoded frame arrives after an initial paused tick
- make H.264/H.265 decoder config extraction less brittle

If video is still black after those fixes, the next debugging target is the WebCodecs decode pipeline itself:

1. Does `ClipDecodeWorker` post `READY`?
2. Does it post `FRAME`?
3. Does `DecoderPool` accept or drop that frame?
4. Does `CompositorWorker` enqueue it under the same `clipId` used by the render descriptor?
5. Does `pickFrame` return a frame for the current `sourceTimeUs`?

## Files Changed For The Fix

- `frontend/src/features/editor/engine/compositor/Canvas2dCompositorRenderer.ts`
  - Remains the compositor-owned Canvas2D renderer.

- `frontend/src/features/editor/engine/compositor/Webgl2CompositorRenderer.ts`
  - Removes the Y-flip upload.
  - Reports failed `VideoFrame` texture upload so fallback can happen.

- `frontend/src/features/editor/engine/PreviewEngine.ts`
  - Repaints when a decoded frame arrives while paused.

- `frontend/src/features/editor/engine/ClipDecodeWorker.ts`
  - Makes decoder config extraction less brittle for H.264/H.265.

## How To Verify In The Browser

Hard refresh the editor page so worker/module cache is cleared.

Then test:

1. Open a project with a video clip.
2. Stay paused at a time inside the clip.
3. Confirm the video image appears behind captions.
4. Press play.
5. Scrub the playhead.

If video is still missing, run:

```js
window.__REEL_EDITOR_DEBUG__?.snapshot()
```

Useful fields:

- `debug.previewEngine.metrics.decodedFrameCount`
  - If this is `0`, the decode worker is not producing accepted frames.

- `debug.previewEngine.metrics.decoderPool`
  - Shows active workers, ready workers, pending seeks, accepted frame counts, and stale frame drops.

- `debug.compositorWorker.frameQueueSizes`
  - If this is empty while decoded frames are expected, frames are not reaching the compositor worker.

- `debug.compositorWorker.clipCount`
  - If this is `0`, the render descriptors do not include an active video clip.

## Bottom Line

The black preview was not one single canvas bug.

The exact visible failure was: video frames were not reliably available to the compositor, while captions were independently available and therefore continued to render.

The fix should be in the compositor/decode pipeline, not by adding a second DOM video renderer. If the compositor still does not show video, the next patch should instrument and fix the exact point where `VideoFrame`s stop moving through the pipeline.
