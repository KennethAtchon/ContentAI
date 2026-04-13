import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import type { Clip, TrackType } from "../../types/editor";
import { Timeline } from "../timeline/Timeline";
import { useEditorContext } from "../../context/EditorContext";

interface EditorTimelineSectionProps {
  onSyncTimeline: () => void;
  onAddClip: (trackId: string, clip: Clip) => void;
  onDeleteAllClipsInTrack: (trackId: string) => void;
  onSelectTransition: (
    trackId: string,
    clipAId: string,
    clipBId: string
  ) => void;
  onClipSplit: (clipId: string) => void;
  onClipDuplicate: (clipId: string) => void;
  onClipCopy: (clipId: string) => void;
  onClipPaste: (trackId: string, startMs: number) => void;
  onClipToggleEnabled: (clipId: string) => void;
  onClipRippleDelete: (clipId: string) => void;
  onClipDelete: (clipId: string) => void;
  onClipSetSpeed: (clipId: string, speed: number) => void;
  onFocusMediaForTrack: (
    trackType: TrackType,
    trackId: string,
    startMs: number
  ) => void;
  timelineContainerRef: RefObject<HTMLDivElement | null>;
  timelineScrollRef: RefObject<HTMLDivElement | null>;
}

export function EditorTimelineSection({
  onSyncTimeline,
  onAddClip,
  onDeleteAllClipsInTrack,
  onSelectTransition,
  onClipSplit,
  onClipDuplicate,
  onClipCopy,
  onClipPaste,
  onClipToggleEnabled,
  onClipRippleDelete,
  onClipDelete,
  onClipSetSpeed,
  onFocusMediaForTrack,
  timelineContainerRef,
  timelineScrollRef,
}: EditorTimelineSectionProps) {
  const { t } = useTranslation();
  const { state } = useEditorContext();

  return (
    <div style={{ height: 296 }} className="flex flex-col shrink-0">
      <div
        className="flex items-center justify-between px-3 py-1 border-t border-overlay-sm bg-studio-surface shrink-0"
        style={{ height: 32 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-dim-1">
            {t("editor_timeline_label")}
          </span>
          <button
            type="button"
            title={t("editor_sync_timeline")}
            onClick={onSyncTimeline}
            className="p-1 rounded hover:bg-overlay-sm text-dim-3 hover:text-dim-1"
          >
            <RefreshCw size={12} />
          </button>
        </div>
        <span className="text-xs italic text-dim-3">
          {Math.round(state.zoom)} px/s ·{" "}
          {(state.durationMs / 60000).toFixed(1)} min
        </span>
      </div>

      <div ref={timelineContainerRef} className="flex-1 overflow-hidden">
        <Timeline
          onAddClip={onAddClip}
          onDeleteAllClipsInTrack={onDeleteAllClipsInTrack}
          onSelectTransition={onSelectTransition}
          onClipSplit={onClipSplit}
          onClipDuplicate={onClipDuplicate}
          onClipCopy={onClipCopy}
          onClipPaste={onClipPaste}
          onClipToggleEnabled={onClipToggleEnabled}
          onClipRippleDelete={onClipRippleDelete}
          onClipDelete={onClipDelete}
          onClipSetSpeed={onClipSetSpeed}
          scrollRef={timelineScrollRef}
          onFocusMediaForTrack={onFocusMediaForTrack}
        />
      </div>
    </div>
  );
}
