/**
 * CompositorWorker — runs in a Worker thread.
 *
 * Owns an OffscreenCanvas. Receives VideoFrame objects from the DecoderPool,
 * sorts them into per-clip queues, and on TICK composites the correct frames
 * for the given playhead time directly onto the transferred preview canvas.
 *
 * Message protocol (main → worker):
 *   { type: 'INIT', canvas: OffscreenCanvas, width: number, height: number }
 *   { type: 'RESIZE', width: number, height: number }
 *   { type: 'FRAME', frame: VideoFrame, timestampUs: number, clipId: string }
 *   { type: 'TICK', playheadMs: number, clips: CompositorClipDescriptor[] }
 *   { type: 'OVERLAY', textObjects: SerializedTextObject[], captionFrame?: SerializedCaptionFrame | null }
 *   { type: 'CLEAR_CLIP', clipId: string }
 *   { type: 'DESTROY' }
 *
 * Message protocol (worker → main):
 *   { type: 'READY' }
 *   { type: 'PERFORMANCE', metrics: CompositorWorkerPerformanceMetrics }
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
  /** Source-media timestamp to display for this clip on the current tick. */
  sourceTimeUs: number;
  /** Computed opacity (0–1), already accounting for transitions and enabled state. */
  opacity: number;
  /** Typed clip region for wipe transitions, or null. Values are percentages. */
  clipPath: CompositorClipPath | null;
  /** Numeric effect values. Contrast/warmth match editor slider units. */
  effects: CompositorClipEffects;
  /** Numeric transform descriptor applied by the worker without string parsing. */
  transform: CompositorClipTransform;
  /** If false, skip this clip entirely. */
  enabled: boolean;
}

export interface CompositorClipTransform {
  scale: number;
  translateX: number;
  translateY: number;
  translateXPercent: number;
  translateYPercent: number;
  rotationDeg: number;
}

export interface CompositorClipEffects {
  contrast: number;
  warmth: number;
}

export type CompositorClipPath =
  | {
      type: "inset";
      top: number;
      right: number;
      bottom: number;
      left: number;
    }
  | {
      type: "polygon";
      points: Array<{ x: number; y: number }>;
    };

export interface SerializedTextObject {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: string;
  color: string;
  align: CanvasTextAlign;
  opacity: number;
  maxWidth: number;
  lineHeight: number;
}

export interface SerializedCaptionFrame {
  /** Pre-rendered caption pixels as an ImageBitmap. Transfer semantics: compositor owns and closes it when replaced or destroyed. */
  bitmap: ImageBitmap;
}

export interface CompositorWorkerPerformanceMetrics {
  playheadMs: number;
  compositorFrameMs: number;
  clipCount: number;
  textObjectCount: number;
  captionFramePresent: boolean;
  frameQueueSizes: Record<string, number>;
  frameQueueTotal: number;
  closedFrameCount: number;
  queueEvictedFrameCount: number;
  canvasWidth: number;
  canvasHeight: number;
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
let debugEnabled = false;

/** Per-clip queues of decoded VideoFrame objects, sorted by timestamp ascending. */
const frameQueues = new Map<string, VideoFrame[]>();
let closedFrameCount = 0;
let queueEvictedFrameCount = 0;

// ─── Frame management ─────────────────────────────────────────────────────────

const lastRequestedSourceTimeUs = new Map<string, number>();

function enqueueFrame(clipId: string, frame: VideoFrame): void {
  if (!frameQueues.has(clipId)) frameQueues.set(clipId, []);
  const queue = frameQueues.get(clipId)!;
  queue.push(frame);
  // Keep queue sorted by timestamp (frames usually arrive in order, but guard against out-of-order delivery).
  queue.sort((a, b) => a.timestamp - b.timestamp);

  const sourceTimeUs = lastRequestedSourceTimeUs.get(clipId);
  if (typeof sourceTimeUs === "number") {
    pruneQueue(clipId, sourceTimeUs);
    return;
  }

  if (queue.length <= 16) return;
  const toClose = queue.splice(0, queue.length - 16);
  closeQueuedFrames(toClose, true);
}

function closeQueuedFrames(frames: VideoFrame[], evicted: boolean): void {
  for (const frame of frames) {
    frame.close();
    closedFrameCount += 1;
    if (evicted) queueEvictedFrameCount += 1;
  }
}

function pruneQueue(clipId: string, sourceTimeUs: number): void {
  const queue = frameQueues.get(clipId);
  if (!queue || queue.length <= 4) return;

  let latestBeforeIndex = -1;
  for (let index = 0; index < queue.length; index += 1) {
    if (queue[index]!.timestamp <= sourceTimeUs) {
      latestBeforeIndex = index;
      continue;
    }
    break;
  }

  const anchorIndex = latestBeforeIndex >= 0 ? latestBeforeIndex : 0;
  const keepStart = Math.max(0, anchorIndex - 1);
  // Keep 16 frames ahead — hardware decoders can burst-output many frames at
  // once, and a 4-frame window was discarding frames needed ~133ms ahead.
  const keepEnd = Math.min(queue.length, keepStart + 16);
  const overflow = queue.length - (keepEnd - keepStart);
  if (overflow <= 0) return;

  const retained = queue.slice(keepStart, keepEnd);
  const framesToClose: VideoFrame[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    if (index >= keepStart && index < keepEnd) continue;
    framesToClose.push(queue[index]!);
  }
  closeQueuedFrames(framesToClose, true);
  frameQueues.set(clipId, retained);
}

/**
 * Find the best frame for the given playhead time.
 * Returns the frame with the largest timestamp ≤ playheadUs, or the earliest frame if all are ahead.
 */
function pickFrame(clipId: string, sourceTimeUs: number): VideoFrame | null {
  const queue = frameQueues.get(clipId);
  if (!queue || queue.length === 0) return null;
  lastRequestedSourceTimeUs.set(clipId, sourceTimeUs);
  pruneQueue(clipId, sourceTimeUs);

  let best: VideoFrame | null = null;
  for (const frame of frameQueues.get(clipId) ?? []) {
    if (frame.timestamp <= sourceTimeUs) best = frame;
    else break;
  }
  return best ?? frameQueues.get(clipId)?.[0] ?? null;
}

function clearClipFrames(clipId: string): void {
  const queue = frameQueues.get(clipId);
  if (!queue) return;
  closeQueuedFrames(queue, false);
  frameQueues.delete(clipId);
  lastRequestedSourceTimeUs.delete(clipId);
}

function getFrameQueueSizes(): Record<string, number> {
  const sizes: Record<string, number> = {};
  for (const [clipId, queue] of frameQueues) {
    sizes[clipId] = queue.length;
  }
  return sizes;
}

// ─── Canvas transform helpers ─────────────────────────────────────────────────

function applyTransform(
  drawCtx: OffscreenCanvasRenderingContext2D,
  transform: CompositorClipTransform
): void {
  const scale =
    Number.isFinite(transform.scale) && transform.scale > 0
      ? transform.scale
      : 1;
  if (scale !== 1) {
    drawCtx.transform(
      scale,
      0,
      0,
      scale,
      (canvasWidth / 2) * (1 - scale),
      (canvasHeight / 2) * (1 - scale)
    );
  }

  const translateX =
    transform.translateX + (transform.translateXPercent / 100) * canvasWidth;
  const translateY =
    transform.translateY + (transform.translateYPercent / 100) * canvasHeight;
  if (translateX !== 0 || translateY !== 0) {
    drawCtx.translate(translateX, translateY);
  }

  if (transform.rotationDeg !== 0) {
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    const rad = (transform.rotationDeg * Math.PI) / 180;
    drawCtx.translate(cx, cy);
    drawCtx.rotate(rad);
    drawCtx.translate(-cx, -cy);
  }
}

function buildCanvasFilter(effects: CompositorClipEffects): string {
  const filterParts: string[] = [];
  if (effects.contrast !== 0) {
    filterParts.push(`contrast(${1 + effects.contrast / 100})`);
  }
  if (effects.warmth !== 0) {
    filterParts.push(
      `hue-rotate(${-effects.warmth * 0.3}deg)`,
      `saturate(${1 + effects.warmth * 0.005})`
    );
  }
  return filterParts.join(" ") || "none";
}

// ─── Composite a single tick ───────────────────────────────────────────────────

function composite(
  clips: CompositorClipDescriptor[],
  textObjects: SerializedTextObject[],
  captionFrame: SerializedCaptionFrame | null
): void {
  if (!renderCtx || !offscreenCanvas) return;

  // Clear canvas.
  renderCtx.clearRect(0, 0, canvasWidth, canvasHeight);
  renderCtx.fillStyle = "#000";
  renderCtx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Sort clips by z-index ascending (lowest drawn first).
  const sorted = [...clips].sort((a, b) => a.zIndex - b.zIndex);

  for (const clip of sorted) {
    if (!clip.enabled || clip.opacity === 0) continue;

    const frame = pickFrame(clip.clipId, clip.sourceTimeUs);
    if (!frame) continue;

    renderCtx.save();
    renderCtx.globalAlpha = clip.opacity;

    renderCtx.filter = buildCanvasFilter(clip.effects);

    if (clip.clipPath) {
      applyClipPath(renderCtx, clip.clipPath, canvasWidth, canvasHeight);
    }

    applyTransform(renderCtx, clip.transform);

    // Draw the frame scaled to fill the canvas (object-contain semantics).
    const frameAspect = frame.displayWidth / frame.displayHeight;
    const canvasAspect = canvasWidth / canvasHeight;
    let dx = 0,
      dy = 0,
      dw = canvasWidth,
      dh = canvasHeight;
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
    renderCtx.textBaseline = "middle";
    renderCtx.shadowColor = "rgba(0,0,0,0.8)";
    renderCtx.shadowBlur = 8;
    const lines = text.text.split("\n");
    const blockHeight = Math.max(text.lineHeight, 1) * lines.length;
    const firstLineY = text.y - blockHeight / 2 + text.lineHeight / 2;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      renderCtx.fillText(
        lines[lineIndex] ?? "",
        text.x,
        firstLineY + lineIndex * text.lineHeight,
        text.maxWidth
      );
    }
    renderCtx.restore();
  }

  // Draw pre-rendered caption bitmap (if any).
  if (captionFrame) {
    renderCtx.drawImage(captionFrame.bitmap, 0, 0, canvasWidth, canvasHeight);
  }
}

/**
 * Convert typed clip descriptors to a canvas clipping region.
 * Handles the inset wipes we use today and a minimal polygon subset so
 * transition descriptors stay future-safe if slide/wipe variants emit polygons.
 */
function applyClipPath(
  drawCtx: OffscreenCanvasRenderingContext2D,
  clipPath: CompositorClipPath,
  w: number,
  h: number
): void {
  if (clipPath.type === "inset") {
    const top = (clipPath.top / 100) * h;
    const right = (clipPath.right / 100) * w;
    const bottom = (clipPath.bottom / 100) * h;
    const left = (clipPath.left / 100) * w;
    drawCtx.beginPath();
    drawCtx.rect(left, top, w - left - right, h - top - bottom);
    drawCtx.clip();
    return;
  }

  const points = clipPath.points.map((point) => ({
    x: (point.x / 100) * w,
    y: (point.y / 100) * h,
  }));

  if (points.length < 3) return;
  drawCtx.beginPath();
  drawCtx.moveTo(points[0]!.x, points[0]!.y);
  for (let index = 1; index < points.length; index += 1) {
    drawCtx.lineTo(points[index]!.x, points[index]!.y);
  }
  drawCtx.closePath();
  drawCtx.clip();
}

// ─── Message handler ───────────────────────────────────────────────────────────

let pendingTextObjects: SerializedTextObject[] = [];
let pendingCaptionFrame: SerializedCaptionFrame | null = null;

ctx.onmessage = (event: MessageEvent) => {
  if (isDestroyed) return;

  const msg = event.data as
    | {
        type: "INIT";
        canvas: OffscreenCanvas;
        width: number;
        height: number;
        debugEnabled?: boolean;
      }
    | { type: "RESIZE"; width: number; height: number }
    | { type: "FRAME"; frame: VideoFrame; timestampUs: number; clipId: string }
    | {
        type: "OVERLAY";
        textObjects: SerializedTextObject[];
        captionFrame?: SerializedCaptionFrame | null;
      }
    | { type: "TICK"; playheadMs: number; clips: CompositorClipDescriptor[] }
    | { type: "CLEAR_CLIP"; clipId: string }
    | { type: "DESTROY" };

  switch (msg.type) {
    case "INIT": {
      offscreenCanvas = msg.canvas;
      canvasWidth = msg.width;
      canvasHeight = msg.height;
      debugEnabled = msg.debugEnabled === true;
      offscreenCanvas.width = canvasWidth;
      offscreenCanvas.height = canvasHeight;
      renderCtx = offscreenCanvas.getContext("2d", {
        alpha: false,
      }) as OffscreenCanvasRenderingContext2D;
      ctx.postMessage({ type: "READY" });
      break;
    }

    case "RESIZE": {
      canvasWidth = msg.width;
      canvasHeight = msg.height;
      if (offscreenCanvas) {
        offscreenCanvas.width = canvasWidth;
        offscreenCanvas.height = canvasHeight;
      }
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
      if ("captionFrame" in msg) {
        if (pendingCaptionFrame) pendingCaptionFrame.bitmap.close();
        pendingCaptionFrame = msg.captionFrame ?? null;
      }
      break;
    }

    case "TICK": {
      const frameStart = performance.now();
      composite(msg.clips, pendingTextObjects, pendingCaptionFrame);
      if (debugEnabled) {
        const frameQueueSizes = getFrameQueueSizes();
        ctx.postMessage(
          {
            type: "PERFORMANCE",
            metrics: {
              playheadMs: msg.playheadMs,
              compositorFrameMs: performance.now() - frameStart,
              clipCount: msg.clips.length,
              textObjectCount: pendingTextObjects.length,
              captionFramePresent: pendingCaptionFrame !== null,
              frameQueueSizes,
              frameQueueTotal: Object.values(frameQueueSizes).reduce(
                (total, size) => total + size,
                0
              ),
              closedFrameCount,
              queueEvictedFrameCount,
              canvasWidth,
              canvasHeight,
            },
          },
          []
        );
      }
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
