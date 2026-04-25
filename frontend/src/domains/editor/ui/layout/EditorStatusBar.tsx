import { useTranslation } from "react-i18next";

interface EditorStatusBarProps {
  clipCount?: number;
  trackCount?: number;
  resolution?: string;
  fps?: number;
}

export function EditorStatusBar({
  clipCount = 0,
  trackCount = 0,
  resolution = "1080x1920",
  fps = 30,
}: EditorStatusBarProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center px-3 gap-3 bg-studio-surface border-t border-overlay-sm shrink-0 text-[10px] text-dim-3"
      style={{ height: 24 }}
    >
      <span>
        {clipCount} {t("editor_status_clips")} · {trackCount}{" "}
        {t("editor_tracks_label")}
      </span>
      <div className="flex-1" />
      <span>{t("editor_saved")}</span>
      <div className="w-px h-3 bg-overlay-md shrink-0" />
      <span>
        {resolution} · {fps} fps
      </span>
      <div className="w-px h-3 bg-overlay-md shrink-0" />
      <span className="flex items-center gap-1">
        <span className="text-green-500">●</span>
        connected
      </span>
    </div>
  );
}
