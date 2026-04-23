# Preview Bugs — Debug Report

## Bug 1 — WebGL caption text flipped 180° at top of screen

### Symptom

Captions that should sit at the bottom render at the top of the preview canvas, visually mirrored (chars upside-down). Only on the WebGL2 renderer. Canvas2D path fine.

### Root cause

`frontend/src/features/editor/engine/compositor/Webgl2CompositorRenderer.ts` combines `UNPACK_FLIP_Y_WEBGL=true` with standard top-left-origin UVs. That combo is inverted.

Two pieces interact:

1. `getOrUploadFrameTexture` (line 440) and `drawOverlay` (line 456) both call:
  ```ts
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
   gl.texImage2D(...);
  ```
   `UNPACK_FLIP_Y_WEBGL=true` reverses source rows during unpack. Source visual-top row (row 0 of canvas/bitmap) ends up at the **last** memory row → sampled at **v=1**. Source visual-bottom ends up at memory row 0 → sampled at **v=0**.
2. `buildFullscreenQuad` (line 636) and `buildTransformedQuad` (line 599) both emit UVs:
  - top-left vert → UV `(0,0)`
  - top-right → `(1,0)`
  - bottom-left → `(0,1)`
  - bottom-right → `(1,1)`

Vertex shader maps `a_position.y=0` → screen top via `gl_Position.y = -clipSpace.y` (line 232). So top of screen samples **v=0**, which with FLIP_Y=true points at the visual **bottom** of the source canvas/bitmap.

Net: overlay canvas + video frames both render upside-down in WebGL. Caption is most noticeable because it's normally positioned at the bottom of the source canvas — flipped, it slams into the top of the preview.

### Why canvas2d works

Canvas2dCompositorRenderer calls `ctx.drawImage(...)` directly with canvas-native top-left orientation. Never touches `UNPACK_FLIP_Y_WEBGL`. No inversion.

### Why you didn't notice the video flip too

Bug 2 (black screen) means no video pixels ever reach the canvas on the WebGL path. The flip is there; it's just invisible because the texture is empty/unbound.

### Fix options (pick one)

**A. Stop flipping on upload.** Drop both `pixelStorei(UNPACK_FLIP_Y_WEBGL, true)` calls. Source row 0 lands at v=0 naturally. Top of quad samples v=0 = visual top. Done.

**B. Swap UV V-coordinate.** Keep FLIP_Y, but reverse V in both quad builders:

- `buildFullscreenQuad`: top UVs → `v=1`, bottom UVs → `v=0`
- `buildTransformedQuad`: topLeft `(0,1)`, topRight `(1,1)`, bottomLeft `(0,0)`, bottomRight `(1,0)`

**A is simpler** — no reason for FLIP_Y here since the vertex shader already handles the canvas→clip-space Y inversion.

---

## Bug 2 — Video never appears (black screen)

Black screen happens regardless of playhead. Two suspect paths found during code walk. Most likely is the decoder-description extraction, second is a texture upload failure that currently has no fallback.

### Suspect 1 (highest confidence) — broken `getVideoDescription` for H.264/H.265

`frontend/src/features/editor/engine/ClipDecodeWorker.ts:585-612`:

```ts
const stream = new MultiBufferStream();
configBox.write(stream);

const recordLength = stream.byteLength - 8;
if (recordLength <= 0) return undefined;

this.cachedDecoderDescription = new Uint8Array(
  stream.buffer as ArrayBuffer,
  8,
  recordLength
);
```

Problems:

- `MultiBufferStream` is mp4box's concatenated-buffer stream. `stream.buffer` is not guaranteed to be a single `ArrayBuffer` of length `stream.byteLength`. The `as ArrayBuffer` cast silently hides that.
- Even if it is, the layout assumption "`[4 size][4 fourcc][N record]`" is mp4box's full-box serialization. `configBox.write(stream)` may or may not prepend size+fourcc depending on mp4box version; an offset of 8 can chop off real config bytes.
- For `hvcC`, the config record has a slightly different layout — offset of 8 still works for the outer box but the record parsing by WebCodecs may be different.

If `description` is wrong, `VideoDecoder.configure()` succeeds but the first `decode()` throws → `error:` callback fires → `postError` → `DecoderPool.handleWorkerFailure` → worker destroyed and asset cooldown for `DECODE_FAILURE_COOLDOWN_MS`. Reconciliation never resurrects it because the same asset keeps cooling. Result: zero frames ever queued → `pickFrame` returns null → compositor clears to black.

**To confirm:** open devtools, look for `[DecoderPool] Worker error for clip …` or a `VideoDecoder` exception. If you see that, description is the cause.

**Fix:** replace the hand-rolled slice with a known-good extractor. Easiest — use mp4box's own `getTrackById(id).mdia.minf.stbl.stsd.entries[0].avcC` and write with `DataStream` (not MultiBufferStream), then slice exactly the record bytes. Or read from sample.description path that webcodecs examples use — the `description` on the sample already contains the parsed config record on recent mp4box releases.

### Suspect 2 — WebGL `texImage2D(VideoFrame)` failure with no fallback

`Webgl2CompositorRenderer.getOrUploadFrameTexture` (line 429-446) has no try/catch around `gl.texImage2D(..., frame)`. Some GPU/driver combos reject `texImage2D` of a VideoFrame directly (notably older Intel drivers and hardware-decoded NV12 frames). Exception bubbles through `drawClipFrame` → `render` → tick handler in worker. The worker has no catch, so the exception is uncaught in the worker — the tick aborts before `drawOverlay`, canvas stays whatever it was (black from `gl.clear` at the start of `render`), and the renderer never returns `false`, so `RENDERER_FALLBACK_REQUIRED` is never sent. Canvas2d fallback never triggers.

**To confirm:** devtools console of the compositor worker. Look for `Uncaught (in promise) ... texImage2D: ...`.

**Fix:**

- Wrap `texImage2D` in try/catch in `getOrUploadFrameTexture`; on failure return null.
- Make `render` return `false` if any frame failed to upload so the main thread falls back to canvas2d.
- Or upload VideoFrame via `createImageBitmap(frame)` first (most portable, slightly slower), then upload the ImageBitmap.

### Suspect 3 (low confidence) — WASM-built descriptors returning `enabled:false` or `opacity:0`

`getDrawableClips` (`types.ts:107`) filters out `!clip.enabled || clip.opacity <= 0`. Possible if `build_compositor_descriptors_core` in `frontend/editor-core/src/lib.rs` gets track data where `enabled` deserializes as `Some(false)` or `is_active` is false across the whole timeline. Unlikely to cause a **permanent** black screen though — when playhead is inside a clip, `is_active=true` and `base_opacity=1.0`. Check the editor document once with `console.log` on the descriptor output to rule this out.

### Diagnostic order

1. Open devtools → Sources → check CompositorWorker + ClipDecodeWorker console output.
2. If `[DecoderPool] Worker error for clip …` present → Suspect 1 (description).
3. If `texImage2D` exception logged → Suspect 2 (upload fallback).
4. If neither, log `request.clips` at top of `Webgl2CompositorRenderer.render` and check each clip's `enabled`/`opacity`/`pickFrame` return — if `pickFrame` always returns null, the frame queue is empty → back to Suspect 1.

