/**
 * CompositorWorker - runs in a Worker thread.
 *
 * Owns the worker protocol and VideoFrame queues. Actual pixel rendering lives
 * in `engine/compositor/*` so Canvas 2D and WebGL2 stay easy to inspect and
 * switch independently.
 */

import {
  createCompositorRenderer,
  type CompositorClipDescriptor,
  type CompositorPreviewQuality,
  type CompositorRenderer,
  type CompositorRendererMode,
  type CompositorRendererPreference,
  type SerializedCaptionFrame,
  type SerializedTextObject,
} from "./compositor";

export type {
  CompositorClipDescriptor,
  CompositorClipEffects,
  CompositorClipPath,
  CompositorClipTransform,
  CompositorPreviewQuality,
  CompositorRendererMode,
  CompositorRendererPreference,
  SerializedCaptionFrame,
  SerializedTextObject,
} from "./compositor";

export interface CompositorWorkerPerformanceMetrics {
  playheadMs: number;
  compositorFrameMs: number;
  renderer: CompositorRendererMode;
  clipCount: number;
  textObjectCount: number;
  captionFramePresent: boolean;
  frameQueueSizes: Record<string, number>;
  frameQueueTotal: number;
  closedFrameCount: number;
  queueEvictedFrameCount: number;
  canvasWidth: number;
  canvasHeight: number;
  previewQuality: CompositorPreviewQuality;
}

type CompositorWorkerMessage =
  | {
      type: "INIT";
      canvas: OffscreenCanvas;
      width: number;
      height: number;
      debugEnabled?: boolean;
      rendererPreference?: CompositorRendererPreference;
    }
  | { type: "RESIZE"; width: number; height: number }
  | { type: "FRAME"; frame: VideoFrame; timestampUs: number; clipId: string }
  | {
      type: "OVERLAY";
      textObjects: SerializedTextObject[];
      captionFrame?: SerializedCaptionFrame | null;
    }
  | {
      type: "TICK";
      playheadMs: number;
      clips: CompositorClipDescriptor[];
      quality?: CompositorPreviewQuality;
    }
  | { type: "CLEAR_CLIP"; clipId: string }
  | { type: "DESTROY" };

// Bun's lib does not include DedicatedWorkerGlobalScope. Define the minimal
// surface we need so postMessage uses the browser Transferable signature.
interface WorkerCtx extends EventTarget {
  postMessage(message: unknown, transfer: Transferable[]): void;
  postMessage(message: unknown, options?: StructuredSerializeOptions): void;
  close(): void;
  onmessage: ((ev: MessageEvent) => unknown) | null;
}

const ctx = self as unknown as WorkerCtx;
const FULL_QUALITY: CompositorPreviewQuality = { level: "full", scale: 1 };

class CompositorWorker {
  private renderer: CompositorRenderer | null = null;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private isDestroyed = false;
  private debugEnabled = false;
  private quality: CompositorPreviewQuality = FULL_QUALITY;
  private textObjects: SerializedTextObject[] = [];
  /** Latest caption bitmap, replaced only when OVERLAY includes captionFrame. */
  private captionFrame: SerializedCaptionFrame | null = null;
  private rendererPreference: CompositorRendererPreference = "auto";
  private didRequestRendererFallback = false;

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
        this.tick(message.playheadMs, message.clips, message.quality);
        break;
      case "CLEAR_CLIP":
        this.clearClipFrames(message.clipId);
        break;
      case "DESTROY":
        this.destroy();
        break;
    }
  }

  private init(message: Extract<CompositorWorkerMessage, { type: "INIT" }>) {
    this.canvasWidth = message.width;
    this.canvasHeight = message.height;
    this.debugEnabled = message.debugEnabled === true;
    this.rendererPreference = message.rendererPreference ?? "auto";
    this.renderer = createCompositorRenderer({
      canvas: message.canvas,
      width: message.width,
      height: message.height,
      preference: message.rendererPreference ?? "auto",
      quality: this.quality,
    });
    this.worker.postMessage({ type: "READY" });
  }

  private resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.renderer?.resize(width, height, this.quality);
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

  private tick(
    playheadMs: number,
    clips: CompositorClipDescriptor[],
    quality: CompositorPreviewQuality | undefined
  ): void {
    const frameStart = performance.now();
    this.applyQuality(quality);
    const rendered = this.renderer?.render({
      clips,
      textObjects: this.textObjects,
      captionFrame: this.captionFrame,
      pickFrame: (clipId, sourceTimeUs) => this.pickFrame(clipId, sourceTimeUs),
    });

    if (rendered === false) {
      this.requestRendererFallback("Renderer context became unavailable.");
    }

    if (this.debugEnabled) {
      this.postPerformanceMetrics(playheadMs, clips, frameStart);
    }
  }

  private applyQuality(quality: CompositorPreviewQuality | undefined): void {
    if (!quality) return;
    if (
      this.quality.level === quality.level &&
      this.quality.scale === quality.scale
    ) {
      return;
    }

    this.quality = quality;
    this.renderer?.resize(this.canvasWidth, this.canvasHeight, this.quality);
  }

  private destroy(): void {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.clearAllFrames();
    this.closeCaptionFrame();
    this.textObjects = [];
    this.renderer?.destroy();
    this.renderer = null;
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
      this.renderer?.releaseFrame(frame);
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
          renderer: this.renderer?.mode ?? "canvas2d",
          previewQuality: this.quality,
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

  private requestRendererFallback(reason: string): void {
    if (this.didRequestRendererFallback) return;
    if (this.renderer?.mode !== "webgl2") return;

    this.didRequestRendererFallback = true;
    this.worker.postMessage(
      {
        type: "RENDERER_FALLBACK_REQUIRED",
        from: "webgl2",
        to: "canvas2d",
        reason,
        requestedPreference: this.rendererPreference,
      },
      []
    );
  }
}

new CompositorWorker(ctx);
