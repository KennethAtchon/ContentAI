# Phase 2: OffscreenCanvas Compositor

**Goal:** A `CompositorWorker` receives `VideoFrame` objects from the `DecoderPool`, composites active frames for the given playhead time, and posts an `ImageBitmap` to the main thread. The `PreviewCanvas` component displays this bitmap. With a static timeline and no audio clock yet, video frames appear in the canvas when `TICK` is sent manually.

**Done criteria:**
- `CompositorWorker.ts` exists and handles `INIT`, `FRAMES`, `TICK`, `OVERLAY`, `DESTROY`
- `PreviewCanvas.tsx` transfers its `OffscreenCanvas` to the compositor on mount and paints received `ImageBitmap` objects
- `DecoderPool` is wired to forward frames to the compositor
- Opening the editor and scrubbing manually shows the correct frame in the canvas

---

## Step 1 — Create `CompositorWorker.ts`

Create `frontend/src/features/editor/engine/CompositorWorker.ts`:

```ts
/**
 * CompositorWorker — runs in a Worker thread.
 *
 * Owns an OffscreenCanvas. Receives VideoFrame objects from the DecoderPool,
 * sorts them into per-clip queues, and on TICK composites the correct frames
 * for the given playhead time onto the canvas. Posts an ImageBitmap to the
 * main thread for display.
 *
 * Message protocol (main → worker):
 *   { type: 'INIT', canvas: OffscreenCanvas, width: number, height: number }
 *   { type: 'FRAME', frame: VideoFrame, timestampUs: number, clipId: string }
 *   { type: 'TICK', playheadMs: number, clips: CompositorClipDescriptor[] }
 *   { type: 'OVERLAY', textObjects: SerializedTextObject[], captionFrame: SerializedCaptionFrame | null }
 *   { type: 'DESTROY' }
 *
 * Message protocol (worker → main):
 *   { type: 'BITMAP', bitmap: ImageBitmap }
 *   { type: 'READY' }
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal descriptor for a clip that the compositor needs to draw.
 * Sent with every TICK. The main thread derives these from the timeline state.
 */
export interface CompositorClipDescriptor {
  clipId: string;
  /** Canvas z-index: 0 = bottom track, higher = on top. */
  zIndex: number;
  /** Computed opacity (0–1), already accounting for transitions and enabled state. */
  opacity: number;
  /** CSS clip-path string for wipe transitions, or null. */
  clipPath: string | null;
  /** CSS filter string (e.g. "contrast(1.2) sepia(0.3)"), or null. */
  filter: string | null;
  /** CSS transform string (e.g. "scale(1.2) translate(20px, -10px)"), or null for default. */
  transform: string | null;
  /** If false, skip this clip entirely. */
  enabled: boolean;
}

export interface SerializedTextObject {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: string;
  color: string;
  align: CanvasTextAlign;
  opacity: number;
}

export interface SerializedCaptionFrame {
  /** Pre-rendered caption pixels as an ImageBitmap. Transfer semantics: compositor closes it after drawing. */
  bitmap: ImageBitmap;
}

// ─── Worker state ─────────────────────────────────────────────────────────────

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let canvasWidth = 0;
let canvasHeight = 0;

/** Per-clip queues of decoded VideoFrame objects, sorted by timestamp ascending. */
const frameQueues = new Map<string, VideoFrame[]>();

// ─── Frame management ─────────────────────────────────────────────────────────

function enqueueFrame(clipId: string, frame: VideoFrame): void {
  if (!frameQueues.has(clipId)) frameQueues.set(clipId, []);
  const queue = frameQueues.get(clipId)!;
  queue.push(frame);
  // Keep queue sorted by timestamp (frames usually arrive in order, but guard against out-of-order delivery).
  queue.sort((a, b) => a.timestamp - b.timestamp);
  // Prune queue: keep only the most recent frame before playhead + a small lookahead.
  // This prevents unbounded memory growth during long decode-ahead runs.
  pruneQueue(clipId);
}

function pruneQueue(clipId: string): void {
  const queue = frameQueues.get(clipId);
  if (!queue || queue.length <= 4) return;
  // Close and remove all frames except the last 4. We keep a small buffer to handle
  // minor timing jitter between the decode and tick cadence.
  const toClose = queue.splice(0, queue.length - 4);
  for (const frame of toClose) frame.close();
}

/**
 * Find the best frame for the given playhead time.
 * Returns the frame with the largest timestamp ≤ playheadUs, or the earliest frame if all are ahead.
 */
function pickFrame(clipId: string, playheadUs: number): VideoFrame | null {
  const queue = frameQueues.get(clipId);
  if (!queue || queue.length === 0) return null;

  let best: VideoFrame | null = null;
  for (const frame of queue) {
    if (frame.timestamp <= playheadUs) best = frame;
    else break;
  }
  return best ?? queue[0];
}

function clearClipFrames(clipId: string): void {
  const queue = frameQueues.get(clipId);
  if (!queue) return;
  for (const frame of queue) frame.close();
  frameQueues.delete(clipId);
}

// ─── Canvas transform helpers ─────────────────────────────────────────────────

/**
 * Parse a CSS transform string into canvas operations.
 * Supports: scale(n), translate(xpx, ypx), rotate(ndeg).
 * For production, replace with a proper CSS-to-canvas matrix converter.
 */
function applyTransform(ctx: OffscreenCanvasRenderingContext2D, transform: string | null): void {
  if (!transform) return;
  const scaleMatch = transform.match(/scale\(([\d.+-]+)\)/);
  const translateMatch = transform.match(/translate\(([\d.+-]+)px,\s*([\d.+-]+)px\)/);
  const rotateMatch = transform.match(/rotate\(([\d.+-]+)deg\)/);

  if (scaleMatch) {
    const s = parseFloat(scaleMatch[1]);
    ctx.transform(s, 0, 0, s, (canvasWidth / 2) * (1 - s), (canvasHeight / 2) * (1 - s));
  }
  if (translateMatch) {
    ctx.translate(parseFloat(translateMatch[1]), parseFloat(translateMatch[2]));
  }
  if (rotateMatch) {
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    const rad = (parseFloat(rotateMatch[1]) * Math.PI) / 180;
    ctx.translate(cx, cy);
    ctx.rotate(rad);
    ctx.translate(-cx, -cy);
  }
}

// ─── Composite a single tick ───────────────────────────────────────────────────

function composite(
  playheadMs: number,
  clips: CompositorClipDescriptor[],
  textObjects: SerializedTextObject[],
  captionFrame: SerializedCaptionFrame | null
): void {
  if (!ctx || !canvas) return;

  const playheadUs = playheadMs * 1000;

  // Clear canvas.
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Sort clips by z-index ascending (lowest drawn first).
  const sorted = [...clips].sort((a, b) => a.zIndex - b.zIndex);

  for (const clip of sorted) {
    if (!clip.enabled || clip.opacity === 0) continue;

    const frame = pickFrame(clip.clipId, playheadUs);
    if (!frame) continue;

    ctx.save();
    ctx.globalAlpha = clip.opacity;

    if (clip.filter) {
      ctx.filter = clip.filter;
    }

    if (clip.clipPath) {
      // clipPath is a CSS clip-path polygon string, e.g. "inset(0 50% 0 0)".
      // Canvas 2D does not support CSS clip-path natively — convert to a Path2D.
      applyClipPath(ctx, clip.clipPath, canvasWidth, canvasHeight);
    }

    applyTransform(ctx, clip.transform);

    // Draw the frame scaled to fill the canvas (object-contain semantics).
    const frameAspect = frame.displayWidth / frame.displayHeight;
    const canvasAspect = canvasWidth / canvasHeight;
    let dx = 0, dy = 0, dw = canvasWidth, dh = canvasHeight;
    if (frameAspect > canvasAspect) {
      dh = canvasWidth / frameAspect;
      dy = (canvasHeight - dh) / 2;
    } else {
      dw = canvasHeight * frameAspect;
      dx = (canvasWidth - dw) / 2;
    }
    ctx.drawImage(frame, dx, dy, dw, dh);

    ctx.restore();
  }

  // Draw text overlays.
  for (const text of textObjects) {
    ctx.save();
    ctx.globalAlpha = text.opacity;
    ctx.font = `${text.fontWeight} ${text.fontSize}px sans-serif`;
    ctx.fillStyle = text.color;
    ctx.textAlign = text.align;
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 8;
    ctx.fillText(text.text, text.x, text.y);
    ctx.restore();
  }

  // Draw pre-rendered caption bitmap (if any).
  if (captionFrame) {
    ctx.drawImage(captionFrame.bitmap, 0, 0, canvasWidth, canvasHeight);
    captionFrame.bitmap.close();
  }

  // Transfer the composited frame to the main thread.
  const bitmap = canvas.transferToImageBitmap();
  self.postMessage({ type: "BITMAP", bitmap }, [bitmap]);
}

/**
 * Convert a CSS inset() clip-path to a canvas clipping region.
 * Handles only inset() for Phase 2/4 wipe transitions.
 * Extend this function in Phase 4 for polygon() and other shapes.
 */
function applyClipPath(
  ctx: OffscreenCanvasRenderingContext2D,
  clipPath: string,
  w: number,
  h: number
): void {
  const insetMatch = clipPath.match(
    /inset\(\s*([\d.]+)%?\s+([\d.]+)%?\s+([\d.]+)%?\s+([\d.]+)%?\s*\)/
  );
  if (!insetMatch) return;
  const top = (parseFloat(insetMatch[1]) / 100) * h;
  const right = (parseFloat(insetMatch[2]) / 100) * w;
  const bottom = (parseFloat(insetMatch[3]) / 100) * h;
  const left = (parseFloat(insetMatch[4]) / 100) * w;
  ctx.beginPath();
  ctx.rect(left, top, w - left - right, h - top - bottom);
  ctx.clip();
}

// ─── Message handler ───────────────────────────────────────────────────────────

let pendingTextObjects: SerializedTextObject[] = [];
let pendingCaptionFrame: SerializedCaptionFrame | null = null;

self.onmessage = (event: MessageEvent) => {
  const msg = event.data;

  switch (msg.type) {
    case "INIT": {
      canvas = msg.canvas as OffscreenCanvas;
      canvasWidth = msg.width;
      canvasHeight = msg.height;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      ctx = canvas.getContext("2d", { alpha: false }) as OffscreenCanvasRenderingContext2D;
      self.postMessage({ type: "READY" });
      break;
    }

    case "FRAME": {
      // Frame transferred from DecoderPool via main thread relay.
      enqueueFrame(msg.clipId, msg.frame as VideoFrame);
      break;
    }

    case "OVERLAY": {
      // Update text/caption overlay data (sent on every timeline change, not every tick).
      pendingTextObjects = msg.textObjects ?? [];
      // captionFrame carries an ImageBitmap; consume it on next TICK.
      if (pendingCaptionFrame) pendingCaptionFrame.bitmap.close();
      pendingCaptionFrame = msg.captionFrame ?? null;
      break;
    }

    case "TICK": {
      composite(msg.playheadMs, msg.clips, pendingTextObjects, pendingCaptionFrame);
      // Caption bitmap is consumed; clear so we don't redraw stale data.
      pendingCaptionFrame = null;
      break;
    }

    case "CLEAR_CLIP": {
      clearClipFrames(msg.clipId);
      break;
    }

    case "DESTROY": {
      for (const clipId of frameQueues.keys()) clearClipFrames(clipId);
      canvas = null;
      ctx = null;
      self.close();
      break;
    }
  }
};
```

---

## Step 2 — Update `PreviewCanvas.tsx`

Replace the Phase 0 placeholder with a live canvas that:
1. Transfers its `OffscreenCanvas` to the `CompositorWorker` on mount
2. Accepts an `ImageBitmap` from the compositor and paints it to the visible `<canvas>`
3. Exposes a `tick(playheadMs, clips)` method via `ref` for the engine to call

**Replace** `frontend/src/features/editor/components/PreviewCanvas.tsx` entirely:

```tsx
import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import type {
  CompositorClipDescriptor,
  SerializedTextObject,
  SerializedCaptionFrame,
} from "../engine/CompositorWorker";

export interface PreviewCanvasHandle {
  /**
   * Send a TICK to the compositor worker.
   * Call this from the rAF loop, driven by the AudioContext clock.
   */
  tick(
    playheadMs: number,
    clips: CompositorClipDescriptor[],
    textObjects: SerializedTextObject[],
    captionFrame: SerializedCaptionFrame | null
  ): void;
  /**
   * Notify the compositor of a decoded VideoFrame from the DecoderPool.
   * The frame is transferred to the worker (zero-copy).
   */
  receiveFrame(frame: VideoFrame, timestampUs: number, clipId: string): void;
}

interface PreviewCanvasProps {
  resolution: string;
}

export const PreviewCanvas = forwardRef<PreviewCanvasHandle, PreviewCanvasProps>(
  function PreviewCanvas({ resolution }, ref) {
    const { t } = useTranslation();
    const outerRef = useRef<HTMLDivElement>(null);
    const visibleCanvasRef = useRef<HTMLCanvasElement>(null);
    const compositorWorkerRef = useRef<Worker | null>(null);
    const compositorReadyRef = useRef(false);

    const [resW, resH] = (resolution || "1080x1920").split("x").map(Number);
    const [previewSize, setPreviewSize] = useState<{ w: number; h: number } | null>(null);

    // Fit canvas within available space.
    useEffect(() => {
      const el = outerRef.current;
      if (!el) return;
      const compute = () => {
        const availW = el.clientWidth;
        const availH = el.clientHeight - 40;
        if (availW <= 0 || availH <= 0) return;
        const ratio = resW / resH;
        if (availW / availH >= ratio) {
          setPreviewSize({ w: availH * ratio, h: availH });
        } else {
          setPreviewSize({ w: availW, h: availW / ratio });
        }
      };
      compute();
      const obs = new ResizeObserver(compute);
      obs.observe(el);
      return () => obs.disconnect();
    }, [resW, resH]);

    // Spin up the compositor worker and transfer the OffscreenCanvas.
    useEffect(() => {
      const canvas = visibleCanvasRef.current;
      if (!canvas) return;

      const worker = new Worker(
        new URL("../engine/CompositorWorker.ts", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;
        if (msg.type === "READY") {
          compositorReadyRef.current = true;
        } else if (msg.type === "BITMAP") {
          // Paint received bitmap to the visible canvas.
          const bitmapCanvas = visibleCanvasRef.current;
          if (!bitmapCanvas) { msg.bitmap.close(); return; }
          const ctx = bitmapCanvas.getContext("bitmaprenderer");
          if (ctx) {
            ctx.transferFromImageBitmap(msg.bitmap);
          } else {
            // Fallback for browsers without ImageBitmapRenderingContext.
            const ctx2d = bitmapCanvas.getContext("2d");
            ctx2d?.drawImage(msg.bitmap, 0, 0);
            msg.bitmap.close();
          }
        }
      };

      // Transfer the canvas to the worker. After this call, `canvas` is no longer
      // usable from the main thread — all drawing goes through the worker.
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({ type: "INIT", canvas: offscreen, width: resW, height: resH }, [offscreen]);

      compositorWorkerRef.current = worker;

      return () => {
        compositorReadyRef.current = false;
        worker.postMessage({ type: "DESTROY" });
        setTimeout(() => worker.terminate(), 200);
        compositorWorkerRef.current = null;
      };
    }, [resW, resH]);

    const tick = useCallback(
      (
        playheadMs: number,
        clips: CompositorClipDescriptor[],
        textObjects: SerializedTextObject[],
        captionFrame: SerializedCaptionFrame | null
      ) => {
        const worker = compositorWorkerRef.current;
        if (!worker || !compositorReadyRef.current) return;

        // Send overlay data only when it has changed (caller is responsible for diffing).
        if (textObjects.length > 0 || captionFrame) {
          const transferables: Transferable[] = captionFrame ? [captionFrame.bitmap] : [];
          worker.postMessage({ type: "OVERLAY", textObjects, captionFrame }, transferables);
        }

        worker.postMessage({ type: "TICK", playheadMs, clips });
      },
      []
    );

    const receiveFrame = useCallback(
      (frame: VideoFrame, timestampUs: number, clipId: string) => {
        const worker = compositorWorkerRef.current;
        if (!worker) { frame.close(); return; }
        worker.postMessage(
          { type: "FRAME", frame, timestampUs, clipId },
          [frame as unknown as Transferable]
        );
      },
      []
    );

    useImperativeHandle(ref, () => ({ tick, receiveFrame }), [tick, receiveFrame]);

    return (
      <div
        ref={outerRef}
        className="flex-1 flex flex-col items-center justify-center bg-studio-bg overflow-hidden px-2 py-2 min-w-0"
      >
        <p className="text-[10px] font-semibold text-dim-3 mb-2 tracking-widest uppercase">
          {t("editor_preview_label")}
        </p>

        <div
          className="relative bg-black"
          style={{
            width: previewSize?.w ?? 0,
            height: previewSize?.h ?? 0,
          }}
        >
          {/*
            The canvas uses `bitmaprenderer` context — this is the fastest path
            for displaying ImageBitmaps from a Worker. The OffscreenCanvas is
            transferred to the compositor worker on mount.
          */}
          <canvas
            ref={visibleCanvasRef}
            width={resW}
            height={resH}
            className="absolute inset-0 w-full h-full"
            aria-label={t("editor_preview_label")}
          />
        </div>

        <div className="w-full flex justify-between mt-1 px-3">
          <span className="text-xs text-dim-3">0:00 / 0:00</span>
          <span className="text-xs text-dim-3">{resW} × {resH}</span>
        </div>
      </div>
    );
  }
);
```

---

## Step 3 — Wire DecoderPool frames to the compositor

The `DecoderPool` currently calls an `onFrame` callback. In Phase 3 (`PreviewEngine`), this callback will call `previewCanvasRef.current?.receiveFrame(frame, timestampUs, clipId)`. The wiring happens in `PreviewEngine` — no code change needed in `DecoderPool` for this step.

For manual testing right now, add a temporary test harness in `EditorWorkspace.tsx`:

```tsx
// TEMPORARY test harness — delete before Phase 3
import { useRef, useEffect } from "react";
import { DecoderPool } from "../engine/DecoderPool";
import type { PreviewCanvasHandle } from "./PreviewCanvas";

// Inside EditorWorkspace:
const previewRef = useRef<PreviewCanvasHandle>(null);

useEffect(() => {
  const pool = new DecoderPool(
    ({ frame, timestampUs, clipId }) => {
      previewRef.current?.receiveFrame(frame, timestampUs, clipId);
    },
  );
  // Manually trigger a TICK after 1 second to verify a frame appears.
  setTimeout(() => {
    previewRef.current?.tick(
      1000, // playheadMs
      tracks.map((t, i) => ({
        clipId: t.clips[0]?.id ?? "",
        zIndex: i,
        opacity: 1,
        clipPath: null,
        filter: null,
        transform: null,
        enabled: true,
      })),
      [],
      null
    );
  }, 1000);
  return () => pool.destroy();
}, []);
```

Pass `ref={previewRef}` to `<PreviewCanvas>` in the JSX.

**Delete this harness before Phase 3.**

---

## Step 4 — Verify

1. Open the editor with a project containing a video clip.
2. The preview canvas should show the frame at 1000ms after a 1-second delay.
3. Check DevTools → Memory: no `VideoFrame` objects accumulating over time (the queue pruning and `frame.close()` calls should prevent leaks).
4. Run `bun run type-check` — zero errors.

---

## Rollback

Remove the test harness from `EditorWorkspace.tsx`. Delete `engine/CompositorWorker.ts`. Replace `PreviewCanvas.tsx` with the Phase 0 placeholder. The editor returns to the gray canvas state.
