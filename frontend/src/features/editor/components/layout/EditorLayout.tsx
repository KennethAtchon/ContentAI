import { invalidateEditorProjectQuery } from "@/shared/lib/query-invalidation";
import { EditorProvider } from "../../context/EditorContext";
import { AssetUrlMapContext } from "../../contexts/asset-url-map-context";
import { useEditorLayoutRuntime } from "../../hooks/useEditorLayoutRuntime";
import type { EditProject } from "../../types/editor";
import { EditorHeader } from "./EditorHeader";
import { EditorWorkspace } from "./EditorWorkspace";
import { EditorStatusBar } from "./EditorStatusBar";
import { TimelineSection } from "../timeline/TimelineSection";
import { EditorDialogs } from "../dialogs/EditorDialogs";

interface Props {
  project: EditProject;
  onBack: () => void;
}

export function EditorLayout({ project, onBack }: Props) {
  const runtime = useEditorLayoutRuntime(project, onBack);
  const { state, store, clipActions, transport } = runtime;

  return (
    <EditorProvider store={store}>
      <AssetUrlMapContext.Provider value={runtime.assetUrlMap}>
        <div
          className="flex flex-col bg-studio-bg overflow-hidden min-w-0 w-full"
          style={{ height: "100%" }}
        >
          <EditorHeader
            title={state.title}
            isReadOnly={state.isReadOnly}
            pastLength={state.past.length}
            futureLength={state.future.length}
            isDirty={runtime.isDirty}
            isSavingPatch={runtime.isSavingPatch}
            lastSavedAt={runtime.lastSavedAt}
            isPublishing={runtime.isPublishing}
            isCreatingDraft={runtime.isCreatingDraft}
            onBack={() => void transport.handleBack()}
            onTitleChange={store.setTitle}
            onUndo={store.undo}
            onRedo={store.redo}
            onOpenExport={() => runtime.setShowExport(true)}
            onOpenPublishDialog={() => runtime.setPublishDialogOpen(true)}
            onCreateNewDraft={() => runtime.createNewDraft()}
            onSaveNow={transport.saveNow}
          />

          <EditorWorkspace
            project={project}
            tracks={state.tracks}
            currentTimeMs={state.currentTimeMs}
            playheadMs={runtime.playheadMs}
            isPlaying={state.isPlaying}
            durationMs={state.durationMs}
            fps={state.fps}
            resolution={state.resolution}
            selectedTransition={clipActions.selectedTransition}
            effectPreview={runtime.effectPreview}
            mediaActiveTab={runtime.mediaActiveTab}
            pendingAdd={runtime.pendingAdd}
            isReadOnly={state.isReadOnly}
            isCapturingThumbnail={runtime.isCapturingThumbnail}
            onPlayheadChange={runtime.setPlayheadMs}
            onSetEffectPreview={runtime.setEffectPreview}
            onSetMediaActiveTab={runtime.setMediaActiveTab}
            onClearPendingAdd={() => runtime.setPendingAdd(null)}
            onAddClip={clipActions.handleAddClip}
            onFpsChange={store.setFps}
            onResolutionChange={store.setResolution}
            onCaptureThumbnail={() => void runtime.captureThumbnail()}
            onJumpToStart={transport.jumpToStart}
            onRewind={transport.rewind}
            onTogglePlaying={() => store.setPlaying(!state.isPlaying)}
            onFastForward={transport.fastForward}
            onJumpToEnd={transport.jumpToEnd}
            onSetCurrentTime={store.setCurrentTime}
          />

          <TimelineSection
            onSyncTimeline={() =>
              void invalidateEditorProjectQuery(runtime.queryClient, project.id)
            }
            onAddClip={clipActions.handleAddClip}
            onDeleteAllClipsInTrack={clipActions.handleDeleteAllClipsInTrack}
            onSelectTransition={clipActions.handleSelectTransition}
            onClipSplit={clipActions.handleClipSplit}
            onClipDuplicate={clipActions.handleClipDuplicate}
            onClipCopy={clipActions.handleClipCopy}
            onClipPaste={clipActions.handleClipPaste}
            onClipToggleEnabled={clipActions.handleClipToggleEnabled}
            onClipRippleDelete={clipActions.handleClipRippleDelete}
            onClipDelete={clipActions.handleRemoveClip}
            onClipSetSpeed={clipActions.handleClipSetSpeed}
            onFocusMediaForTrack={clipActions.handleFocusMediaForTrack}
            onZoomIn={transport.zoomIn}
            onZoomOut={transport.zoomOut}
            onZoomFit={transport.zoomFit}
            playheadMs={runtime.playheadMs}
            timelineContainerRef={runtime.timelineContainerRef}
            timelineScrollRef={runtime.timelineScrollRef}
          />

          <EditorStatusBar
            isDirty={runtime.isDirty}
            isSavingPatch={runtime.isSavingPatch}
            lastSavedAt={runtime.lastSavedAt}
          />

          <EditorDialogs
            showExport={runtime.showExport}
            editProjectId={state.editProjectId}
            resolution={state.resolution}
            fps={state.fps}
            onCloseExport={() => runtime.setShowExport(false)}
            scriptResetPending={runtime.scriptResetPending}
            onScriptIterationDialogOpenChange={runtime.onScriptIterationDialogOpenChange}
            onConfirmScriptIteration={runtime.confirmScriptIteration}
            publishDialogOpen={runtime.publishDialogOpen}
            onPublishDialogOpenChange={runtime.setPublishDialogOpen}
            isPublishing={runtime.isPublishing}
            isSavingPatch={runtime.isSavingPatch}
            onConfirmPublish={() => void transport.handleConfirmPublish()}
          />
        </div>
      </AssetUrlMapContext.Provider>
    </EditorProvider>
  );
}
