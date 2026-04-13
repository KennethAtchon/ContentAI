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
 *   { type: 'CLEAR_CLIP', clipId: string }
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

// Bun's lib doesn't include DedicatedWorkerGlobalScope. Define the minimal
// surface we need so all postMessage calls use the browser Transferable signature.
interface WorkerCtx extends EventTarget {
  postMessage(message: unknown, transfer: Transferable[]): void;
  postMessage(message: unknown, options?: StructuredSerializeOptions): void;
  close(): void;
  onmessage: ((ev: MessageEvent) => unknown) | null;
}
const ctx = self as unknown as WorkerCtx;

// ─── Worker state ─────────────────────────────────────────────────────────────

let offscreenCanvas: OffscreenCanvas | null = null;
let renderCtx: OffscreenCanvasRenderingContext2D | null = null;
let canvasWidth = 0;
let canvasHeight = 0;
let isDestroyed = false;

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
function applyTransform(
  drawCtx: OffscreenCanvasRenderingContext2D,
  transform: string | null
): void {
  if (!transform) return;
  const scaleMatch = transform.match(/scale\(([\d.+-]+)\)/);
  const translateMatch = transform.match(/translate\(([\d.+-]+)px,\s*([\d.+-]+)px\)/);
  const rotateMatch = transform.match(/rotate\(([\d.+-]+)deg\)/);

  if (scaleMatch) {
    const s = parseFloat(scaleMatch[1]);
    drawCtx.transform(s, 0, 0, s, (canvasWidth / 2) * (1 - s), (canvasHeight / 2) * (1 - s));
  }
  if (translateMatch) {
    drawCtx.translate(parseFloat(translateMatch[1]), parseFloat(translateMatch[2]));
  }
  if (rotateMatch) {
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    const rad = (parseFloat(rotateMatch[1]) * Math.PI) / 180;
    drawCtx.translate(cx, cy);
    drawCtx.rotate(rad);
    drawCtx.translate(-cx, -cy);
  }
}

// ─── Composite a single tick ───────────────────────────────────────────────────

function composite(
  playheadMs: number,
  clips: CompositorClipDescriptor[],
  textObjects: SerializedTextObject[],
  captionFrame: SerializedCaptionFrame | null
): void {
  if (!renderCtx || !offscreenCanvas) return;

  const playheadUs = playheadMs * 1000;

  // Clear canvas.
  renderCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  renderCtx.fillStyle = "#000";
  renderCtx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Sort clips by z-index ascending (lowest drawn first).
  const sorted = [...clips].sort((a, b) => a.zIndex - b.zIndex);

  for (const clip of sorted) {
    if (!clip.enabled || clip.opacity === 0) continue;

    const frame = pickFrame(clip.clipId, playheadUs);
    if (!frame) continue;

    renderCtx.save();
    renderCtx.globalAlpha = clip.opacity;

    if (clip.filter) {
      renderCtx.filter = clip.filter;
    }

    if (clip.clipPath) {
      // clipPath is a CSS clip-path polygon string, e.g. "inset(0 50% 0 0)".
      // Canvas 2D does not support CSS clip-path natively — convert to a Path2D.
      applyClipPath(renderCtx, clip.clipPath, canvasWidth, canvasHeight);
    }

    applyTransform(renderCtx, clip.transform);

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
    renderCtx.drawImage(frame, dx, dy, dw, dh);

    renderCtx.restore();
  }

  // Draw text overlays.
  for (const text of textObjects) {
    renderCtx.save();
    renderCtx.globalAlpha = text.opacity;
    renderCtx.font = `${text.fontWeight} ${text.fontSize}px sans-serif`;
    renderCtx.fillStyle = text.color;
    renderCtx.textAlign = text.align;
    renderCtx.shadowColor = "rgba(0,0,0,0.8)";
    renderCtx.shadowBlur = 8;
    renderCtx.fillText(text.text, text.x, text.y);
    renderCtx.restore();
  }

  // Draw pre-rendered caption bitmap (if any).
  if (captionFrame) {
    renderCtx.drawImage(captionFrame.bitmap, 0, 0, canvasWidth, canvasHeight);
    captionFrame.bitmap.close();
  }

  // Transfer the composited frame to the main thread.
  const bitmap = offscreenCanvas.transferToImageBitmap();
  ctx.postMessage({ type: "BITMAP", bitmap }, [bitmap as unknown as Transferable]);
}

/**
 * Convert a CSS inset() clip-path to a canvas clipping region.
 * Handles only inset() for Phase 2/4 wipe transitions.
 * Extend this function in Phase 4 for polygon() and other shapes.
 */
function applyClipPath(
  drawCtx: OffscreenCanvasRenderingContext2D,
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
  drawCtx.beginPath();
  drawCtx.rect(left, top, w - left - right, h - top - bottom);
  drawCtx.clip();
}

// ─── Message handler ───────────────────────────────────────────────────────────

let pendingTextObjects: SerializedTextObject[] = [];
let pendingCaptionFrame: SerializedCaptionFrame | null = null;

ctx.onmessage = (event: MessageEvent) => {
  if (isDestroyed) return;

  const msg = event.data as
    | { type: "INIT"; canvas: OffscreenCanvas; width: number; height: number }
    | { type: "FRAME"; frame: VideoFrame; timestampUs: number; clipId: string }
    | { type: "OVERLAY"; textObjects: SerializedTextObject[]; captionFrame: SerializedCaptionFrame | null }
    | { type: "TICK"; playheadMs: number; clips: CompositorClipDescriptor[] }
    | { type: "CLEAR_CLIP"; clipId: string }
    | { type: "DESTROY" };

  switch (msg.type) {
    case "INIT": {
      offscreenCanvas = msg.canvas;
      canvasWidth = msg.width;
      canvasHeight = msg.height;
      offscreenCanvas.width = canvasWidth;
      offscreenCanvas.height = canvasHeight;
      renderCtx = offscreenCanvas.getContext("2d", { alpha: false }) as OffscreenCanvasRenderingContext2D;
      ctx.postMessage({ type: "READY" });
      break;
    }

    case "FRAME": {
      // Frame transferred from DecoderPool via main thread relay.
      enqueueFrame(msg.clipId, msg.frame);
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
      isDestroyed = true;
      for (const clipId of frameQueues.keys()) clearClipFrames(clipId);
      if (pendingCaptionFrame) {
        pendingCaptionFrame.bitmap.close();
        pendingCaptionFrame = null;
      }
      offscreenCanvas = null;
      renderCtx = null;
      ctx.close();
      break;
    }
  }
};
