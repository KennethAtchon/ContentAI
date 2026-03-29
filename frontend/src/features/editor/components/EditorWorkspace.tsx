import type { Clip, EditProject, Track, Transition } from "../types/editor";
import type { TabKey } from "./MediaPanel";
import { MediaPanel } from "./MediaPanel";
import { PreviewArea } from "./PreviewArea";
import { Inspector } from "./Inspector";
import { useEditorContext } from "../context/EditorContext";

interface EditorWorkspaceProps {
  project: EditProject;
  tracks: Track[];
  currentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
  durationMs: number;
  resolution: string;
  selectedTransition: Transition | null;
  effectPreview: { clipId: string; patch: Partial<Clip> } | null;
  mediaActiveTab: TabKey;
  pendingAdd: { trackId: string; startMs: number } | null;
  isReadOnly: boolean;
  isSyncing: boolean;
  onSetEffectPreview: (value: { clipId: string; patch: Partial<Clip> } | null) => void;
  onSetMediaActiveTab: (tab: TabKey) => void;
  onClearPendingAdd: () => void;
  onSyncAssets: () => void;
  onAddClip: (trackId: string, clip: Clip) => void;
}

export function EditorWorkspace({
  project,
  tracks,
  currentTimeMs,
  isPlaying,
  playbackRate,
  durationMs,
  resolution,
  selectedTransition,
  effectPreview,
  mediaActiveTab,
  pendingAdd,
  isReadOnly,
  isSyncing,
  onSetEffectPreview,
  onSetMediaActiveTab,
  onClearPendingAdd,
  onSyncAssets,
  onAddClip,
}: EditorWorkspaceProps) {
  const { state } = useEditorContext();

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <MediaPanel
        generatedContentId={project.generatedContentId}
        mergedAssetIds={project.mergedAssetIds ?? []}
        currentTimeMs={currentTimeMs}
        onAddClip={onAddClip}
        readOnly={isReadOnly}
        activeTab={mediaActiveTab}
        onTabChange={onSetMediaActiveTab}
        pendingAdd={pendingAdd}
        onClearPendingAdd={onClearPendingAdd}
        onSyncAssets={onSyncAssets}
        isSyncing={isSyncing}
      />

      <PreviewArea
        tracks={tracks}
        currentTimeMs={currentTimeMs}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        durationMs={durationMs}
        resolution={resolution}
        effectPreviewOverride={effectPreview}
      />

      <Inspector
        onEffectPreview={(patch) =>
          onSetEffectPreview(
            patch && state.selectedClipId ? { clipId: state.selectedClipId, patch } : null
          )
        }
        selectedTransition={selectedTransition}
      />
    </div>
  );
}
