import { useTranslation } from "react-i18next";
import { useEditorProjectStore } from "../../store/editor-project-store";
import { useEditorUIStore } from "../../store/editor-ui-store";

export function EditorStatusBar() {
  const { t } = useTranslation();
  const tracks = useEditorProjectStore((state) => state.tracks);
  const resolution = useEditorProjectStore((state) => state.resolution);
  const fps = useEditorProjectStore((state) => state.fps);
  const exportStatus = useEditorUIStore((state) => state.exportStatus);
  const clipCount = tracks.reduce(
    (count, track) => count + track.clips.length,
    0,
  );
  const trackCount = tracks.length;

  let activityText = t("editor_saved");
  if (exportStatus?.status === "queued" || exportStatus?.status === "rendering") {
    activityText = `Exporting ${Math.round(exportStatus.progress)}%`;
  } else if (exportStatus?.status === "done") {
    activityText = "Export ready";
  } else if (exportStatus?.status === "failed") {
    activityText = "Export failed";
  }

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
      <span>{activityText}</span>
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
