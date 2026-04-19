import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MousePointer2,
  Scissors,
  Link2,
  Magnet,
  ZoomIn,
  ZoomOut,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { useEditorPlaybackContext } from "../../context/EditorPlaybackContext";
import { useEditorDocumentState } from "../../context/EditorDocumentStateContext";
import { formatHHMMSSFF } from "../../utils/timecode";

interface TimelineToolstripProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onSyncTimeline: () => void;
  snap: boolean;
  onSnapChange: (snap: boolean) => void;
}

export function TimelineToolstrip({
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onSyncTimeline,
  snap,
  onSnapChange,
}: TimelineToolstripProps) {
  const { t } = useTranslation();
  const { zoom, setZoom, currentTimeMs } = useEditorPlaybackContext();
  const { fps } = useEditorDocumentState();
  const [activeTool, setActiveTool] = useState<"select" | "blade">("select");

  return (
    <div
      className="flex items-center px-2 bg-studio-surface border-t border-overlay-sm shrink-0 gap-0.5"
      style={{ height: 40 }}
    >
      {/* Sync button */}
      <button
        type="button"
        title={t("editor_sync_timeline")}
        onClick={onSyncTimeline}
        className="transport-btn mr-1"
      >
        <RefreshCw size={12} />
      </button>

      <div className="w-px h-5 bg-overlay-md mx-1 shrink-0" />

      {/* Tool selector */}
      <button
        type="button"
        title="Select tool"
        onClick={() => setActiveTool("select")}
        className={cn(
          "transport-btn",
          activeTool === "select" && "text-studio-accent bg-studio-accent/10"
        )}
      >
        <MousePointer2 size={13} />
      </button>
      <button
        type="button"
        title="Blade tool"
        onClick={() => setActiveTool("blade")}
        className={cn(
          "transport-btn",
          activeTool === "blade" && "text-studio-accent bg-studio-accent/10"
        )}
      >
        <Scissors size={13} />
      </button>
      <button
        type="button"
        title="Link/Unlink (coming soon)"
        disabled
        className="transport-btn opacity-30"
      >
        <Link2 size={13} />
      </button>

      <div className="w-px h-5 bg-overlay-md mx-1 shrink-0" />

      {/* Snap toggle */}
      <button
        type="button"
        title={snap ? "Snap ON" : "Snap OFF"}
        onClick={() => onSnapChange(!snap)}
        className={cn(
          "transport-btn",
          snap && "text-studio-accent bg-studio-accent/10"
        )}
      >
        <Magnet size={13} />
      </button>
      <span className="text-[9px] text-dim-3 mr-1">{snap ? "Snap" : "Snap"}</span>

      <div className="flex-1" />

      {/* Current timecode */}
      <span className="font-mono text-[10px] text-dim-3 mr-3 tabular-nums">
        {formatHHMMSSFF(currentTimeMs, fps)}
      </span>

      <div className="w-px h-5 bg-overlay-md mx-1 shrink-0" />

      {/* Zoom controls */}
      <button
        onClick={onZoomOut}
        title={t("editor_transport_zoom_out")}
        className="transport-btn"
      >
        <ZoomOut size={13} />
      </button>
      <input
        type="range"
        min={6}
        max={200}
        step={1}
        value={Math.round(zoom)}
        onChange={(e) => setZoom(Number(e.target.value))}
        className="w-20 h-1 accent-studio-accent mx-1"
        title={`${Math.round(zoom)} px/s`}
      />
      <button
        onClick={onZoomIn}
        title={t("editor_transport_zoom_in")}
        className="transport-btn"
      >
        <ZoomIn size={13} />
      </button>
      <span className="text-[9px] text-dim-3 ml-1 w-14 tabular-nums">
        {Math.round(zoom)}px/s
      </span>
      <button
        onClick={onZoomFit}
        className="text-[9px] text-dim-3 hover:text-dim-1 bg-transparent border-0 cursor-pointer px-1.5 h-7 rounded transition-colors hover:bg-overlay-sm"
      >
        {t("editor_transport_zoom_fit")}
      </button>
    </div>
  );
}
