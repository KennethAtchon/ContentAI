import type {
  CompositionRecord,
  SaveState,
  Timeline,
} from "../../types/composition.types";
import { EditorHeader } from "./EditorHeader";
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
}: EditorShellProps) {
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
      />
      <div className="grid min-h-0 gap-4 overflow-y-auto p-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <PreviewPanel
            composition={composition}
            onTimelineChange={onTimelineChange}
            selectedVideoClipId={selectedVideoClipId}
            onSelectVideoClip={onSelectVideoClip}
          />
          <QuickToolsPlaceholder
            timeline={composition.timeline}
            onChange={onTimelineChange}
            selectedVideoClipId={selectedVideoClipId}
            selectedTextOverlayId={selectedTextOverlayId}
            onSelectVideoClip={onSelectVideoClip}
            onSelectTextOverlay={onSelectTextOverlay}
          />
        </div>
        <div className="space-y-4">
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
