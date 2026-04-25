import { forwardRef, useImperativeHandle } from "react";
import { useTranslation } from "react-i18next";
import { formatMMSS } from "../../lib/timecode";

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
  const [width, height] = resolution.split("x").map(Number);
  const aspectRatio = `${width || 1080} / ${height || 1920}`;

  useImperativeHandle(
    ref,
    () => ({
      tick: () => undefined,
      receiveFrame: () => undefined,
      clearFrames: () => undefined,
    }),
    []
  );

  return (
    <div className="flex-1 min-h-0 bg-studio-bg flex items-center justify-center p-6">
      <div
        className="relative max-h-full max-w-full rounded-md overflow-hidden border border-overlay-md bg-black shadow-2xl"
        style={{ aspectRatio, height: "100%" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.12),transparent_45%),linear-gradient(180deg,rgba(167,139,250,0.22),rgba(12,12,16,0.94))]" />
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute left-3 top-3 rounded bg-black/45 px-2 py-1 text-[10px] text-white/75">
          {resolution}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-white/50">
            {t("editor_preview_label")}
          </span>
        </div>
        <div className="absolute right-3 bottom-3 rounded bg-black/45 px-2 py-1 font-mono text-[10px] text-white/75">
          00:00 / {formatMMSS(durationMs)}
        </div>
      </div>
    </div>
  );
});
