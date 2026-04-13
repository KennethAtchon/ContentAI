import type { Clip, EditProject, Track, Transition } from "../../types/editor";
import type { TabKey } from "../panels/MediaPanel";
import { MediaPanel } from "../panels/MediaPanel";
import { PreviewCanvas } from "../preview/PreviewCanvas";
import { Inspector } from "../inspector/Inspector";
import { useEditorContext } from "../../context/EditorContext";

interface EditorWorkspaceProps {
  project: EditProject;
  tracks: Track[];
  currentTimeMs: number;
  previewCurrentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
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
  currentTimeMs,
  resolution,
  selectedTransition,
  mediaActiveTab,
  pendingAdd,
  isReadOnly,
  onSetEffectPreview,
  onSetMediaActiveTab,
  onClearPendingAdd,
  onAddClip,
}: EditorWorkspaceProps) {
  const { state } = useEditorContext();

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

      <PreviewCanvas resolution={resolution} />

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
