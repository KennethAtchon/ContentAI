import { useRef, useState } from "react";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineClip } from "./TimelineClip";
import { TrackHeader } from "./TrackHeader";
import { Playhead } from "./Playhead";
import type { Track, Clip, TrackType } from "../types/editor";
import { TransitionDiamond } from "./TransitionDiamond";

const TRACK_HEIGHT = 56; // px per track
const RULER_HEIGHT = 32; // px

const ASSET_TYPE_TO_TRACK: Record<string, TrackType> = {
  video_clip: "video",
  assembled_video: "video",
  image: "video",
  voiceover: "audio",
  music: "music",
};

interface Props {
  tracks: Track[];
  durationMs: number;
  currentTimeMs: number;
  zoom: number;
  selectedClipId: string | null;
  onSeek: (ms: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onUpdateClip: (clipId: string, patch: Partial<Clip>) => void;
  onAddClip: (trackId: string, clip: Clip) => void;
  onToggleMute: (trackId: string) => void;
  onToggleLock: (trackId: string) => void;
  selectedTransitionId: string | null;
  onSelectTransition: (trackId: string, clipAId: string, clipBId: string) => void;
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
  onAddClip,
  onToggleMute,
  onToggleLock,
  selectedTransitionId: _selectedTransitionId,
  onSelectTransition,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dropTargetTrackId, setDropTargetTrackId] = useState<string | null>(null);

  const totalWidthPx = Math.max((durationMs / 1000) * zoom + 4000, 4000);
  const contentHeight = RULER_HEIGHT + tracks.length * TRACK_HEIGHT;

  const handleDragOver = (e: React.DragEvent, track: Track) => {
    if (!e.dataTransfer.types.includes("application/x-contentai-asset")) return;
    if (track.locked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropTargetTrackId(track.id);
  };

  const handleDragLeave = () => {
    setDropTargetTrackId(null);
  };

  const handleDrop = (e: React.DragEvent, track: Track) => {
    setDropTargetTrackId(null);
    if (!e.dataTransfer.types.includes("application/x-contentai-asset")) return;
    if (track.locked) return;
    e.preventDefault();

    const raw = e.dataTransfer.getData("application/x-contentai-asset");
    if (!raw) return;

    let asset: { assetId: string; type: string; durationMs: number | null; label: string };
    try {
      asset = JSON.parse(raw);
    } catch {
      return;
    }

    // Validate asset type matches track type
    const expectedTrack = ASSET_TYPE_TO_TRACK[asset.type];
    if (expectedTrack && expectedTrack !== track.type) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
    const startMs = Math.max(
      0,
      ((e.clientX - rect.left + scrollLeft) / zoom) * 1000,
    );

    const clip: Clip = {
      id: crypto.randomUUID(),
      assetId: asset.assetId,
      label: asset.label,
      startMs,
      durationMs: asset.durationMs ?? 5000,
      trimStartMs: 0,
      trimEndMs: 0,
      speed: 1,
      opacity: 1,
      warmth: 0,
      contrast: 0,
      positionX: 0,
      positionY: 0,
      scale: 1,
      rotation: 0,
      volume: track.type === "music" ? 0.3 : 1,
      muted: false,
    };

    onAddClip(track.id, clip);
  };

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
        <div className="h-8 border-b border-overlay-sm flex items-center px-3">
          <span className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold">
            Tracks
          </span>
        </div>
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
            width: totalWidthPx,
            height: contentHeight,
            position: "relative",
          }}
        >
          <TimelineRuler totalWidthPx={totalWidthPx} zoom={zoom} onSeek={onSeek} />

          {tracks.map((track, trackIndex) => (
            <div
              key={track.id}
              className="absolute border-b border-dashed border-overlay-sm transition-colors"
              style={{
                top: RULER_HEIGHT + trackIndex * TRACK_HEIGHT,
                left: 0,
                width: totalWidthPx,
                height: TRACK_HEIGHT,
                backgroundColor:
                  dropTargetTrackId === track.id
                    ? "rgba(139,92,246,0.08)"
                    : undefined,
              }}
              onDragOver={(e) => handleDragOver(e, track)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, track)}
            >
              {track.clips.map((clip) => (
                <TimelineClip
                  key={clip.id}
                  clip={clip}
                  trackType={track.type}
                  zoom={zoom}
                  isSelected={selectedClipId === clip.id}
                  isLocked={track.locked}
                  tracks={tracks}
                  playheadMs={currentTimeMs}
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
              {track.type === "video" &&
                track.clips.slice(0, -1).map((clipA, idx) => {
                  const clipB = track.clips[idx + 1];
                  const transition = (track.transitions ?? []).find(
                    (t) => t.clipAId === clipA.id && t.clipBId === clipB.id,
                  );
                  return (
                    <TransitionDiamond
                      key={`td-${clipA.id}-${clipB.id}`}
                      clipA={clipA}
                      clipB={clipB}
                      transition={transition}
                      zoom={zoom}
                      onSelect={() => onSelectTransition(track.id, clipA.id, clipB.id)}
                    />
                  );
                })}
            </div>
          ))}

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
