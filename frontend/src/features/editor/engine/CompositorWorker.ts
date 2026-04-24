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
    type CompositorRenderResult,
    type CompositorRenderer,
    type CompositorRendererMode,
    type CompositorRendererPreference,
    type SerializedCaptionFrame,
  type SerializedTextObject,
} from "./compositor";
import { debugLog } from "@/shared/utils/debug";

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
  renderOk: boolean;
  drawableClipCount: number;
  drawableClipIds: string[];
  drawnVideoClipCount: number;
  drawnVideoClipIds: string[];
  missingFrameClipCount: number;
  missingFrameClipIds: string[];
  failedVideoClipCount: number;
  failedVideoClipIds: string[];
  overlayDrawn: boolean;
  overlayOnly: boolean;
  incomingClipIds: string[];
  queueClipIds: string[];
  matchedQueueClipIds: string[];
  missingQueueClipIds: string[];
  blankClipIds: string[];
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
const LOG_COMPONENT = "CompositorWorker";

function isMissingDescriptorClipId(clipId: unknown): boolean {
  return typeof clipId !== "string" || clipId.trim().length === 0;
}

function formatDescriptorClipIdForLog(clipId: unknown): string {
  if (typeof clipId === "string") {
    return clipId.length > 0 ? clipId : "<empty>";
  }
  if (clipId === undefined) return "<undefined>";
  if (clipId === null) return "<null>";
  return `<${typeof clipId}:${String(clipId)}>`;
}

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
    this.logDebug("Initialized compositor worker bridge");
  }

  private logDebug(
    message: string,
    context?: Record<string, unknown>,
    data?: unknown
  ): void {
    debugLog.debug(message, { component: LOG_COMPONENT, ...context }, data);
  }

  private logWarn(
    message: string,
    context?: Record<string, unknown>,
    data?: unknown
  ): void {
    debugLog.warn(message, { component: LOG_COMPONENT, ...context }, data);
  }

  // ---------------------------------------------------------------------------
  // Message lifecycle
  // ---------------------------------------------------------------------------

  private handleMessage(message: CompositorWorkerMessage): void {
    if (this.isDestroyed && message.type !== "DESTROY") {
      this.logWarn("Ignoring message after compositor worker destruction", {
        type: message.type,
      });
      this.closeFrameFromIgnoredMessage(message);
      return;
    }

    this.logDebug("Handling compositor worker message", {
      type: message.type,
      ...(message.type === "FRAME"
        ? {
            clipId: message.clipId,
            messageTimestampUs: message.timestampUs,
            frameTimestampUs: message.frame.timestamp,
            frameDisplayWidth: message.frame.displayWidth,
            frameDisplayHeight: message.frame.displayHeight,
          }
        : {}),
      ...(message.type === "TICK"
        ? {
            playheadMs: message.playheadMs,
            clipCount: message.clips.length,
            previewQualityLevel: message.quality?.level ?? this.quality.level,
            previewQualityScale: message.quality?.scale ?? this.quality.scale,
          }
        : {}),
      ...(message.type === "OVERLAY"
        ? {
            textObjectCount: message.textObjects.length,
            captionFrameState:
              !("captionFrame" in message)
                ? "unchanged"
                : message.captionFrame
                  ? "replace"
                  : "clear",
          }
        : {}),
    });

    switch (message.type) {
      case "INIT":
        this.init(message);
        break;
      case "RESIZE":
        this.resize(message.width, message.height);
        break;
      case "FRAME":
        this.receiveFrame(message.clipId, message.frame, message.timestampUs);
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
    this.logDebug("Initialized compositor renderer", {
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      rendererPreference: this.rendererPreference,
      rendererMode: this.renderer?.mode ?? "unknown",
      debugEnabled: this.debugEnabled,
    });
    this.worker.postMessage({ type: "READY" });
  }

  private resize(width: number, height: number): void {
    this.logDebug("Resizing compositor renderer", {
      previousWidth: this.canvasWidth,
      previousHeight: this.canvasHeight,
      width,
      height,
      previewQualityLevel: this.quality.level,
      previewQualityScale: this.quality.scale,
    });
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.renderer?.resize(width, height, this.quality);
  }

  private receiveFrame(
    clipId: string,
    frame: VideoFrame,
    timestampUs: number
  ): void {
    this.logDebug("Received decoded frame from main thread", {
      clipId,
      timestampUs,
      frameTimestampUs: frame.timestamp,
      frameDisplayWidth: frame.displayWidth,
      frameDisplayHeight: frame.displayHeight,
      existingQueueSize: this.frameQueues.get(clipId)?.length ?? 0,
    });
    this.enqueueFrame(clipId, frame);
  }

  private updateOverlay(
    message: Extract<CompositorWorkerMessage, { type: "OVERLAY" }>
  ): void {
    this.textObjects = message.textObjects ?? [];
    this.logDebug("Updated compositor overlay payload", {
      textObjectCount: this.textObjects.length,
      captionFrameState:
        !("captionFrame" in message)
          ? "unchanged"
          : message.captionFrame
            ? "replace"
            : "clear",
    });

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
    this.logDebug("Starting compositor render tick", {
      playheadMs,
      clipCount: clips.length,
      clipIds: clips.map((clip) => clip.clipId),
      textObjectCount: this.textObjects.length,
      hasCaptionFrame: this.captionFrame !== null,
      rendererMode: this.renderer?.mode ?? "unknown",
      frameQueueTotal: this.getTotalFrameQueueSize(),
      previewQualityLevel: this.quality.level,
      previewQualityScale: this.quality.scale,
    });
    const queueClipIds = Array.from(this.frameQueues.keys());
    const incomingRawClipIds = clips.map((clip) => clip.clipId);
    const incomingClipIds = incomingRawClipIds.map((clipId) =>
      formatDescriptorClipIdForLog(clipId)
    );
    const matchedQueueClipIds = incomingRawClipIds
      .filter(
        (clipId): clipId is string =>
          typeof clipId === "string" && this.frameQueues.has(clipId)
      )
      .map((clipId) => formatDescriptorClipIdForLog(clipId));
    const missingQueueClipIds = incomingRawClipIds
      .filter(
        (clipId) =>
          typeof clipId !== "string" || !this.frameQueues.has(clipId)
      )
      .map((clipId) => formatDescriptorClipIdForLog(clipId));
    const blankClipIds = incomingRawClipIds
      .filter((clipId) => isMissingDescriptorClipId(clipId))
      .map((clipId) => formatDescriptorClipIdForLog(clipId));
    if (blankClipIds.length > 0) {
      this.logWarn("Compositor tick received blank clip IDs", {
        playheadMs,
        clipCount: clips.length,
        blankClipIds,
        queueClipIds,
      });
    }
    if (missingQueueClipIds.length > 0) {
      this.logWarn("Compositor tick clip IDs have no matching frame queues", {
        playheadMs,
        missingQueueClipIds,
        queueClipIds,
      });
    }
    const renderResult = this.renderer?.render({
      clips,
      textObjects: this.textObjects,
      captionFrame: this.captionFrame,
      pickFrame: (clipId, sourceTimeUs) => this.pickFrame(clipId, sourceTimeUs),
    });
    const renderOk = renderResult?.ok ?? false;
    const renderStats = renderResult?.stats;

    this.logDebug("Completed compositor render tick", {
      playheadMs,
      rendered: renderOk,
      rendererMode: this.renderer?.mode ?? "unknown",
      drawableClipCount: renderStats?.drawableClipCount ?? 0,
      drawnVideoClipCount: renderStats?.drawnVideoClipCount ?? 0,
      missingFrameClipCount: renderStats?.missingFrameClipCount ?? 0,
      failedVideoClipCount: renderStats?.failedVideoClipCount ?? 0,
      overlayOnly: renderStats?.overlayOnly ?? false,
      frameQueueTotal: this.getTotalFrameQueueSize(),
      durationMs: performance.now() - frameStart,
    });

    if (renderOk === false) {
      this.requestRendererFallback("Renderer context became unavailable.");
    }

    if (this.debugEnabled) {
      this.postPerformanceMetrics(
        playheadMs,
        clips,
        frameStart,
        renderResult ?? null,
        incomingClipIds,
        queueClipIds,
        matchedQueueClipIds,
        missingQueueClipIds,
        blankClipIds
      );
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
    this.logDebug("Applied compositor quality change", {
      previewQualityLevel: quality.level,
      previewQualityScale: quality.scale,
    });
    this.renderer?.resize(this.canvasWidth, this.canvasHeight, this.quality);
  }

  private destroy(): void {
    if (this.isDestroyed) return;

    this.logDebug("Destroying compositor worker", {
      rendererMode: this.renderer?.mode ?? "unknown",
      frameQueueTotal: this.getTotalFrameQueueSize(),
      clipQueueCount: this.frameQueues.size,
      hasCaptionFrame: this.captionFrame !== null,
    });
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
    const queueSizeBefore = queue.length;
    queue.push(frame);
    queue.sort((a, b) => a.timestamp - b.timestamp);
    this.logDebug("Queued decoded frame", {
      clipId,
      frameTimestampUs: frame.timestamp,
      queueSizeBefore,
      queueSizeAfter: queue.length,
    });

    const sourceTimeUs = this.lastRequestedSourceTimeUs.get(clipId);
    if (typeof sourceTimeUs === "number") {
      // Once the playhead has visited this clip, keep the queue centered near it.
      this.pruneQueue(clipId, sourceTimeUs);
      return;
    }

    if (queue.length <= 16) return;

    const evicted = queue.splice(0, queue.length - 16);
    this.logDebug("Evicting oldest queued frames before clip is visited", {
      clipId,
      evictedFrameCount: evicted.length,
      retainedFrameCount: queue.length,
    });
    this.closeFrames(evicted, true);
  }

  private pickFrame(clipId: string, sourceTimeUs: number): VideoFrame | null {
    const queue = this.frameQueues.get(clipId);
    if (!queue || queue.length === 0) {
      this.logDebug("No queued frame available for compositor selection", {
        clipId,
        sourceTimeUs,
        availableQueueClipIds: Array.from(this.frameQueues.keys()),
      });
      return null;
    }

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

    const selected = best ?? prunedQueue[0] ?? null;
    this.logDebug("Selected frame for compositor draw", {
      clipId,
      sourceTimeUs,
      queueSize: prunedQueue.length,
      queueFirstTimestampUs: prunedQueue[0]?.timestamp ?? null,
      queueLastTimestampUs: prunedQueue[prunedQueue.length - 1]?.timestamp ?? null,
      selectedFrameTimestampUs: selected?.timestamp ?? null,
      selectedFrameDeltaUs:
        selected == null ? null : selected.timestamp - sourceTimeUs,
    });
    return selected;
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

    this.logDebug("Pruned compositor frame queue", {
      clipId,
      sourceTimeUs,
      queueSizeBefore: queue.length,
      retainedFrameCount: retained.length,
      removedFrameCount: framesToClose.length,
      keepStart,
      keepEnd,
    });
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

    this.logDebug("Clearing compositor frame queue for clip", {
      clipId,
      frameCount: queue.length,
    });
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
    if (frames.length > 0) {
      this.logDebug("Closing compositor-managed frames", {
        frameCount: frames.length,
        evicted,
      });
    }
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

  private getTotalFrameQueueSize(): number {
    let total = 0;
    for (const queue of this.frameQueues.values()) {
      total += queue.length;
    }
    return total;
  }

  // ---------------------------------------------------------------------------
  // Metrics and cleanup helpers
  // ---------------------------------------------------------------------------

  private postPerformanceMetrics(
    playheadMs: number,
    clips: CompositorClipDescriptor[],
    frameStart: number,
    renderResult: CompositorRenderResult | null,
    incomingClipIds: string[],
    queueClipIds: string[],
    matchedQueueClipIds: string[],
    missingQueueClipIds: string[],
    blankClipIds: string[]
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
          renderOk: renderResult?.ok ?? false,
          drawableClipCount: renderResult?.stats.drawableClipCount ?? 0,
          drawableClipIds: renderResult?.stats.drawableClipIds ?? [],
          drawnVideoClipCount: renderResult?.stats.drawnVideoClipCount ?? 0,
          drawnVideoClipIds: renderResult?.stats.drawnVideoClipIds ?? [],
          missingFrameClipCount: renderResult?.stats.missingFrameClipCount ?? 0,
          missingFrameClipIds: renderResult?.stats.missingFrameClipIds ?? [],
          failedVideoClipCount: renderResult?.stats.failedVideoClipCount ?? 0,
          failedVideoClipIds: renderResult?.stats.failedVideoClipIds ?? [],
          overlayDrawn: renderResult?.stats.overlayDrawn ?? false,
          overlayOnly: renderResult?.stats.overlayOnly ?? false,
          incomingClipIds,
          queueClipIds,
          matchedQueueClipIds,
          missingQueueClipIds,
          blankClipIds,
        },
      },
      []
    );
  }

  private closeCaptionFrame(): void {
    if (!this.captionFrame) return;

    this.logDebug("Closing compositor caption frame");
    this.captionFrame.bitmap.close();
    this.captionFrame = null;
  }

  private closeFrameFromIgnoredMessage(message: CompositorWorkerMessage): void {
    if (message.type === "FRAME") {
      this.logDebug("Closing frame from ignored compositor message", {
        clipId: message.clipId,
        messageTimestampUs: message.timestampUs,
        frameTimestampUs: message.frame.timestamp,
      });
      message.frame.close();
    }
  }

  private requestRendererFallback(reason: string): void {
    if (this.didRequestRendererFallback) return;
    if (this.renderer?.mode !== "webgl2") return;

    this.logWarn("Requesting compositor renderer fallback", {
      reason,
      requestedPreference: this.rendererPreference,
    });
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
