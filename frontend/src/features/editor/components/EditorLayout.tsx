import { queryKeys } from "@/shared/lib/query-keys";
import { EditorProvider } from "../context/EditorContext";
import { AssetUrlMapContext } from "../contexts/asset-url-map-context";
import { useEditorLayoutRuntime } from "../hooks/useEditorLayoutRuntime";
import type { EditProject } from "../types/editor";
import { EditorToolbar } from "./EditorToolbar";
import { EditorWorkspace } from "./EditorWorkspace";
import { EditorTimelineSection } from "./EditorTimelineSection";
import { EditorDialogs } from "./EditorDialogs";

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
        <div className="flex flex-col bg-studio-bg overflow-hidden min-w-0 w-full" style={{ height: "100%" }}>
          <EditorToolbar
            title={state.title}
            isReadOnly={state.isReadOnly}
            pastLength={state.past.length}
            futureLength={state.future.length}
            isPlaying={state.isPlaying}
            currentTimeMs={state.currentTimeMs}
            durationMs={state.durationMs}
            fps={state.fps}
            zoom={state.zoom}
            resolution={state.resolution}
            isDirty={runtime.isDirty}
            isSavingPatch={runtime.isSavingPatch}
            lastSavedAt={runtime.lastSavedAt}
            isPublishing={runtime.isPublishing}
            isCreatingDraft={runtime.isCreatingDraft}
            isCapturingThumbnail={runtime.isCapturingThumbnail}
            onBack={() => void transport.handleBack()}
            onTitleChange={store.setTitle}
            onUndo={store.undo}
            onRedo={store.redo}
            onJumpToStart={transport.jumpToStart}
            onRewind={transport.rewind}
            onTogglePlaying={() => store.setPlaying(!state.isPlaying)}
            onFastForward={transport.fastForward}
            onJumpToEnd={transport.jumpToEnd}
            onSetCurrentTime={store.setCurrentTime}
            onZoomIn={transport.zoomIn}
            onZoomOut={transport.zoomOut}
            onZoomFit={transport.zoomFit}
            onResolutionChange={store.setResolution}
            onCaptureThumbnail={() => void runtime.captureThumbnail()}
            onOpenExport={() => runtime.setShowExport(true)}
            onOpenPublishDialog={() => runtime.setPublishDialogOpen(true)}
            onCreateNewDraft={() => runtime.createNewDraft()}
            onSaveNow={transport.saveNow}
          />

          <EditorWorkspace
            project={project}
            tracks={state.tracks}
            currentTimeMs={state.currentTimeMs}
            isPlaying={state.isPlaying}
            playbackRate={state.playbackRate}
            durationMs={state.durationMs}
            resolution={state.resolution}
            selectedClipId={state.selectedClipId}
            selectedTransition={clipActions.selectedTransition}
            effectPreview={runtime.effectPreview}
            mediaActiveTab={runtime.mediaActiveTab}
            pendingAdd={runtime.pendingAdd}
            isReadOnly={state.isReadOnly}
            isSyncing={runtime.isSyncing}
            onSetEffectPreview={runtime.setEffectPreview}
            onSetMediaActiveTab={runtime.setMediaActiveTab}
            onClearPendingAdd={() => runtime.setPendingAdd(null)}
            onSyncAssets={runtime.syncAssets}
            onAddClip={clipActions.handleAddClip}
            onUpdateClip={clipActions.handleUpdateClip}
            onAddCaptionClip={store.addCaptionClip}
            onSetTransition={store.setTransition}
            onRemoveTransition={store.removeTransition}
          />

          <EditorTimelineSection
            tracks={state.tracks}
            durationMs={state.durationMs}
            currentTimeMs={state.currentTimeMs}
            zoom={state.zoom}
            selectedClipId={state.selectedClipId}
            selectedTransitionId={
              runtime.selectedTransitionKey
                ? `${runtime.selectedTransitionKey[1]}-${runtime.selectedTransitionKey[2]}`
                : null
            }
            hasClipboard={!!state.clipboardClip}
            onSyncTimeline={() =>
              void runtime.queryClient.invalidateQueries({
                queryKey: queryKeys.api.editorProject(project.id),
              })
            }
            onSeek={store.setCurrentTime}
            onSelectClip={store.selectClip}
            onUpdateClip={clipActions.handleUpdateClip}
            onAddClip={clipActions.handleAddClip}
            onToggleMute={store.toggleTrackMute}
            onToggleLock={store.toggleTrackLock}
            onDeleteAllClipsInTrack={clipActions.handleDeleteAllClipsInTrack}
            onSelectTransition={clipActions.handleSelectTransition}
            onRemoveTransition={store.removeTransition}
            onClipSplit={clipActions.handleClipSplit}
            onClipDuplicate={clipActions.handleClipDuplicate}
            onClipCopy={clipActions.handleClipCopy}
            onClipPaste={clipActions.handleClipPaste}
            onClipToggleEnabled={clipActions.handleClipToggleEnabled}
            onClipRippleDelete={clipActions.handleClipRippleDelete}
            onClipDelete={clipActions.handleRemoveClip}
            onClipSetSpeed={clipActions.handleClipSetSpeed}
            onAddVideoTrack={store.addVideoTrack}
            onRemoveTrack={store.removeTrack}
            onRenameTrack={store.renameTrack}
            onReorderTracks={store.reorderTracks}
            onFocusMediaForTrack={clipActions.handleFocusMediaForTrack}
            timelineContainerRef={runtime.timelineContainerRef}
            timelineScrollRef={runtime.timelineScrollRef}
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

