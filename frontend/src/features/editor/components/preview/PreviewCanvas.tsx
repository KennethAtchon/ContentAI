import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePreviewSurfaceSize } from "../../runtime/usePreviewSurfaceSize";

export interface PreviewCanvasHandle {
  getCanvas(): HTMLCanvasElement | null;
}

interface PreviewCanvasProps {
  resolution: string;
}

/**
 * Placeholder canvas that owns the preview surface.
 *
 * Phase 0: renders a gray background with a loading label.
 * Phase 2+: receives an OffscreenCanvas transfer from CompositorWorker
 * and paints ImageBitmap results into this canvas.
 */
export const PreviewCanvas = forwardRef<
  PreviewCanvasHandle,
  PreviewCanvasProps
>(function PreviewCanvas({ resolution }, ref) {
  const { t } = useTranslation();
  const outerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { previewSize, resolutionWidth, resolutionHeight } =
    usePreviewSurfaceSize(outerRef, resolution);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewSize) return;

    canvas.width = resolutionWidth;
    canvas.height = resolutionHeight;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.fillStyle = "#1a1a1a";
    context.fillRect(0, 0, resolutionWidth, resolutionHeight);
    context.fillStyle = "rgba(255,255,255,0.15)";
    context.font = `${Math.round(resolutionHeight * 0.02)}px sans-serif`;
    context.textAlign = "center";
    context.fillText(
      "Preview engine loading",
      resolutionWidth / 2,
      resolutionHeight / 2
    );
  }, [previewSize, resolutionHeight, resolutionWidth]);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));

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
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          aria-label={t("editor_preview_label")}
        />
      </div>

      <div className="mt-1 flex w-full justify-between px-3">
        <span className="text-xs text-dim-3">0:00 / 0:00</span>
        <span className="text-xs text-dim-3">
          {resolutionWidth} x {resolutionHeight}
        </span>
      </div>
    </div>
  );
});
