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
  CompositorClipDescriptor,
  SerializedTextObject,
  SerializedCaptionFrame,
} from "../../engine/CompositorWorker";

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
  clearFrames(clipIds: string[]): void;
}

interface PreviewCanvasProps {
  resolution: string;
  currentTimeMs: number;
  durationMs: number;
}

export const PreviewCanvas = forwardRef<PreviewCanvasHandle, PreviewCanvasProps>(
  function PreviewCanvas({ resolution, currentTimeMs, durationMs }, ref) {
    const { t } = useTranslation();
    const outerRef = useRef<HTMLDivElement>(null);
    const visibleCanvasRef = useRef<HTMLCanvasElement>(null);
    const compositorWorkerRef = useRef<Worker | null>(null);
    const compositorReadyRef = useRef(false);

    const { previewSize, resolutionWidth, resolutionHeight } =
      usePreviewSurfaceSize(outerRef, resolution);

    // Spin up the compositor worker and transfer the OffscreenCanvas.
    useEffect(() => {
      const canvas = visibleCanvasRef.current;
      if (!canvas) return;

      const worker = new Worker(
        new URL("../../engine/CompositorWorker.ts", import.meta.url),
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
          const bitmapCtx = bitmapCanvas.getContext("bitmaprenderer");
          if (bitmapCtx) {
            bitmapCtx.transferFromImageBitmap(msg.bitmap);
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
      worker.postMessage(
        { type: "INIT", canvas: offscreen, width: resolutionWidth, height: resolutionHeight },
        [offscreen]
      );

      compositorWorkerRef.current = worker;

      return () => {
        compositorReadyRef.current = false;
        worker.postMessage({ type: "DESTROY" });
        setTimeout(() => worker.terminate(), 200);
        compositorWorkerRef.current = null;
      };
    }, [resolutionWidth, resolutionHeight]);

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

    const clearFrames = useCallback((clipIds: string[]) => {
      const worker = compositorWorkerRef.current;
      if (!worker) return;
      for (const clipId of clipIds) {
        worker.postMessage({ type: "CLEAR_CLIP", clipId });
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({ tick, receiveFrame, clearFrames }),
      [tick, receiveFrame, clearFrames]
    );

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
          {/*
            The canvas uses `bitmaprenderer` context — this is the fastest path
            for displaying ImageBitmaps from a Worker. The OffscreenCanvas is
            transferred to the compositor worker on mount.
          */}
          <canvas
            ref={visibleCanvasRef}
            width={resolutionWidth}
            height={resolutionHeight}
            className="absolute inset-0 h-full w-full"
            aria-label={t("editor_preview_label")}
          />
        </div>

        <div className="mt-1 flex w-full justify-between px-3">
          <span className="text-xs text-dim-3">
            {formatMMSS(currentTimeMs)} / {formatMMSS(durationMs)}
          </span>
          <span className="text-xs text-dim-3">
            {resolutionWidth} × {resolutionHeight}
          </span>
        </div>
      </div>
    );
  }
);
