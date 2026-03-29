import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import type { Clip, Track, TrackType } from "../types/editor";
import { Timeline } from "./Timeline";

interface EditorTimelineSectionProps {
  tracks: Track[];
  durationMs: number;
  currentTimeMs: number;
  zoom: number;
  selectedClipId: string | null;
  selectedTransitionId: string | null;
  hasClipboard: boolean;
  onSyncTimeline: () => void;
  onSeek: (ms: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onUpdateClip: (clipId: string, patch: Partial<Clip>) => void;
  onAddClip: (trackId: string, clip: Clip) => void;
  onToggleMute: (trackId: string) => void;
  onToggleLock: (trackId: string) => void;
  onDeleteAllClipsInTrack: (trackId: string) => void;
  onSelectTransition: (trackId: string, clipAId: string, clipBId: string) => void;
  onRemoveTransition: (trackId: string, transitionId: string) => void;
  onClipSplit: (clipId: string) => void;
  onClipDuplicate: (clipId: string) => void;
  onClipCopy: (clipId: string) => void;
  onClipPaste: (trackId: string, startMs: number) => void;
  onClipToggleEnabled: (clipId: string) => void;
  onClipRippleDelete: (clipId: string) => void;
  onClipDelete: (clipId: string) => void;
  onClipSetSpeed: (clipId: string, speed: number) => void;
  onAddVideoTrack: (afterTrackId: string) => void;
  onRemoveTrack: (trackId: string) => void;
  onRenameTrack: (trackId: string, name: string) => void;
  onReorderTracks: (trackIds: string[]) => void;
  onFocusMediaForTrack: (trackType: TrackType, trackId: string, startMs: number) => void;
  timelineContainerRef: RefObject<HTMLDivElement | null>;
  timelineScrollRef: RefObject<HTMLDivElement | null>;
}

export function EditorTimelineSection({
  tracks,
  durationMs,
  currentTimeMs,
  zoom,
  selectedClipId,
  selectedTransitionId,
  hasClipboard,
  onSyncTimeline,
  onSeek,
  onSelectClip,
  onUpdateClip,
  onAddClip,
  onToggleMute,
  onToggleLock,
  onDeleteAllClipsInTrack,
  onSelectTransition,
  onRemoveTransition,
  onClipSplit,
  onClipDuplicate,
  onClipCopy,
  onClipPaste,
  onClipToggleEnabled,
  onClipRippleDelete,
  onClipDelete,
  onClipSetSpeed,
  onAddVideoTrack,
  onRemoveTrack,
  onRenameTrack,
  onReorderTracks,
  onFocusMediaForTrack,
  timelineContainerRef,
  timelineScrollRef,
}: EditorTimelineSectionProps) {
  const { t } = useTranslation();

  return (
    <div style={{ height: 296 }} className="flex flex-col shrink-0">
      <div
        className="flex items-center justify-between px-3 py-1 border-t border-overlay-sm bg-studio-surface shrink-0"
        style={{ height: 32 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-dim-1">{t("editor_timeline_label")}</span>
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
          {Math.round(zoom)} px/s · {(durationMs / 60000).toFixed(1)} min
        </span>
      </div>

      <div ref={timelineContainerRef} className="flex-1 overflow-hidden">
        <Timeline
          tracks={tracks}
          durationMs={durationMs}
          currentTimeMs={currentTimeMs}
          zoom={zoom}
          selectedClipId={selectedClipId}
          hasClipboard={hasClipboard}
          onSeek={onSeek}
          onSelectClip={onSelectClip}
          onUpdateClip={onUpdateClip}
          onAddClip={onAddClip}
          onToggleMute={onToggleMute}
          onToggleLock={onToggleLock}
          onDeleteAllClipsInTrack={onDeleteAllClipsInTrack}
          selectedTransitionId={selectedTransitionId}
          onSelectTransition={onSelectTransition}
          onRemoveTransition={onRemoveTransition}
          onClipSplit={onClipSplit}
          onClipDuplicate={onClipDuplicate}
          onClipCopy={onClipCopy}
          onClipPaste={onClipPaste}
          onClipToggleEnabled={onClipToggleEnabled}
          onClipRippleDelete={onClipRippleDelete}
          onClipDelete={onClipDelete}
          onClipSetSpeed={onClipSetSpeed}
          onAddVideoTrack={onAddVideoTrack}
          onRemoveTrack={onRemoveTrack}
          onRenameTrack={onRenameTrack}
          onReorderTracks={onReorderTracks}
          scrollRef={timelineScrollRef}
          onFocusMediaForTrack={onFocusMediaForTrack}
        />
      </div>
    </div>
  );
}
