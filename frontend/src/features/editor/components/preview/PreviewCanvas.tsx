import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
  type ElementRef,
} from "react";
import { useTranslation } from "react-i18next";
import { usePreviewSurfaceSize } from "../../runtime/usePreviewSurfaceSize";
import { usePlayheadClock } from "../../context/PlayheadClockContext";
import { formatMMSS } from "../../utils/timecode";
import type {
  CompositorWorkerPerformanceMetrics,
  CompositorClipDescriptor,
  CompositorPreviewQuality,
  CompositorRendererPreference,
  SerializedTextObject,
  SerializedCaptionFrame,
} from "../../engine/CompositorWorker";
import { debugLog } from "@/shared/utils/debug";
import { systemPerformance } from "@/shared/utils/system/performance";

const LOG_COMPONENT = "PreviewCanvas";

export interface PreviewCanvasHandle {
  /**
   * Send a TICK to the compositor worker.
   * Call this from the rAF loop, driven by the AudioContext clock.
   */
  tick(
    playheadMs: number,
    clips: CompositorClipDescriptor[],
    textObjects: SerializedTextObject[],
    captionFrame?: SerializedCaptionFrame | null,
    quality?: CompositorPreviewQuality
  ): void;
  /**
   * Notify the compositor of a decoded VideoFrame from the DecoderPool.
   * The frame is transferred to the worker (zero-copy).
   */
  receiveFrame(frame: VideoFrame, timestampUs: number, clipId: string): void;
  clearFrames(clipIds: string[]): void;
}

interface PreviewCanvasProps {
  resolution: string;
  durationMs: number;
  rendererPreference: CompositorRendererPreference;
  onRendererPreferenceChange: (
    preference: CompositorRendererPreference
  ) => void;
}

export const PreviewCanvas = forwardRef<
  PreviewCanvasHandle,
  PreviewCanvasProps
>(function PreviewCanvas(
  { resolution, durationMs, rendererPreference, onRendererPreferenceChange },
  ref
) {
  const logDebug = (
    message: string,
    context?: Record<string, unknown>,
    data?: unknown
  ) => {
    debugLog.debug(message, { component: LOG_COMPONENT, ...context }, data);
  };

  const { t } = useTranslation();
  const clock = usePlayheadClock();
  const timecodeRef = useRef<ElementRef<"span">>(null);
  const outerRef = useRef<ElementRef<"div">>(null);
  const visibleCanvasRef = useRef<ElementRef<"canvas">>(null);
  const compositorWorkerRef = useRef<Worker | null>(null);
  const compositorReadyRef = useRef(false);
  const pendingDestroyTimerRef = useRef<number | null>(null);
  const pendingDestroyRendererRef = useRef<CompositorRendererPreference | null>(
    null
  );

  const { previewSize, resolutionWidth, resolutionHeight } =
    usePreviewSurfaceSize(outerRef, resolution);

  // Spin up compositor worker once and transfer visible canvas ownership.
  useEffect(() => {
    const canvas = visibleCanvasRef.current;
    if (!canvas) return;

    logDebug("Preparing preview canvas worker lifecycle", {
      rendererPreference,
      resolution,
      resolutionWidth,
      resolutionHeight,
    });

    if (
      pendingDestroyTimerRef.current != null &&
      pendingDestroyRendererRef.current === rendererPreference
    ) {
      logDebug("Cancelled pending worker destroy due to renderer reuse", {
        rendererPreference,
      });
      window.clearTimeout(pendingDestroyTimerRef.current);
      pendingDestroyTimerRef.current = null;
      pendingDestroyRendererRef.current = null;
    } else if (pendingDestroyTimerRef.current != null) {
      logDebug("Dropping previous worker ref due to renderer change", {
        previousRendererPreference: pendingDestroyRendererRef.current,
        nextRendererPreference: rendererPreference,
      });
      compositorWorkerRef.current = null;
    }

    let worker = compositorWorkerRef.current;
    if (!worker) {
      logDebug("Creating compositor worker", {
        rendererPreference,
        resolutionWidth,
        resolutionHeight,
      });
      worker = new Worker(
        new URL("../../engine/CompositorWorker.ts", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;
        if (msg.type === "READY") {
          logDebug("Compositor worker reported READY", {
            rendererPreference,
            resolutionWidth,
            resolutionHeight,
          });
          compositorReadyRef.current = true;
          systemPerformance.setDebugValue("compositorWorker", {
            ready: true,
            resolutionWidth,
            resolutionHeight,
          });
          return;
        }

        if (msg.type === "PERFORMANCE") {
          const metrics = msg.metrics as CompositorWorkerPerformanceMetrics;
          logDebug("Received compositor worker performance metrics", {
            renderer: metrics.renderer,
            playheadMs: metrics.playheadMs,
            clipCount: metrics.clipCount,
            incomingClipIds: metrics.incomingClipIds,
            queueClipIds: metrics.queueClipIds,
            matchedQueueClipIds: metrics.matchedQueueClipIds,
            missingQueueClipIds: metrics.missingQueueClipIds,
            blankClipIds: metrics.blankClipIds,
            drawableClipCount: metrics.drawableClipCount,
            drawableClipIds: metrics.drawableClipIds,
            drawnVideoClipCount: metrics.drawnVideoClipCount,
            drawnVideoClipIds: metrics.drawnVideoClipIds,
            missingFrameClipCount: metrics.missingFrameClipCount,
            missingFrameClipIds: metrics.missingFrameClipIds,
            failedVideoClipCount: metrics.failedVideoClipCount,
            failedVideoClipIds: metrics.failedVideoClipIds,
            renderOk: metrics.renderOk,
            overlayDrawn: metrics.overlayDrawn,
            overlayOnly: metrics.overlayOnly,
            textObjectCount: metrics.textObjectCount,
            frameQueueTotal: metrics.frameQueueTotal,
            previewQualityLevel: metrics.previewQuality.level,
            previewQualityScale: metrics.previewQuality.scale,
          });
          systemPerformance.record(
            "editor.compositorWorker.tick",
            metrics.compositorFrameMs,
            metrics as unknown as Record<string, unknown>
          );
          systemPerformance.setDebugValue("compositorWorker", {
            ready: true,
            ...metrics,
          });
          return;
        }

        if (msg.type === "RENDERER_FALLBACK_REQUIRED") {
          logDebug("Compositor worker requested renderer fallback", msg);
          systemPerformance.setDebugValue("compositorRendererFallback", msg);
          onRendererPreferenceChange("canvas2d");
        }
      };

      const offscreen = canvas.transferControlToOffscreen();
      logDebug("Transferred visible canvas to compositor worker", {
        width: resolutionWidth,
        height: resolutionHeight,
        rendererPreference,
      });
      worker.postMessage(
        {
          type: "INIT",
          canvas: offscreen,
          width: resolutionWidth,
          height: resolutionHeight,
          debugEnabled: systemPerformance.isEnabled,
          rendererPreference,
        },
        [offscreen]
      );
      logDebug("Posted INIT to compositor worker", {
        width: resolutionWidth,
        height: resolutionHeight,
        rendererPreference,
        debugEnabled: systemPerformance.isEnabled,
      });

      compositorWorkerRef.current = worker;
    }

    return () => {
      compositorReadyRef.current = false;
      const activeWorker = compositorWorkerRef.current;
      if (!activeWorker) return;
      pendingDestroyRendererRef.current = rendererPreference;
      logDebug("Scheduling compositor worker destroy", {
        rendererPreference,
      });
      pendingDestroyTimerRef.current = window.setTimeout(() => {
        logDebug("Posting DESTROY to compositor worker", {
          rendererPreference,
        });
        activeWorker.postMessage({ type: "DESTROY" });
        window.setTimeout(() => activeWorker.terminate(), 200);
        if (compositorWorkerRef.current === activeWorker) {
          compositorWorkerRef.current = null;
        }
        systemPerformance.clearDebugValue("compositorWorker");
        pendingDestroyTimerRef.current = null;
        pendingDestroyRendererRef.current = null;
      }, 0);
    };
  }, [onRendererPreferenceChange, rendererPreference]);

  useEffect(() => {
    const worker = compositorWorkerRef.current;
    if (!worker) return;

    logDebug("Posting RESIZE to compositor worker", {
      width: resolutionWidth,
      height: resolutionHeight,
    });
    worker.postMessage({
      type: "RESIZE",
      width: resolutionWidth,
      height: resolutionHeight,
    });
  }, [resolutionHeight, resolutionWidth]);

  const tick = useCallback(
    (
      playheadMs: number,
      clips: CompositorClipDescriptor[],
      textObjects: SerializedTextObject[],
      captionFrame?: SerializedCaptionFrame | null,
      quality?: CompositorPreviewQuality
    ) => {
      const worker = compositorWorkerRef.current;
      if (!worker || !compositorReadyRef.current) {
        logDebug("Skipped compositor tick because worker is unavailable", {
          playheadMs,
          hasWorker: Boolean(worker),
          workerReady: compositorReadyRef.current,
        });
        return;
      }

      const transferables: Transferable[] = captionFrame
        ? [captionFrame.bitmap]
        : [];
      logDebug("Posting compositor tick", {
        playheadMs,
        clipCount: clips.length,
        clipIds: clips.map((clip) => clip.clipId),
        textObjectCount: textObjects.length,
        captionFrameState:
          captionFrame === undefined ? "unchanged" : captionFrame ? "replace" : "clear",
        previewQualityLevel: quality?.level ?? "default",
        previewQualityScale: quality?.scale ?? "default",
      });
      worker.postMessage(
        captionFrame === undefined
          ? { type: "OVERLAY", textObjects }
          : { type: "OVERLAY", textObjects, captionFrame },
        transferables
      );

      worker.postMessage({ type: "TICK", playheadMs, clips, quality });
    },
    []
  );

  const receiveFrame = useCallback(
    (frame: VideoFrame, timestampUs: number, clipId: string) => {
      const worker = compositorWorkerRef.current;
      if (!worker) {
        logDebug("Dropped frame because compositor worker is unavailable", {
          clipId,
          timestampUs,
          frameTimestampUs: frame.timestamp,
        });
        frame.close();
        return;
      }
      logDebug("Posting decoded frame to compositor worker", {
        clipId,
        timestampUs,
        frameTimestampUs: frame.timestamp,
        frameDisplayWidth: frame.displayWidth,
        frameDisplayHeight: frame.displayHeight,
      });
      worker.postMessage({ type: "FRAME", frame, timestampUs, clipId }, [
        frame as unknown as Transferable,
      ]);
    },
    []
  );

  const clearFrames = useCallback((clipIds: string[]) => {
    const worker = compositorWorkerRef.current;
    if (!worker) return;
    logDebug("Posting clear-frame messages to compositor worker", {
      clipCount: clipIds.length,
      clipIds,
    });
    for (const clipId of clipIds) {
      worker.postMessage({ type: "CLEAR_CLIP", clipId });
    }
  }, []);

  useImperativeHandle(ref, () => ({ tick, receiveFrame, clearFrames }), [
    tick,
    receiveFrame,
    clearFrames,
  ]);

  useEffect(() => {
    return clock.subscribe((ms) => {
      if (timecodeRef.current) {
        timecodeRef.current.textContent = `${formatMMSS(ms)} / ${formatMMSS(durationMs)}`;
      }
    });
  }, [clock, durationMs]);

  return (
    <div
      ref={outerRef}
      className="flex flex-1 flex-col items-center justify-center overflow-hidden bg-studio-bg px-2 py-2 min-w-0"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-dim-3">
        {t("editor_preview_label")}
      </p>

      <div
        className="relative bg-black"
        style={{
          width: previewSize?.w ?? 0,
          height: previewSize?.h ?? 0,
        }}
      >
        <canvas
          key={rendererPreference}
          ref={visibleCanvasRef}
          width={resolutionWidth}
          height={resolutionHeight}
          className="absolute inset-0 h-full w-full"
          aria-label={t("editor_preview_label")}
        />
      </div>

      <div className="mt-1 flex w-full justify-between px-3">
        <span
          ref={timecodeRef}
          className="font-mono text-xs text-dim-3 tabular-nums"
        >
          {formatMMSS(clock.getTime())} / {formatMMSS(durationMs)}
        </span>
        <span className="text-xs text-dim-3">
          {resolutionWidth} × {resolutionHeight}
        </span>
      </div>
    </div>
  );
});
