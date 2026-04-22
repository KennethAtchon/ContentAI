import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
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
import { systemPerformance } from "@/shared/utils/system/performance";

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
  {
    resolution,
    durationMs,
    rendererPreference,
    onRendererPreferenceChange,
  },
  ref
) {
  const { t } = useTranslation();
  const clock = usePlayheadClock();
  const timecodeRef = useRef<HTMLSpanElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const visibleCanvasRef = useRef<HTMLCanvasElement>(null);
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

    if (
      pendingDestroyTimerRef.current != null &&
      pendingDestroyRendererRef.current === rendererPreference
    ) {
      window.clearTimeout(pendingDestroyTimerRef.current);
      pendingDestroyTimerRef.current = null;
      pendingDestroyRendererRef.current = null;
    } else if (pendingDestroyTimerRef.current != null) {
      compositorWorkerRef.current = null;
    }

    let worker = compositorWorkerRef.current;
    if (!worker) {
      worker = new Worker(
        new URL("../../engine/CompositorWorker.ts", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;
        if (msg.type === "READY") {
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
          systemPerformance.setDebugValue("compositorRendererFallback", msg);
          onRendererPreferenceChange("canvas2d");
        }
      };

      const offscreen = canvas.transferControlToOffscreen();
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

      compositorWorkerRef.current = worker;
    }

    return () => {
      compositorReadyRef.current = false;
      const activeWorker = compositorWorkerRef.current;
      if (!activeWorker) return;
      pendingDestroyRendererRef.current = rendererPreference;
      pendingDestroyTimerRef.current = window.setTimeout(() => {
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
      if (!worker || !compositorReadyRef.current) return;

      const transferables: Transferable[] = captionFrame
        ? [captionFrame.bitmap]
        : [];
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
        frame.close();
        return;
      }
      worker.postMessage({ type: "FRAME", frame, timestampUs, clipId }, [
        frame as unknown as Transferable,
      ]);
    },
    []
  );

  const clearFrames = useCallback((clipIds: string[]) => {
    const worker = compositorWorkerRef.current;
    if (!worker) return;
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
        <span ref={timecodeRef} className="font-mono text-xs text-dim-3 tabular-nums">
          {formatMMSS(clock.getTime())} / {formatMMSS(durationMs)}
        </span>
        <span className="text-xs text-dim-3">
          {resolutionWidth} × {resolutionHeight}
        </span>
      </div>
    </div>
  );
});
