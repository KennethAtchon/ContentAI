import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PreviewCanvasHandle } from "../preview/PreviewCanvas";
import type {
  CaptionClip,
  Clip,
  EditProject,
  Track,
  Transition,
} from "../../types/editor";
import type { TabKey } from "../panels/MediaPanel";
import { MediaPanel } from "../panels/MediaPanel";
import { PreviewCanvas } from "../preview/PreviewCanvas";
import { Inspector } from "../inspector/Inspector";
import { useEditorContext } from "../../context/EditorContext";
import { useAssetUrlMap } from "../../contexts/asset-url-map-context";
import { usePreviewEngine } from "../../hooks/usePreviewEngine";
import { useCaptionCanvas } from "../../caption/hooks/useCaptionCanvas";
import { useCaptionDoc } from "../../caption/hooks/useCaptionDoc";
import { useCaptionPresets } from "../../caption/hooks/useCaptionPresets";
import { applyCaptionStyleOverrides } from "../../caption/apply-style-overrides";
import { isCaptionClip } from "../../utils/clip-types";
import { isClipActiveAtTimelineTime } from "../../utils/editor-composition";

interface EditorWorkspaceProps {
  project: EditProject;
  tracks: Track[];
  currentTimeMs: number;
  playheadMs: number;
  isPlaying: boolean;
  durationMs: number;
  fps: number;
  resolution: string;
  selectedTransition: Transition | null;
  effectPreview: { clipId: string; patch: Partial<Clip> } | null;
  mediaActiveTab: TabKey;
  pendingAdd: { trackId: string; startMs: number } | null;
  isReadOnly: boolean;
  onPlayheadChange: (ms: number) => void;
  onSetEffectPreview: (
    value: { clipId: string; patch: Partial<Clip> } | null
  ) => void;
  onSetMediaActiveTab: (tab: TabKey) => void;
  onClearPendingAdd: () => void;
  onAddClip: (trackId: string, clip: Clip) => void;
}

export function EditorWorkspace({
  project,
  tracks,
  currentTimeMs,
  playheadMs,
  isPlaying,
  durationMs,
  fps,
  resolution,
  selectedTransition,
  effectPreview,
  mediaActiveTab,
  pendingAdd,
  isReadOnly,
  onPlayheadChange,
  onSetEffectPreview,
  onSetMediaActiveTab,
  onClearPendingAdd,
  onAddClip,
}: EditorWorkspaceProps) {
  const { state, setCurrentTime, setPlaying } = useEditorContext();
  const assetUrlMap = useAssetUrlMap();
  const previewRef = useRef<PreviewCanvasHandle>(null);
  const captionBitmapRef = useRef<ImageBitmap | null>(null);
  const activeCaptionClipIdRef = useRef<string | null>(null);
  const [captionBitmapVersion, setCaptionBitmapVersion] = useState(0);
  const [canvasWidth, canvasHeight] = useMemo(
    () => (resolution || "1080x1920").split("x").map(Number),
    [resolution]
  );
  const [activeCaptionClipId, setActiveCaptionClipId] = useState<string | null>(
    null
  );

  const textTrack = useMemo(
    () => tracks.find((track) => track.type === "text"),
    [tracks]
  );
  const captionClips = useMemo(
    () => (textTrack?.clips ?? []).filter(isCaptionClip),
    [textTrack?.clips]
  );
  const getActiveCaptionClipAt = useCallback(
    (timelineMs: number): CaptionClip | null => {
      const activeClips = captionClips.filter((clip) =>
        isClipActiveAtTimelineTime(clip, timelineMs)
      );
      return activeClips[activeClips.length - 1] ?? null;
    },
    [captionClips]
  );
  const activeCaptionClip = useMemo(
    () => captionClips.find((clip) => clip.id === activeCaptionClipId) ?? null,
    [activeCaptionClipId, captionClips]
  );
  const { data: captionPresets } = useCaptionPresets();
  const { data: activeCaptionDoc } = useCaptionDoc(
    activeCaptionClip?.captionDocId ?? null
  );
  const activeCaptionPreset = useMemo(() => {
    const preset = captionPresets?.find(
      (item) => item.id === activeCaptionClip?.stylePresetId
    );
    if (!preset || !activeCaptionClip) return null;
    return applyCaptionStyleOverrides(preset, activeCaptionClip.styleOverrides);
  }, [captionPresets, activeCaptionClip]);
  const handleCaptionBitmapReady = useCallback((bitmap: ImageBitmap | null) => {
    if (captionBitmapRef.current) {
      captionBitmapRef.current.close();
    }
    captionBitmapRef.current = bitmap;
    setCaptionBitmapVersion((version) => version + 1);
  }, []);
  const { canvasRef: captionCanvasRef, renderAtTime: renderCaptionAtTime } =
    useCaptionCanvas({
      clip: activeCaptionClip,
      doc: activeCaptionDoc ?? null,
      preset: activeCaptionPreset,
      canvasW: Math.max(1, Math.round(canvasWidth || 1080)),
      canvasH: Math.max(1, Math.round(canvasHeight || 1920)),
      onBitmapReady: handleCaptionBitmapReady,
    });

  useEffect(() => {
    activeCaptionClipIdRef.current = activeCaptionClipId;
  }, [activeCaptionClipId]);

  useEffect(() => {
    const nextClipId = getActiveCaptionClipAt(playheadMs)?.id ?? null;
    activeCaptionClipIdRef.current = nextClipId;
    setActiveCaptionClipId(nextClipId);
    renderCaptionAtTime(playheadMs);
  }, [getActiveCaptionClipAt, playheadMs, renderCaptionAtTime]);

  const handleRenderPlayheadUpdate = useCallback(
    (timelineMs: number) => {
      const nextClipId = getActiveCaptionClipAt(timelineMs)?.id ?? null;
      if (nextClipId !== activeCaptionClipIdRef.current) {
        activeCaptionClipIdRef.current = nextClipId;
        setActiveCaptionClipId(nextClipId);
        return;
      }

      renderCaptionAtTime(timelineMs);
    },
    [getActiveCaptionClipAt, renderCaptionAtTime]
  );

  useEffect(
    () => () => {
      if (captionBitmapRef.current) {
        captionBitmapRef.current.close();
        captionBitmapRef.current = null;
      }
    },
    []
  );

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
    captionBitmapRef,
    captionBitmapVersion,
    onTimeUpdate: setCurrentTime,
    onPlayheadUpdate: onPlayheadChange,
    onRenderPlayheadUpdate: handleRenderPlayheadUpdate,
    onPlaybackEnd: () => setPlaying(false),
  });

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <MediaPanel
        generatedContentId={project.generatedContentId}
        currentTimeMs={currentTimeMs}
        onAddClip={onAddClip}
        readOnly={isReadOnly}
        activeTab={mediaActiveTab}
        onTabChange={onSetMediaActiveTab}
        pendingAdd={pendingAdd}
        onClearPendingAdd={onClearPendingAdd}
      />

      <PreviewCanvas
        ref={previewRef}
        resolution={resolution}
        playheadMs={playheadMs}
        durationMs={durationMs}
      />
      <canvas
        ref={captionCanvasRef}
        width={Math.max(1, Math.round(canvasWidth || 1080))}
        height={Math.max(1, Math.round(canvasHeight || 1920))}
        className="hidden"
        aria-hidden="true"
      />

      <Inspector
        onEffectPreview={(patch) =>
          onSetEffectPreview(
            patch && state.selectedClipId
              ? { clipId: state.selectedClipId, patch }
              : null
          )
        }
        selectedTransition={selectedTransition}
      />
    </div>
  );
}
