import { useRef } from "react";
import type { PreviewCanvasHandle } from "../preview/PreviewCanvas";
import type { Clip, EditProject, Track, Transition } from "../../types/editor";
import type { TabKey } from "../panels/MediaPanel";
import { MediaPanel } from "../panels/MediaPanel";
import { PreviewCanvas } from "../preview/PreviewCanvas";
import { Inspector } from "../inspector/Inspector";
import { useEditorContext } from "../../context/EditorContext";
import { useAssetUrlMap } from "../../contexts/asset-url-map-context";
import { usePreviewEngine } from "../../hooks/usePreviewEngine";

interface EditorWorkspaceProps {
  project: EditProject;
  tracks: Track[];
  currentTimeMs: number;
  isPlaying: boolean;
  durationMs: number;
  resolution: string;
  selectedTransition: Transition | null;
  effectPreview: { clipId: string; patch: Partial<Clip> } | null;
  mediaActiveTab: TabKey;
  pendingAdd: { trackId: string; startMs: number } | null;
  isReadOnly: boolean;
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
  isPlaying,
  durationMs,
  resolution,
  selectedTransition,
  effectPreview,
  mediaActiveTab,
  pendingAdd,
  isReadOnly,
  onSetEffectPreview,
  onSetMediaActiveTab,
  onClearPendingAdd,
  onAddClip,
}: EditorWorkspaceProps) {
  const { state, setCurrentTime, setPlaying } = useEditorContext();
  const assetUrlMap = useAssetUrlMap();
  const previewRef = useRef<PreviewCanvasHandle>(null);

  usePreviewEngine({
    previewRef,
    tracks,
    assetUrlMap,
    currentTimeMs,
    isPlaying,
    durationMs,
    effectPreview,
    onTimeUpdate: setCurrentTime,
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
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
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
