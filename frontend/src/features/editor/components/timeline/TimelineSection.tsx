import { useState } from "react";
import type { RefObject } from "react";
import type { Clip, TrackType } from "../../types/editor";
import { Timeline } from "./Timeline";
import { TimelineToolstrip } from "./TimelineToolstrip";

interface TimelineSectionProps {
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
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  playheadMs: number;
  timelineContainerRef: RefObject<HTMLDivElement | null>;
  timelineScrollRef: RefObject<HTMLDivElement | null>;
}

export function TimelineSection({
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
  onZoomIn,
  onZoomOut,
  onZoomFit,
  playheadMs,
  timelineContainerRef,
  timelineScrollRef,
}: TimelineSectionProps) {
  const [snap, setSnap] = useState(true);

  return (
    <div style={{ height: 340 }} className="flex flex-col shrink-0">
      <TimelineToolstrip
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onZoomFit={onZoomFit}
        onSyncTimeline={onSyncTimeline}
        snap={snap}
        onSnapChange={setSnap}
      />
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
          playheadMs={playheadMs}
        />
      </div>
    </div>
  );
}
