import type { RefObject } from "react";
import type { PreviewCanvasHandle } from "./PreviewCanvas";
import { PreviewCanvas } from "./PreviewCanvas";
import { PreviewTopStrip } from "./PreviewTopStrip";
import { PlaybackBar } from "./PlaybackBar";

interface PreviewAreaProps {
  resolution: string;
  playheadMs: number;
  durationMs: number;
  previewRef: RefObject<PreviewCanvasHandle | null>;
  isPlaying: boolean;
  currentTimeMs: number;
  fps: number;
  onJumpToStart: () => void;
  onRewind: () => void;
  onTogglePlaying: () => void;
  onFastForward: () => void;
  onJumpToEnd: () => void;
  onSetCurrentTime: (ms: number) => void;
}

export function PreviewArea({
  resolution,
  playheadMs,
  durationMs,
  previewRef,
  isPlaying,
  currentTimeMs,
  fps,
  onJumpToStart,
  onRewind,
  onTogglePlaying,
  onFastForward,
  onJumpToEnd,
  onSetCurrentTime,
}: PreviewAreaProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0">
      <PreviewTopStrip resolution={resolution} />
      <PreviewCanvas
        ref={previewRef}
        resolution={resolution}
        playheadMs={playheadMs}
        durationMs={durationMs}
      />
      <PlaybackBar
        isPlaying={isPlaying}
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
        fps={fps}
        onJumpToStart={onJumpToStart}
        onRewind={onRewind}
        onTogglePlaying={onTogglePlaying}
        onFastForward={onFastForward}
        onJumpToEnd={onJumpToEnd}
        onSetCurrentTime={onSetCurrentTime}
      />
    </div>
  );
}
