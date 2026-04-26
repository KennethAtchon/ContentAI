import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";
import { formatMMSS } from "../../lib/timecode";
import { useEditorTimelineStore } from "../../store/editor-timeline-store";
import { getEditorRuntime } from "../../runtime/editor-runtime";

export interface PreviewCanvasHandle {
  tick(): void;
  receiveFrame(): void;
  clearFrames(): void;
}

interface PreviewCanvasProps {
  resolution?: string;
  durationMs?: number;
}

export const PreviewCanvas = forwardRef<
  PreviewCanvasHandle,
  PreviewCanvasProps
>(function PreviewCanvas({ resolution = "1080x1920", durationMs = 0 }, ref) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentTimeMs = useEditorTimelineStore((state) => state.currentTimeMs);
  const runtime = getEditorRuntime();
  const runtimeSnapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const [width, height] = resolution.split("x").map(Number);
  const aspectRatio = `${width || 1080} / ${height || 1920}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    runtime.drawPreviewFrame(canvasRef.current, resolution, currentTimeMs);
  }, [runtime, runtimeSnapshot.updatedAt, resolution, currentTimeMs]);

  useImperativeHandle(
    ref,
    () => ({
      tick: () => {
        if (canvasRef.current) {
          runtime.drawPreviewFrame(canvasRef.current, resolution, currentTimeMs);
        }
      },
      receiveFrame: () => {
        if (canvasRef.current) {
          runtime.drawPreviewFrame(canvasRef.current, resolution, currentTimeMs);
        }
      },
      clearFrames: () => {
        if (canvasRef.current) {
          runtime.clearPreview(canvasRef.current);
        }
      },
    }),
    [currentTimeMs, resolution, runtime]
  );

  return (
    <div className="flex-1 min-h-0 bg-studio-bg flex items-center justify-center p-6">
      <div
        className="relative max-h-full max-w-full rounded-md overflow-hidden border border-overlay-md bg-black shadow-2xl"
        style={{ aspectRatio, height: "100%" }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute left-3 top-3 rounded bg-black/45 px-2 py-1 text-[10px] text-white/75">
          {resolution}
        </div>
        {!runtimeSnapshot.projectFile && (
          <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-white/50">
            {t("editor_preview_label")}
          </span>
          </div>
        )}
        <div className="absolute right-3 bottom-3 rounded bg-black/45 px-2 py-1 font-mono text-[10px] text-white/75">
          {formatMMSS(currentTimeMs)} / {formatMMSS(durationMs)}
        </div>
      </div>
    </div>
  );
});
