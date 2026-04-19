import { useEffect, useRef, useState, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useEditorReducer } from "../../hooks/useEditorStore";
import { useEditorAutosave } from "../../hooks/useEditorAutosave";
import { useEditorKeyboard } from "../../hooks/useEditorKeyboard";
import { useEditorProjectPoll } from "../../hooks/useEditorProjectPoll";
import { useEditorLayoutMutations } from "../../hooks/useEditorLayoutMutations";
import { useEditorAssetMap } from "../../hooks/useEditorAssetMap";
import { useEditorClipActions } from "../../hooks/useEditorClipActions";
import { useEditorTransport } from "../../hooks/useEditorTransport";
import { stripLocallyModifiedFromTracks } from "../../utils/strip-local-editor-fields";
import { AssetUrlMapContext } from "../../contexts/asset-url-map-context";
import { EditorDocumentContext } from "../../context/EditorDocumentContext";
import { EditorPlaybackContext } from "../../context/EditorPlaybackContext";
import { EditorUIContext } from "../../context/EditorUIContext";
import { EditorPersistContext } from "../../context/EditorPersistContext";
import type { EditProject, Clip } from "../../types/editor";
import type { TabKey } from "../panels/LeftPanel";
import type { SaveService } from "../../services/save-service";

interface EditorProvidersProps {
  project: EditProject;
  onBack: () => void;
  children: ReactNode;
}

export function EditorProviders({ project, onBack, children }: EditorProvidersProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const store = useEditorReducer();

  const [showExport, setShowExport] = useState(false);
  const [effectPreview, setEffectPreview] = useState<{
    clipId: string;
    patch: Partial<Clip>;
  } | null>(null);
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<
    [string, string, string] | null
  >(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [mediaActiveTab, setMediaActiveTab] = useState<TabKey>("media");
  const [pendingAdd, setPendingAdd] = useState<{
    trackId: string;
    startMs: number;
  } | null>(null);
  const [playheadMs, setPlayheadMs] = useState(store.state.currentTimeMs);

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlayheadMs(store.state.currentTimeMs);
  }, [store.state.currentTimeMs]);

  const {
    lastSavedAt,
    isDirty,
    isSavingPatch,
    flushSave,
    saveTimerRef,
    editorPublishStateRef,
  } = useEditorAutosave({
    projectId: project.id,
    isReadOnly: store.state.isReadOnly,
    tracks: store.state.tracks,
    durationMs: store.state.durationMs,
    title: store.state.title,
    resolution: store.state.resolution,
    fps: store.state.fps,
  });

  // Stable SaveService created from autosave refs (refs never change identity)
  const saveService = useMemo<SaveService>(
    () => ({
      flushNow: async () => {
        const snap = editorPublishStateRef.current;
        await flushSave({
          tracks: stripLocallyModifiedFromTracks(snap.tracks),
          durationMs: snap.durationMs,
          title: snap.title,
          resolution: snap.resolution,
          fps: snap.fps,
        });
      },
      cancelPending: () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      },
    }),
    // flushSave is stable (useCallback); refs are always the same object
    [flushSave, saveTimerRef, editorPublishStateRef]
  );

  const {
    scriptResetPending,
    onScriptIterationDialogOpenChange,
    confirmScriptIteration,
  } = useEditorProjectPoll({ project, store });

  const { assetUrlMap, isCapturingThumbnail, captureThumbnail } =
    useEditorAssetMap({
      projectId: project.id,
      generatedContentId: project.generatedContentId,
      projectThumbnailUrl: project.thumbnailUrl,
      tracks: store.state.tracks,
      currentTimeMs: store.state.currentTimeMs,
    });

  const { runPublish, isPublishing, createNewDraft, isCreatingDraft } =
    useEditorLayoutMutations({
      project,
      store,
      queryClient,
      authenticatedFetchJson,
      onBack,
      saveService,
    });

  const clipActions = useEditorClipActions({
    store,
    t,
    selectedTransitionKey,
    setSelectedTransitionKey,
    setPendingAdd,
    setMediaActiveTab,
  });

  useEditorKeyboard({
    store,
    saveService,
    removeClip: store.removeClip,
    rippleDeleteClip: store.rippleDeleteClip,
  });

  const transport = useEditorTransport({
    store,
    timelineContainerRef,
    saveService,
    runPublish,
    setPublishDialogOpen,
    onBack,
  });

  const selectedClip = useMemo((): Clip | null => {
    if (!store.state.selectedClipId) return null;
    for (const track of store.state.tracks) {
      const clip = track.clips.find((c) => c.id === store.state.selectedClipId);
      if (clip) return clip;
    }
    return null;
  }, [store.state.selectedClipId, store.state.tracks]);

  const selectedTrack = useMemo(
    () =>
      store.state.selectedClipId
        ? (store.state.tracks.find((tr) =>
            tr.clips.some((c) => c.id === store.state.selectedClipId)
          ) ?? null)
        : null,
    [store.state.selectedClipId, store.state.tracks]
  );

  // EditorDocumentContext — only changes on document/UI state changes, not playback ticks
  const {
    editProjectId,
    title,
    durationMs,
    fps,
    resolution,
    tracks,
    clipboardClip,
    clipboardSourceTrackId,
    past,
    future,
    isReadOnly,
    selectedClipId,
    exportJobId,
    exportStatus,
  } = store.state;

  const documentValue = useMemo(
    () => ({
      editProjectId,
      title,
      durationMs,
      fps,
      resolution,
      tracks,
      clipboardClip,
      clipboardSourceTrackId,
      past,
      future,
      isReadOnly,
      selectedClipId,
      exportJobId,
      exportStatus,
      selectedClip,
      selectedTrack,
      dispatch: store.dispatch,
      loadProject: store.loadProject,
      setTitle: store.setTitle,
      setResolution: store.setResolution,
      setFps: store.setFps,
      selectClip: store.selectClip,
      addClip: store.addClip,
      updateClip: store.updateClip,
      removeClip: store.removeClip,
      rippleDeleteClip: store.rippleDeleteClip,
      toggleClipEnabled: store.toggleClipEnabled,
      copyClip: store.copyClip,
      pasteClip: store.pasteClip,
      splitClip: store.splitClip,
      duplicateClip: store.duplicateClip,
      moveClip: store.moveClip,
      toggleTrackMute: store.toggleTrackMute,
      toggleTrackLock: store.toggleTrackLock,
      undo: store.undo,
      redo: store.redo,
      setExportJob: store.setExportJob,
      setExportStatus: store.setExportStatus,
      setTransition: store.setTransition,
      removeTransition: store.removeTransition,
      reorderShots: store.reorderShots,
      addClipAutoPromote: store.addClipAutoPromote,
      addCaptionClip: store.addCaptionClip,
      updateCaptionStyle: store.updateCaptionStyle,
      addVideoTrack: store.addVideoTrack,
      removeTrack: store.removeTrack,
      renameTrack: store.renameTrack,
      reorderTracks: store.reorderTracks,
      ...clipActions,
      queryClient,
    }),
    // Deliberately excludes playback state (currentTimeMs, isPlaying, zoom, playbackRate)
    // so Timeline and other document subscribers don't re-render at 60fps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      editProjectId, title, durationMs, fps, resolution, tracks,
      clipboardClip, clipboardSourceTrackId, past, future, isReadOnly,
      selectedClipId, exportJobId, exportStatus,
      selectedClip, selectedTrack,
      clipActions, queryClient,
    ]
  );

  const pixelsPerMs = useMemo(
    () => store.state.zoom / 1000,
    [store.state.zoom]
  );

  const playbackValue = useMemo(
    () => ({
      currentTimeMs: store.state.currentTimeMs,
      isPlaying: store.state.isPlaying,
      playbackRate: store.state.playbackRate,
      zoom: store.state.zoom,
      playheadMs,
      pixelsPerMs,
      setCurrentTime: store.setCurrentTime,
      setPlaying: store.setPlaying,
      setPlaybackRate: store.setPlaybackRate,
      setZoom: store.setZoom,
      setPlayheadMs,
      ...transport,
      timelineContainerRef,
      timelineScrollRef,
    }),
    [
      store.state.currentTimeMs, store.state.isPlaying,
      store.state.playbackRate, store.state.zoom,
      playheadMs, pixelsPerMs, transport,
      store.setCurrentTime, store.setPlaying,
      store.setPlaybackRate, store.setZoom,
    ]
  );

  const uiValue = useMemo(
    () => ({
      effectPreview,
      setEffectPreview,
      showExport,
      setShowExport,
      publishDialogOpen,
      setPublishDialogOpen,
      mediaActiveTab,
      setMediaActiveTab,
      pendingAdd,
      setPendingAdd,
      selectedTransitionKey,
      setSelectedTransitionKey,
      scriptResetPending,
      onScriptIterationDialogOpenChange,
      confirmScriptIteration,
      isCapturingThumbnail,
      captureThumbnail,
      isPublishing,
      isCreatingDraft,
      createNewDraft,
    }),
    [
      effectPreview, showExport, publishDialogOpen, mediaActiveTab,
      pendingAdd, selectedTransitionKey,
      scriptResetPending, onScriptIterationDialogOpenChange, confirmScriptIteration,
      isCapturingThumbnail, captureThumbnail,
      isPublishing, isCreatingDraft, createNewDraft,
    ]
  );

  const persistValue = useMemo(
    () => ({ isDirty, isSavingPatch, lastSavedAt, saveService }),
    [isDirty, isSavingPatch, lastSavedAt, saveService]
  );

  return (
    <EditorDocumentContext.Provider value={documentValue}>
      <EditorPlaybackContext.Provider value={playbackValue}>
        <EditorUIContext.Provider value={uiValue}>
          <EditorPersistContext.Provider value={persistValue}>
            <AssetUrlMapContext.Provider value={assetUrlMap}>
              {children}
            </AssetUrlMapContext.Provider>
          </EditorPersistContext.Provider>
        </EditorUIContext.Provider>
      </EditorPlaybackContext.Provider>
    </EditorDocumentContext.Provider>
  );
}
