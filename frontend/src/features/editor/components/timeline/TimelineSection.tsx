import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Timeline } from "./Timeline";
import { TimelineToolstrip } from "./TimelineToolstrip";
import { useEditorDocumentState } from "../../context/EditorDocumentStateContext";
import { useEditorDocumentActions } from "../../context/EditorDocumentActionsContext";
import { useEditorSelection } from "../../context/EditorSelectionContext";
import { useEditorClipCommands } from "../../context/EditorClipCommandsContext";
import { useEditorPlaybackContext } from "../../context/EditorPlaybackContext";
import { invalidateEditorProjectQuery } from "@/shared/lib/query-invalidation";

export function TimelineSection() {
  const [snap, setSnap] = useState(true);
  const queryClient = useQueryClient();
  const { editProjectId } = useEditorDocumentState();
  const { removeClip } = useEditorDocumentActions();
  const { handleSelectTransition } = useEditorSelection();
  const {
    handleAddClip,
    handleDeleteAllClipsInTrack,
    handleClipSplit,
    handleClipDuplicate,
    handleClipCopy,
    handleClipPaste,
    handleClipToggleEnabled,
    handleClipRippleDelete,
    handleClipSetSpeed,
    handleFocusMediaForTrack,
  } = useEditorClipCommands();
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
        onSyncTimeline={() => {
          if (editProjectId) {
            void invalidateEditorProjectQuery(queryClient, editProjectId);
          }
        }}
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
