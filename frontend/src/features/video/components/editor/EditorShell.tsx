import type {
  CompositionRecord,
  SaveState,
  Timeline,
} from "../../types/composition.types";
import type { HistoryViewEntry } from "../../hooks/use-editor-history";
import { normalizeTimeline } from "../../utils/timeline-utils";
import { EditorHeader } from "./EditorHeader";
import { MediaBinPanel } from "./MediaBinPanel";
import { PreviewPanel } from "./PreviewPanel";
import { QuickToolsPlaceholder } from "./QuickToolsPlaceholder";
import { RenderPanel } from "./RenderPanel";

export type EditorShellProps = {
  generatedContentId: number;
  composition: CompositionRecord;
  saveState: SaveState;
  saveError: string | null;
  onTimelineChange: (nextTimeline: Timeline) => void;
  selectedVideoClipId: string | null;
  selectedTextOverlayId: string | null;
  onSelectVideoClip: (clipId: string) => void;
  onSelectTextOverlay: (overlayId: string | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  lastActionLabel: string | null;
  nextUndoLabel: string | null;
  nextRedoLabel: string | null;
  historyTrail: HistoryViewEntry[];
};

export function EditorShell({
  generatedContentId,
  composition,
  saveState,
  saveError,
  onTimelineChange,
  selectedVideoClipId,
  selectedTextOverlayId,
  onSelectVideoClip,
  onSelectTextOverlay,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  lastActionLabel,
  nextUndoLabel,
  nextRedoLabel,
  historyTrail,
}: EditorShellProps) {
  const handleAppendVideoClip = (assetId: string, durationMs: number) => {
    const lastVideo = composition.timeline.tracks.video[composition.timeline.tracks.video.length - 1];
    const startMs = lastVideo ? lastVideo.endMs : 0;
    const clipDuration = Math.max(500, durationMs);
    const nextTimeline = normalizeTimeline({
      ...composition.timeline,
      tracks: {
        ...composition.timeline.tracks,
        video: [
          ...composition.timeline.tracks.video,
          {
            id: `clip-${Date.now()}`,
            assetId,
            lane: 0,
            startMs,
            endMs: startMs + clipDuration,
          },
        ],
      },
    });
    onTimelineChange(nextTimeline);
  };

  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      <EditorHeader
        generatedContentId={generatedContentId}
        composition={composition}
        saveState={saveState}
        saveError={saveError}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        lastActionLabel={lastActionLabel}
        nextUndoLabel={nextUndoLabel}
        nextRedoLabel={nextRedoLabel}
        historyTrail={historyTrail}
      />
      <div className="grid min-h-0 gap-4 overflow-y-auto p-4 lg:grid-cols-[280px_1.5fr_1fr]">
        <div className="space-y-4">
          <MediaBinPanel
            generatedContentId={generatedContentId}
            onAppendVideoClip={handleAppendVideoClip}
          />
        </div>
        <div className="space-y-4">
          <PreviewPanel
            generatedContentId={generatedContentId}
            composition={composition}
            onTimelineChange={onTimelineChange}
            selectedVideoClipId={selectedVideoClipId}
            onSelectVideoClip={onSelectVideoClip}
          />
        </div>
        <div className="space-y-4">
          <QuickToolsPlaceholder
            timeline={composition.timeline}
            onChange={onTimelineChange}
            selectedVideoClipId={selectedVideoClipId}
            selectedTextOverlayId={selectedTextOverlayId}
            onSelectVideoClip={onSelectVideoClip}
            onSelectTextOverlay={onSelectTextOverlay}
          />
          <RenderPanel
            compositionId={composition.compositionId}
            version={composition.version}
            timeline={composition.timeline}
          />
        </div>
      </div>
    </div>
  );
}
