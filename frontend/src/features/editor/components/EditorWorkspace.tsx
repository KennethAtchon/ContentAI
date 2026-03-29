import type { Clip, EditProject, Track, Transition } from "../types/editor";
import type { TabKey } from "./MediaPanel";
import { MediaPanel } from "./MediaPanel";
import { PreviewArea } from "./PreviewArea";
import { Inspector } from "./Inspector";

interface EditorWorkspaceProps {
  project: EditProject;
  tracks: Track[];
  currentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
  durationMs: number;
  resolution: string;
  selectedClipId: string | null;
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
  onUpdateClip: (clipId: string, patch: Partial<Clip>) => void;
  onAddCaptionClip: (params: {
    captionId: string;
    captionWords: { word: string; startMs: number; endMs: number }[];
    assetId: string;
    presetId: string;
    startMs: number;
    durationMs: number;
  }) => void;
  onSetTransition: (
    trackId: string,
    clipAId: string,
    clipBId: string,
    transitionType: Transition["type"],
    durationMs: number
  ) => void;
  onRemoveTransition: (trackId: string, transitionId: string) => void;
}

export function EditorWorkspace({
  project,
  tracks,
  currentTimeMs,
  isPlaying,
  playbackRate,
  durationMs,
  resolution,
  selectedClipId,
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
  onUpdateClip,
  onAddCaptionClip,
  onSetTransition,
  onRemoveTransition,
}: EditorWorkspaceProps) {
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
        tracks={tracks}
        selectedClipId={selectedClipId}
        onUpdateClip={onUpdateClip}
        onEffectPreview={(patch) =>
          onSetEffectPreview(
            patch && selectedClipId ? { clipId: selectedClipId, patch } : null
          )
        }
        onAddCaptionClip={onAddCaptionClip}
        selectedTransition={selectedTransition}
        onSetTransition={onSetTransition}
        onRemoveTransition={onRemoveTransition}
      />
    </div>
  );
}
