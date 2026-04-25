import { Minus, Plus, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface TimelineToolstripProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomFit?: () => void;
  onSyncTimeline?: () => void;
  snap?: boolean;
  onSnapChange?: (value: boolean) => void;
}

export function TimelineToolstrip({
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onSyncTimeline,
  snap = true,
  onSnapChange,
}: TimelineToolstripProps) {
  const { t } = useTranslation();

  return (
    <div
      className="flex items-center gap-2 px-3 bg-studio-surface border-t border-overlay-sm"
      style={{ height: 40 }}
    >
      <button
        className="transport-btn"
        onClick={onZoomOut}
        title={t("editor_timeline_zoom_out")}
      >
        <Minus size={14} />
      </button>
      <button
        className="transport-btn"
        onClick={onZoomIn}
        title={t("editor_timeline_zoom_in")}
      >
        <Plus size={14} />
      </button>
      <button
        className="text-xs px-2 py-1 rounded border border-overlay-sm text-dim-2 bg-overlay-sm"
        onClick={onZoomFit}
      >
        Fit
      </button>
      <label className="flex items-center gap-1.5 text-xs text-dim-2">
        <input
          type="checkbox"
          checked={snap}
          onChange={(event) => onSnapChange?.(event.target.checked)}
          className="accent-studio-accent"
        />
        Snap
      </label>
      <div className="flex-1" />
      <button
        className="transport-btn"
        onClick={onSyncTimeline}
        title={t("editor_sync_timeline")}
      >
        <RefreshCcw size={14} />
      </button>
    </div>
  );
}
