import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import type { EditProject, Clip } from "../types/editor";
import type { TabKey } from "../components/MediaPanel";
import { useEditorReducer } from "./useEditorStore";
import { useEditorAutosave } from "./useEditorAutosave";
import { useEditorKeyboard } from "./useEditorKeyboard";
import { useEditorProjectPoll } from "./useEditorProjectPoll";
import { useEditorLayoutMutations } from "./useEditorLayoutMutations";
import { useEditorAssetMap } from "./useEditorAssetMap";
import { useEditorClipActions } from "./useEditorClipActions";
import { useEditorTransport } from "./useEditorTransport";

export function useEditorLayoutRuntime(
  project: EditProject,
  onBack: () => void
) {
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
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [mediaActiveTab, setMediaActiveTab] = useState<TabKey>("media");
  const [pendingAdd, setPendingAdd] = useState<{
    trackId: string;
    startMs: number;
  } | null>(null);

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

  const { runPublish, isPublishing, createNewDraft, isCreatingDraft } =
    useEditorLayoutMutations({
      project,
      store,
      queryClient,
      authenticatedFetchJson,
      onBack,
      flushSave,
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
    flushSave,
    editorPublishStateRef,
    removeClip: store.removeClip,
    rippleDeleteClip: store.rippleDeleteClip,
  });

  const transport = useEditorTransport({
    store,
    timelineContainerRef,
    flushSave,
    runPublish,
    saveTimerRef,
    editorPublishStateRef,
    setPublishDialogOpen,
    onBack,
  });

  return {
    state: store.state,
    previewCurrentTimeMs: store.state.currentTimeMs,
    store,
    queryClient,
    showExport,
    setShowExport,
    effectPreview,
    setEffectPreview,
    selectedTransitionKey,
    setSelectedTransitionKey,
    timelineContainerRef,
    timelineScrollRef,
    publishDialogOpen,
    setPublishDialogOpen,
    mediaActiveTab,
    setMediaActiveTab,
    pendingAdd,
    setPendingAdd,
    scriptResetPending,
    onScriptIterationDialogOpenChange,
    confirmScriptIteration,
    assetUrlMap,
    isCapturingThumbnail,
    captureThumbnail,
    lastSavedAt,
    isDirty,
    isSavingPatch,
    isPublishing,
    createNewDraft,
    isCreatingDraft,
    clipActions,
    transport,
  };
}
