import { useTranslation } from "react-i18next";
import { useEditorDocumentState } from "../../context/EditorDocumentStateContext";
import { useEditorPersistContext } from "../../context/EditorPersistContext";

export function EditorStatusBar() {
  const { t } = useTranslation();
  const { tracks, resolution, fps } = useEditorDocumentState();
  const { isDirty, isSavingPatch, lastSavedAt } = useEditorPersistContext();

  const clipCount = tracks.reduce((n, tr) => n + tr.clips.length, 0);
  const trackCount = tracks.length;

  const saveLabel = isSavingPatch
    ? t("editor_saving")
    : isDirty
      ? t("editor_status_unsaved")
      : lastSavedAt
        ? t("editor_saved")
        : "";

  return (
    <div
      className="flex items-center px-3 gap-3 bg-studio-surface border-t border-overlay-sm shrink-0 text-[10px] text-dim-3"
      style={{ height: 24 }}
    >
      <span>
        {clipCount} {t("editor_status_clips")} · {trackCount} {t("editor_tracks_label")}
      </span>
      <div className="flex-1" />
      {saveLabel && <span>{saveLabel}</span>}
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
