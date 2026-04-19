/**
 * CompositorWorker - runs in a Worker thread.
 *
 * Owns an OffscreenCanvas. Receives VideoFrame objects from the DecoderPool,
 * stores them in per-clip queues, and composites the best frame for each clip
 * onto the transferred preview canvas on every TICK.
 *
 * Message protocol (main -> worker):
 *   { type: "INIT", canvas: OffscreenCanvas, width: number, height: number }
 *   { type: "RESIZE", width: number, height: number }
 *   { type: "FRAME", frame: VideoFrame, timestampUs: number, clipId: string }
 *   { type: "TICK", playheadMs: number, clips: CompositorClipDescriptor[] }
 *   { type: "OVERLAY", textObjects: SerializedTextObject[], captionFrame?: SerializedCaptionFrame | null }
 *   { type: "CLEAR_CLIP", clipId: string }
 *   { type: "DESTROY" }
 *
 * Message protocol (worker -> main):
 *   { type: "READY" }
 *   { type: "PERFORMANCE", metrics: CompositorWorkerPerformanceMetrics }
 *
 * High-level flow:
 *   1. INIT receives the OffscreenCanvas transferred from PreviewCanvas.
 *   2. FRAME receives transferred VideoFrames and stores them by clip id.
 *   3. OVERLAY updates text/caption data that should draw over video.
 *   4. TICK chooses the best frame for each timeline clip and draws the whole
 *      preview frame: background -> video layers -> text -> caption bitmap.
 *   5. CLEAR_CLIP/DESTROY close owned VideoFrames and ImageBitmaps.
 *
 * Ownership rule: once a VideoFrame/ImageBitmap is transferred into this worker,
 * this worker is responsible for eventually drawing or closing it.
 */

export interface CompositorClipDescriptor {
  clipId: string;
  /** Canvas z-index: 0 = bottom track, higher = on top. */
  zIndex: number;
  /** Source-media timestamp to display for this clip on the current tick. */
  sourceTimeUs: number;
  /** Computed opacity (0-1), already accounting for transitions and enabled state. */
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
  /** Pre-rendered caption pixels. The compositor owns and closes this bitmap. */
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

type CompositorWorkerMessage =
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

interface DrawRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

// Bun's lib does not include DedicatedWorkerGlobalScope. Define the minimal
// surface we need so postMessage uses the browser Transferable signature.
interface WorkerCtx extends EventTarget {
  postMessage(message: unknown, transfer: Transferable[]): void;
  postMessage(message: unknown, options?: StructuredSerializeOptions): void;
  close(): void;
  onmessage: ((ev: MessageEvent) => unknown) | null;
}

const ctx = self as unknown as WorkerCtx;

class CompositorWorker {
  /** Canvas transferred from the visible <canvas>; drawing here updates preview. */
  private offscreenCanvas: OffscreenCanvas | null = null;
  private renderCtx: OffscreenCanvasRenderingContext2D | null = null;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private isDestroyed = false;
  private debugEnabled = false;
  private textObjects: SerializedTextObject[] = [];
  /** Latest caption bitmap, replaced only when OVERLAY includes captionFrame. */
  private captionFrame: SerializedCaptionFrame | null = null;

  /**
   * Per-clip queues of decoded VideoFrame objects, sorted by timestamp.
   * Frames stay queued because decoder output and compositor ticks are decoupled.
   */
  private readonly frameQueues = new Map<string, VideoFrame[]>();
  /** Last source time requested by TICK, used to prune queues around playhead. */
  private readonly lastRequestedSourceTimeUs = new Map<string, number>();
  private closedFrameCount = 0;
  private queueEvictedFrameCount = 0;

  constructor(private readonly worker: WorkerCtx) {
    this.worker.onmessage = (event: MessageEvent) => {
      this.handleMessage(event.data as CompositorWorkerMessage);
    };
  }

  // ---------------------------------------------------------------------------
  // Message lifecycle
  // ---------------------------------------------------------------------------

  private handleMessage(message: CompositorWorkerMessage): void {
    if (this.isDestroyed && message.type !== "DESTROY") {
      this.closeFrameFromIgnoredMessage(message);
      return;
    }

    switch (message.type) {
      case "INIT":
        this.init(message);
        break;
      case "RESIZE":
        this.resize(message.width, message.height);
        break;
      case "FRAME":
        this.receiveFrame(message.clipId, message.frame);
        break;
      case "OVERLAY":
        this.updateOverlay(message);
        break;
      case "TICK":
        this.tick(message.playheadMs, message.clips);
        break;
      case "CLEAR_CLIP":
        this.clearClipFrames(message.clipId);
        break;
      case "DESTROY":
        this.destroy();
        break;
    }
  }

  /**
   * Entry point from PreviewCanvas. This receives ownership of the visible
   * canvas as an OffscreenCanvas and prepares the 2D render context.
   */
  private init(message: Extract<CompositorWorkerMessage, { type: "INIT" }>) {
    this.offscreenCanvas = message.canvas;
    this.canvasWidth = message.width;
    this.canvasHeight = message.height;
    this.debugEnabled = message.debugEnabled === true;
    this.applyCanvasSize();
    this.renderCtx = this.offscreenCanvas.getContext("2d", {
      alpha: false,
    }) as OffscreenCanvasRenderingContext2D;
    this.worker.postMessage({ type: "READY" });
  }

  private resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.applyCanvasSize();
  }

  private receiveFrame(clipId: string, frame: VideoFrame): void {
    this.enqueueFrame(clipId, frame);
  }

  private updateOverlay(
    message: Extract<CompositorWorkerMessage, { type: "OVERLAY" }>
  ): void {
    this.textObjects = message.textObjects ?? [];

    if (!("captionFrame" in message)) return;

    // undefined means "keep existing caption"; null means "clear caption".
    this.closeCaptionFrame();
    this.captionFrame = message.captionFrame ?? null;
  }

  private tick(playheadMs: number, clips: CompositorClipDescriptor[]): void {
    const frameStart = performance.now();
    this.composite(clips);

    if (this.debugEnabled) {
      this.postPerformanceMetrics(playheadMs, clips, frameStart);
    }
  }

  private destroy(): void {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.clearAllFrames();
    this.closeCaptionFrame();
    this.textObjects = [];
    this.offscreenCanvas = null;
    this.renderCtx = null;
    this.worker.close();
  }

  // ---------------------------------------------------------------------------
  // Frame queues
  // ---------------------------------------------------------------------------

  private enqueueFrame(clipId: string, frame: VideoFrame): void {
    const queue = this.getOrCreateFrameQueue(clipId);
    queue.push(frame);
    queue.sort((a, b) => a.timestamp - b.timestamp);

    const sourceTimeUs = this.lastRequestedSourceTimeUs.get(clipId);
    if (typeof sourceTimeUs === "number") {
      // Once the playhead has visited this clip, keep the queue centered near it.
      this.pruneQueue(clipId, sourceTimeUs);
      return;
    }

    if (queue.length <= 16) return;

    const evicted = queue.splice(0, queue.length - 16);
    this.closeFrames(evicted, true);
  }

  private pickFrame(clipId: string, sourceTimeUs: number): VideoFrame | null {
    const queue = this.frameQueues.get(clipId);
    if (!queue || queue.length === 0) return null;

    this.lastRequestedSourceTimeUs.set(clipId, sourceTimeUs);
    this.pruneQueue(clipId, sourceTimeUs);

    const prunedQueue = this.frameQueues.get(clipId) ?? [];
    let best: VideoFrame | null = null;
    for (const frame of prunedQueue) {
      if (frame.timestamp <= sourceTimeUs) {
        best = frame;
      } else {
        break;
      }
    }

    return best ?? prunedQueue[0] ?? null;
  }

  private pruneQueue(clipId: string, sourceTimeUs: number): void {
    const queue = this.frameQueues.get(clipId);
    if (!queue || queue.length <= 4) return;

    const keepStart = this.findQueueKeepStart(queue, sourceTimeUs);
    // Keep one frame before the chosen frame plus a small lookahead window.
    const keepEnd = Math.min(queue.length, keepStart + 16);
    const overflow = queue.length - (keepEnd - keepStart);
    if (overflow <= 0) return;

    const retained = queue.slice(keepStart, keepEnd);
    const framesToClose = queue.filter(
      (_frame, index) => index < keepStart || index >= keepEnd
    );

    this.closeFrames(framesToClose, true);
    this.frameQueues.set(clipId, retained);
  }

  private findQueueKeepStart(
    queue: VideoFrame[],
    sourceTimeUs: number
  ): number {
    let latestBeforeIndex = -1;
    for (let index = 0; index < queue.length; index += 1) {
      if (queue[index]!.timestamp <= sourceTimeUs) {
        latestBeforeIndex = index;
      } else {
        break;
      }
    }

    const anchorIndex = latestBeforeIndex >= 0 ? latestBeforeIndex : 0;
    return Math.max(0, anchorIndex - 1);
  }

  private clearClipFrames(clipId: string): void {
    const queue = this.frameQueues.get(clipId);
    if (!queue) return;

    this.closeFrames(queue, false);
    this.frameQueues.delete(clipId);
    this.lastRequestedSourceTimeUs.delete(clipId);
  }

  private clearAllFrames(): void {
    for (const clipId of Array.from(this.frameQueues.keys())) {
      this.clearClipFrames(clipId);
    }
  }

  private closeFrames(frames: VideoFrame[], evicted: boolean): void {
    for (const frame of frames) {
      frame.close();
      this.closedFrameCount += 1;
      if (evicted) {
        this.queueEvictedFrameCount += 1;
      }
    }
  }

  private getOrCreateFrameQueue(clipId: string): VideoFrame[] {
    let queue = this.frameQueues.get(clipId);
    if (!queue) {
      queue = [];
      this.frameQueues.set(clipId, queue);
    }
    return queue;
  }

  private getFrameQueueSizes(): Record<string, number> {
    const sizes: Record<string, number> = {};
    for (const [clipId, queue] of this.frameQueues) {
      sizes[clipId] = queue.length;
    }
    return sizes;
  }

  // ---------------------------------------------------------------------------
  // Compositing
  // ---------------------------------------------------------------------------

  private composite(clips: CompositorClipDescriptor[]): void {
    if (!this.renderCtx || !this.offscreenCanvas) return;

    this.clearCanvas();

    // Clips are descriptors from PreviewEngine; the worker owns only rendering.
    for (const clip of this.getDrawableClips(clips)) {
      const frame = this.pickFrame(clip.clipId, clip.sourceTimeUs);
      if (!frame) continue;
      this.drawClipFrame(clip, frame);
    }

    this.drawTextObjects();
    this.drawCaptionFrame();
  }

  private clearCanvas(): void {
    if (!this.renderCtx) return;

    this.renderCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    this.renderCtx.fillStyle = "#000";
    this.renderCtx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  private getDrawableClips(
    clips: CompositorClipDescriptor[]
  ): CompositorClipDescriptor[] {
    return [...clips]
      .filter((clip) => clip.enabled && clip.opacity > 0)
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  private drawClipFrame(
    clip: CompositorClipDescriptor,
    frame: VideoFrame
  ): void {
    if (!this.renderCtx) return;

    const drawRect = this.getObjectContainRect(frame);

    this.renderCtx.save();
    this.renderCtx.globalAlpha = clip.opacity;
    this.renderCtx.filter = this.buildCanvasFilter(clip.effects);

    if (clip.clipPath) {
      // Clip path is applied before transform, matching the old canvas behavior.
      this.applyClipPath(clip.clipPath);
    }

    this.applyTransform(clip.transform);
    this.renderCtx.drawImage(
      frame,
      drawRect.dx,
      drawRect.dy,
      drawRect.dw,
      drawRect.dh
    );
    this.renderCtx.restore();
  }

  private getObjectContainRect(frame: VideoFrame): DrawRect {
    const frameAspect = frame.displayWidth / frame.displayHeight;
    const canvasAspect = this.canvasWidth / this.canvasHeight;

    let dx = 0;
    let dy = 0;
    let dw = this.canvasWidth;
    let dh = this.canvasHeight;

    if (frameAspect > canvasAspect) {
      dh = this.canvasWidth / frameAspect;
      dy = (this.canvasHeight - dh) / 2;
    } else {
      dw = this.canvasHeight * frameAspect;
      dx = (this.canvasWidth - dw) / 2;
    }

    return { dx, dy, dw, dh };
  }

  private drawTextObjects(): void {
    if (!this.renderCtx) return;

    for (const text of this.textObjects) {
      this.drawTextObject(text);
    }
  }

  private drawTextObject(text: SerializedTextObject): void {
    if (!this.renderCtx) return;

    this.renderCtx.save();
    this.renderCtx.globalAlpha = text.opacity;
    this.renderCtx.font = `${text.fontWeight} ${text.fontSize}px sans-serif`;
    this.renderCtx.fillStyle = text.color;
    this.renderCtx.textAlign = text.align;
    this.renderCtx.textBaseline = "middle";
    this.renderCtx.shadowColor = "rgba(0,0,0,0.8)";
    this.renderCtx.shadowBlur = 8;

    const lines = text.text.split("\n");
    const blockHeight = Math.max(text.lineHeight, 1) * lines.length;
    const firstLineY = text.y - blockHeight / 2 + text.lineHeight / 2;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      this.renderCtx.fillText(
        lines[lineIndex] ?? "",
        text.x,
        firstLineY + lineIndex * text.lineHeight,
        text.maxWidth
      );
    }

    this.renderCtx.restore();
  }

  private drawCaptionFrame(): void {
    if (!this.renderCtx || !this.captionFrame) return;

    this.renderCtx.drawImage(
      this.captionFrame.bitmap,
      0,
      0,
      this.canvasWidth,
      this.canvasHeight
    );
  }

  private applyTransform(transform: CompositorClipTransform): void {
    if (!this.renderCtx) return;

    const scale =
      Number.isFinite(transform.scale) && transform.scale > 0
        ? transform.scale
        : 1;

    if (scale !== 1) {
      this.renderCtx.transform(
        scale,
        0,
        0,
        scale,
        (this.canvasWidth / 2) * (1 - scale),
        (this.canvasHeight / 2) * (1 - scale)
      );
    }

    const translateX =
      transform.translateX +
      (transform.translateXPercent / 100) * this.canvasWidth;
    const translateY =
      transform.translateY +
      (transform.translateYPercent / 100) * this.canvasHeight;

    if (translateX !== 0 || translateY !== 0) {
      this.renderCtx.translate(translateX, translateY);
    }

    if (transform.rotationDeg === 0) return;

    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;
    const radians = (transform.rotationDeg * Math.PI) / 180;
    this.renderCtx.translate(centerX, centerY);
    this.renderCtx.rotate(radians);
    this.renderCtx.translate(-centerX, -centerY);
  }

  private applyClipPath(clipPath: CompositorClipPath): void {
    if (!this.renderCtx) return;

    if (clipPath.type === "inset") {
      const top = (clipPath.top / 100) * this.canvasHeight;
      const right = (clipPath.right / 100) * this.canvasWidth;
      const bottom = (clipPath.bottom / 100) * this.canvasHeight;
      const left = (clipPath.left / 100) * this.canvasWidth;

      this.renderCtx.beginPath();
      this.renderCtx.rect(
        left,
        top,
        this.canvasWidth - left - right,
        this.canvasHeight - top - bottom
      );
      this.renderCtx.clip();
      return;
    }

    const points = clipPath.points.map((point) => ({
      x: (point.x / 100) * this.canvasWidth,
      y: (point.y / 100) * this.canvasHeight,
    }));

    if (points.length < 3) return;

    this.renderCtx.beginPath();
    this.renderCtx.moveTo(points[0]!.x, points[0]!.y);
    for (let index = 1; index < points.length; index += 1) {
      this.renderCtx.lineTo(points[index]!.x, points[index]!.y);
    }
    this.renderCtx.closePath();
    this.renderCtx.clip();
  }

  private buildCanvasFilter(effects: CompositorClipEffects): string {
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

  // ---------------------------------------------------------------------------
  // Metrics and cleanup helpers
  // ---------------------------------------------------------------------------

  private postPerformanceMetrics(
    playheadMs: number,
    clips: CompositorClipDescriptor[],
    frameStart: number
  ): void {
    const frameQueueSizes = this.getFrameQueueSizes();
    this.worker.postMessage(
      {
        type: "PERFORMANCE",
        metrics: {
          playheadMs,
          compositorFrameMs: performance.now() - frameStart,
          clipCount: clips.length,
          textObjectCount: this.textObjects.length,
          captionFramePresent: this.captionFrame !== null,
          frameQueueSizes,
          frameQueueTotal: Object.values(frameQueueSizes).reduce(
            (total, size) => total + size,
            0
          ),
          closedFrameCount: this.closedFrameCount,
          queueEvictedFrameCount: this.queueEvictedFrameCount,
          canvasWidth: this.canvasWidth,
          canvasHeight: this.canvasHeight,
        },
      },
      []
    );
  }

  private applyCanvasSize(): void {
    if (!this.offscreenCanvas) return;

    this.offscreenCanvas.width = this.canvasWidth;
    this.offscreenCanvas.height = this.canvasHeight;
  }

  private closeCaptionFrame(): void {
    if (!this.captionFrame) return;

    this.captionFrame.bitmap.close();
    this.captionFrame = null;
  }

  private closeFrameFromIgnoredMessage(message: CompositorWorkerMessage): void {
    if (message.type === "FRAME") {
      message.frame.close();
    }
  }
}

new CompositorWorker(ctx);
