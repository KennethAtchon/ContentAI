import { useState } from "react";
import type {
  CompositionMode,
  CompositionRecord,
  SaveState,
  Timeline,
} from "../../types/composition.types";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import type { HistoryViewEntry } from "../../hooks/use-editor-history";
import { insertVideoItemAt, normalizeTimeline } from "../../utils/timeline-utils";
import { EditorHeader } from "./EditorHeader";
import { MediaBinPanel } from "./MediaBinPanel";
import { PreviewPanel } from "./PreviewPanel";
import { QuickToolsPlaceholder } from "./QuickToolsPlaceholder";
import { RenderPanel } from "./RenderPanel";
import { TimelineStrip } from "./TimelineStrip";

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
  editMode: CompositionMode;
  onEditModeChange: (mode: CompositionMode) => void;
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
  editMode,
  onEditModeChange,
}: EditorShellProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const effectiveMode: CompositionMode = isMobile ? "quick" : editMode;

  // Playhead state lifted to EditorShell so both PreviewPanel and TimelineStrip share it
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  const handleAppendVideoClip = (assetId: string, durationMs: number) => {
    const lastVideo =
      composition.timeline.tracks.video[composition.timeline.tracks.video.length - 1];
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

  const handleInsertVideoClip = (
    assetId: string,
    durationMs: number,
    insertAtIndex: number,
  ) => {
    const nextTimeline = insertVideoItemAt(composition.timeline, {
      assetId,
      durationMs,
      insertAtIndex,
    });
    onTimelineChange(nextTimeline);
  };

  return (
    // CapCut-style: header | 3-panel area | full-width timeline
    <div className="h-full grid grid-rows-[48px_1fr_168px] overflow-hidden bg-studio-bg">
      {/* ── Row 1: Header bar ─────────────────────────────── */}
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
        editMode={effectiveMode}
        onEditModeChange={onEditModeChange}
      />

      {/* ── Row 2: Three-panel workspace ───────────────────── */}
      <div className="grid grid-cols-[220px_1fr_280px] min-h-0 overflow-hidden">
        {/* Left: Media library */}
        <div className="border-r border-white/[0.06] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col">
          {isMobile && editMode === "precision" ? (
            <p className="mx-3 mt-3 rounded border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-slate-200/40">
              {t("phase5_editor_mobile_precision_fallback")}
            </p>
          ) : null}
          <MediaBinPanel
            generatedContentId={generatedContentId}
            onAppendVideoClip={handleAppendVideoClip}
            onInsertVideoClip={handleInsertVideoClip}
          />
        </div>

        {/* Center: Video preview — dominant black space */}
        <div className="bg-black/60 overflow-hidden flex items-center justify-center">
          <PreviewPanel
            generatedContentId={generatedContentId}
            composition={composition}
            onTimelineChange={onTimelineChange}
            selectedVideoClipId={selectedVideoClipId}
            selectedTextOverlayId={selectedTextOverlayId}
            onSelectVideoClip={onSelectVideoClip}
            currentTimeMs={currentTimeMs}
            onCurrentTimeChange={setCurrentTimeMs}
          />
        </div>

        {/* Right: Properties + Export */}
        <div className="border-l border-white/[0.06] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col">
          <QuickToolsPlaceholder
            timeline={composition.timeline}
            onChange={onTimelineChange}
            selectedVideoClipId={selectedVideoClipId}
            selectedTextOverlayId={selectedTextOverlayId}
            onSelectVideoClip={onSelectVideoClip}
            onSelectTextOverlay={onSelectTextOverlay}
            editMode={effectiveMode}
          />
          <div className="mt-auto border-t border-white/[0.06]">
            <RenderPanel
              compositionId={composition.compositionId}
              version={composition.version}
              timeline={composition.timeline}
            />
          </div>
        </div>
      </div>

      {/* ── Row 3: Full-width timeline ─────────────────────── */}
      <div className="border-t border-white/[0.06] overflow-hidden">
        <TimelineStrip
          timeline={composition.timeline}
          onChange={onTimelineChange}
          selectedVideoClipId={selectedVideoClipId}
          onSelectVideoClip={onSelectVideoClip}
          currentTimeMs={currentTimeMs}
          onSeekToMs={setCurrentTimeMs}
        />
      </div>
    </div>
  );
}
