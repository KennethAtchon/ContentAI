import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import { usePreviewSurfaceSize } from "../../runtime/usePreviewSurfaceSize";
import { formatMMSS } from "../../utils/timecode";
import type {
  CompositorWorkerPerformanceMetrics,
  CompositorClipDescriptor,
  CompositorPreviewQuality,
  SerializedTextObject,
  SerializedCaptionFrame,
} from "../../engine/CompositorWorker";
import { systemPerformance } from "@/shared/utils/system/performance";
import { EDITOR_COMPOSITOR_RENDERER } from "@/shared/utils/config/envUtil";

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
  playheadMs: number;
  durationMs: number;
}

export const PreviewCanvas = forwardRef<
  PreviewCanvasHandle,
  PreviewCanvasProps
>(function PreviewCanvas({ resolution, playheadMs, durationMs }, ref) {
  const { t } = useTranslation();
  const outerRef = useRef<HTMLDivElement>(null);
  const visibleCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositorWorkerRef = useRef<Worker | null>(null);
  const compositorReadyRef = useRef(false);
  const pendingDestroyTimerRef = useRef<number | null>(null);

  const { previewSize, resolutionWidth, resolutionHeight } =
    usePreviewSurfaceSize(outerRef, resolution);

  // Spin up compositor worker once and transfer visible canvas ownership.
  useEffect(() => {
    const canvas = visibleCanvasRef.current;
    if (!canvas) return;

    if (pendingDestroyTimerRef.current != null) {
      window.clearTimeout(pendingDestroyTimerRef.current);
      pendingDestroyTimerRef.current = null;
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
          rendererPreference: EDITOR_COMPOSITOR_RENDERER,
        },
        [offscreen]
      );

      compositorWorkerRef.current = worker;
    }

    return () => {
      compositorReadyRef.current = false;
      const activeWorker = compositorWorkerRef.current;
      if (!activeWorker) return;
      pendingDestroyTimerRef.current = window.setTimeout(() => {
        activeWorker.postMessage({ type: "DESTROY" });
        window.setTimeout(() => activeWorker.terminate(), 200);
        if (compositorWorkerRef.current === activeWorker) {
          compositorWorkerRef.current = null;
        }
        systemPerformance.clearDebugValue("compositorWorker");
        pendingDestroyTimerRef.current = null;
      }, 0);
    };
  }, []);

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
          ref={visibleCanvasRef}
          width={resolutionWidth}
          height={resolutionHeight}
          className="absolute inset-0 h-full w-full"
          aria-label={t("editor_preview_label")}
        />
      </div>

      <div className="mt-1 flex w-full justify-between px-3">
        <span className="font-mono text-xs text-dim-3">
          {formatMMSS(playheadMs)} / {formatMMSS(durationMs)}
        </span>
        <span className="text-xs text-dim-3">
          {resolutionWidth} × {resolutionHeight}
        </span>
      </div>
    </div>
  );
});
