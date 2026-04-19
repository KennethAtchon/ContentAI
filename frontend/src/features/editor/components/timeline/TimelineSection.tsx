import { useState } from "react";
import { Timeline } from "./Timeline";
import { TimelineToolstrip } from "./TimelineToolstrip";
import { useEditorDocumentContext } from "../../context/EditorDocumentContext";
import { useEditorPlaybackContext } from "../../context/EditorPlaybackContext";
import { invalidateEditorProjectQuery } from "@/shared/lib/query-invalidation";

export function TimelineSection() {
  const [snap, setSnap] = useState(true);
  const {
    editProjectId,
    queryClient,
    handleAddClip,
    handleDeleteAllClipsInTrack,
    handleSelectTransition,
    handleClipSplit,
    handleClipDuplicate,
    handleClipCopy,
    handleClipPaste,
    handleClipToggleEnabled,
    handleClipRippleDelete,
    handleClipSetSpeed,
    handleFocusMediaForTrack,
    removeClip,
  } = useEditorDocumentContext();
  const {
    playheadMs,
    zoomIn,
    zoomOut,
    zoomFit,
    timelineContainerRef,
    timelineScrollRef,
  } = useEditorPlaybackContext();

  return (
    <div style={{ height: 340 }} className="flex flex-col shrink-0">
      <TimelineToolstrip
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomFit={zoomFit}
        onSyncTimeline={() =>
          void invalidateEditorProjectQuery(queryClient, editProjectId ?? "")
        }
        snap={snap}
        onSnapChange={setSnap}
      />
      <div ref={timelineContainerRef} className="flex-1 overflow-hidden">
        <Timeline
          onAddClip={handleAddClip}
          onDeleteAllClipsInTrack={handleDeleteAllClipsInTrack}
          onSelectTransition={handleSelectTransition}
          onClipSplit={handleClipSplit}
          onClipDuplicate={handleClipDuplicate}
          onClipCopy={handleClipCopy}
          onClipPaste={handleClipPaste}
          onClipToggleEnabled={handleClipToggleEnabled}
          onClipRippleDelete={handleClipRippleDelete}
          onClipDelete={removeClip}
          onClipSetSpeed={handleClipSetSpeed}
          scrollRef={timelineScrollRef}
          onFocusMediaForTrack={handleFocusMediaForTrack}
          playheadMs={playheadMs}
        />
      </div>
    </div>
  );
}
