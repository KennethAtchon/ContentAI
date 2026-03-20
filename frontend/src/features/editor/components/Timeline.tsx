import { useRef } from "react";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineClip } from "./TimelineClip";
import { TrackHeader } from "./TrackHeader";
import { Playhead } from "./Playhead";
import type { Track, Clip } from "../types/editor";

const TRACK_HEIGHT = 56; // px per track
const RULER_HEIGHT = 32; // px

interface Props {
  tracks: Track[];
  durationMs: number;
  currentTimeMs: number;
  zoom: number;
  selectedClipId: string | null;
  onSeek: (ms: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onUpdateClip: (clipId: string, patch: Partial<Clip>) => void;
  onToggleMute: (trackId: string) => void;
  onToggleLock: (trackId: string) => void;
}

export function Timeline({
  tracks,
  durationMs,
  currentTimeMs,
  zoom,
  selectedClipId,
  onSeek,
  onSelectClip,
  onUpdateClip,
  onToggleMute,
  onToggleLock,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalWidthPx = Math.max((durationMs / 1000) * zoom + 200, 800);
  const contentHeight = RULER_HEIGHT + tracks.length * TRACK_HEIGHT;

  return (
    <div
      className="flex flex-row h-full border-t border-overlay-sm bg-studio-surface overflow-hidden"
      onClick={() => onSelectClip(null)}
    >
      {/* Track headers column */}
      <div
        className="flex flex-col shrink-0 border-r border-overlay-sm bg-studio-surface z-10"
        style={{ width: 186 }}
      >
        {/* Ruler spacer */}
        <div className="h-8 border-b border-overlay-sm flex items-center px-3">
          <span className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold">
            Tracks
          </span>
        </div>

        {/* Track headers */}
        {tracks.map((track) => (
          <TrackHeader
            key={track.id}
            track={track}
            onToggleMute={() => onToggleMute(track.id)}
            onToggleLock={() => onToggleLock(track.id)}
          />
        ))}
      </div>

      {/* Scrollable track area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative"
      >
        <div
          style={{
            minWidth: totalWidthPx,
            width: "100%",
            height: contentHeight,
            position: "relative",
          }}
        >
          {/* Ruler */}
          <TimelineRuler durationMs={durationMs} zoom={zoom} onSeek={onSeek} />

          {/* Track lanes */}
          {tracks.map((track, trackIndex) => (
            <div
              key={track.id}
              className="absolute border-b border-dashed border-overlay-sm"
              style={{
                top: RULER_HEIGHT + trackIndex * TRACK_HEIGHT,
                left: 0,
                width: "100%",
                height: TRACK_HEIGHT,
              }}
            >
              {track.clips.map((clip) => (
                <TimelineClip
                  key={clip.id}
                  clip={clip}
                  trackType={track.type}
                  zoom={zoom}
                  isSelected={selectedClipId === clip.id}
                  isLocked={track.locked}
                  onSelect={() => onSelectClip(clip.id)}
                  onMove={(newStartMs) =>
                    onUpdateClip(clip.id, { startMs: newStartMs })
                  }
                  onTrimStart={(newTrimStartMs, newDurationMs) =>
                    onUpdateClip(clip.id, {
                      trimStartMs: newTrimStartMs,
                      startMs:
                        clip.startMs + (newTrimStartMs - clip.trimStartMs),
                      durationMs: newDurationMs,
                    })
                  }
                  onTrimEnd={(newDurationMs) =>
                    onUpdateClip(clip.id, { durationMs: newDurationMs })
                  }
                />
              ))}
            </div>
          ))}

          {/* Playhead */}
          <Playhead
            currentTimeMs={currentTimeMs}
            zoom={zoom}
            height={contentHeight}
            onSeek={onSeek}
          />
        </div>
      </div>
    </div>
  );
}
