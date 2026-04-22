import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayheadClock } from "../../context/PlayheadClockContext";
import type { PreviewCanvasHandle } from "../preview/PreviewCanvas";
import type { EditProject } from "../../types/editor";
import { LeftPanel } from "../panels/LeftPanel";
import { PreviewArea } from "../preview/PreviewArea";
import { Inspector } from "../inspector/Inspector";
import { CaptionLayer } from "../caption/CaptionLayer";
import type { CaptionLayerHandle } from "../caption/CaptionLayer";
import { useAssetUrlMap } from "../../contexts/asset-url-map-context";
import { usePreviewEngine } from "../../hooks/usePreviewEngine";
import { useEditorDocumentState } from "../../context/EditorDocumentStateContext";
import { useEditorClipCommands } from "../../context/EditorClipCommandsContext";
import { useEditorPlaybackContext } from "../../context/EditorPlaybackContext";
import { useEditorUIContext } from "../../context/EditorUIContext";
import type { CompositorRendererPreference } from "../../engine/CompositorWorker";
import { EDITOR_COMPOSITOR_RENDERER } from "@/shared/utils/config/envUtil";

interface EditorWorkspaceProps {
  project: EditProject;
}

export function EditorWorkspace({ project }: EditorWorkspaceProps) {
  const { tracks, isReadOnly, resolution, durationMs, fps } =
    useEditorDocumentState();
  const { handleAddClip } = useEditorClipCommands();
  const {
    currentTimeMs,
    isPlaying,
    setCurrentTime,
    setPlaying,
  } = useEditorPlaybackContext();
  const {
    effectPreview,
    mediaActiveTab,
    setMediaActiveTab,
    pendingAdd,
    setPendingAdd,
  } = useEditorUIContext();

  const previewRef = useRef<PreviewCanvasHandle>(null);
  const captionLayerRef = useRef<CaptionLayerHandle>(null);
  const captionBitmapQueueRef = useRef<Array<ImageBitmap | null>>([]);
  const [captionBitmapVersion, setCaptionBitmapVersion] = useState(0);
  const [rendererPreference, setRendererPreference] =
    useState<CompositorRendererPreference>(EDITOR_COMPOSITOR_RENDERER);
  const clock = usePlayheadClock();
  const assetUrlMap = useAssetUrlMap();

  const [canvasWidth, canvasHeight] = useMemo(
    () => (resolution || "1080x1920").split("x").map(Number),
    [resolution]
  );

  const getCurrentTimeMs = useCallback(() => clock.getTime(), [clock]);

  const handleCaptionBitmapReady = useCallback((bitmap: ImageBitmap | null) => {
    captionBitmapQueueRef.current.push(bitmap);
    setCaptionBitmapVersion((v) => v + 1);
  }, []);

  const handleRenderPlayheadUpdate = useCallback((ms: number) => {
    captionLayerRef.current?.syncPlayback(ms);
  }, []);

  usePreviewEngine({
    previewRef,
    tracks,
    assetUrlMap,
    currentTimeMs,
    isPlaying,
    durationMs,
    fps,
    canvasWidth: Math.max(1, Math.round(canvasWidth || 1080)),
    canvasHeight: Math.max(1, Math.round(canvasHeight || 1920)),
    effectPreview,
    captionBitmapQueueRef,
    captionBitmapVersion,
    onTimeUpdate: setCurrentTime,
    onRenderPlayheadUpdate: handleRenderPlayheadUpdate,
    onPlaybackEnd: () => setPlaying(false),
  });

  useEffect(
    () => () => {
      for (const bitmap of captionBitmapQueueRef.current) {
        bitmap?.close();
      }
      captionBitmapQueueRef.current = [];
    },
    []
  );

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <LeftPanel
        generatedContentId={project.generatedContentId}
        getCurrentTimeMs={getCurrentTimeMs}
        onAddClip={handleAddClip}
        readOnly={isReadOnly}
        activeTab={mediaActiveTab}
        onTabChange={setMediaActiveTab}
        pendingAdd={pendingAdd}
        onClearPendingAdd={() => setPendingAdd(null)}
      />
      <PreviewArea
        previewRef={previewRef}
        rendererPreference={rendererPreference}
        onRendererPreferenceChange={setRendererPreference}
      />
      <CaptionLayer
        ref={captionLayerRef}
        onBitmapReady={handleCaptionBitmapReady}
      />
      <Inspector />
    </div>
  );
}
