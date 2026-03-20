import { useRef, useEffect } from "react";
import type { Track } from "../types/editor";

interface Props {
  tracks: Track[];
  currentTimeMs: number;
  isPlaying: boolean;
  durationMs: number;
  fps: number;
  resolution: string;
}

function formatHHMMSSFF(ms: number, fps: number): string {
  const totalFrames = Math.floor((ms / 1000) * fps);
  const ff = totalFrames % fps;
  const totalSec = Math.floor(totalFrames / fps);
  const ss = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const mm = totalMin % 60;
  const hh = Math.floor(totalMin / 60);
  return [
    String(hh).padStart(2, "0"),
    String(mm).padStart(2, "0"),
    String(ss).padStart(2, "0"),
    String(ff).padStart(2, "0"),
  ].join(":");
}

function formatMMSS(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PreviewArea({
  tracks,
  currentTimeMs,
  isPlaying,
  durationMs,
  fps,
  resolution,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Video track clips that are currently active at currentTimeMs
  const videoTrack = tracks.find((t) => t.type === "video");
  const activeVideoClips = (videoTrack?.clips ?? []).filter(
    (c) =>
      c.r2Url &&
      currentTimeMs >= c.startMs &&
      currentTimeMs < c.startMs + c.durationMs
  );

  // Sync all video elements to current playhead time
  useEffect(() => {
    for (const clip of videoTrack?.clips ?? []) {
      const el = videoRefs.current.get(clip.id);
      if (!el) continue;

      const isActive =
        currentTimeMs >= clip.startMs &&
        currentTimeMs < clip.startMs + clip.durationMs;

      if (isActive) {
        const targetTime =
          (currentTimeMs - clip.startMs) / 1000 + clip.trimStartMs / 1000;
        if (Math.abs(el.currentTime - targetTime) > 0.1) {
          el.currentTime = targetTime;
        }
        el.playbackRate = clip.speed || 1;
        if (isPlaying && el.paused) el.play().catch(() => {});
        if (!isPlaying && !el.paused) el.pause();
      } else {
        if (!el.paused) el.pause();
      }
    }
  }, [currentTimeMs, isPlaying, videoTrack]);

  const hasContent = (videoTrack?.clips.length ?? 0) > 0;
  const timecode = formatHHMMSSFF(currentTimeMs, fps);
  const position = formatMMSS(currentTimeMs);
  const total = formatMMSS(durationMs);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-studio-bg overflow-hidden px-4 py-3 min-w-0">
      <p className="text-[10px] italic text-dim-3 mb-2 tracking-widest">
        — preview monitor —
      </p>

      {/* 16:9 preview screen */}
      <div
        className="relative w-full max-w-[620px]"
        style={{ aspectRatio: "16/9" }}
      >
        {/* Film-strip edges */}
        <div className="absolute left-0 top-0 h-full w-3 bg-repeating-sprocket pointer-events-none z-10" />
        <div className="absolute right-0 top-0 h-full w-3 bg-repeating-sprocket pointer-events-none z-10" />

        {/* Preview screen */}
        <div
          ref={containerRef}
          className="absolute inset-x-3 inset-y-0 bg-black overflow-hidden flex items-center justify-center"
        >
          {/* Stacked video elements for active clips */}
          {(videoTrack?.clips ?? []).map((clip) => (
            <video
              key={clip.id}
              ref={(el) => {
                if (el) videoRefs.current.set(clip.id, el);
                else videoRefs.current.delete(clip.id);
              }}
              src={clip.r2Url}
              className="absolute inset-0 w-full h-full object-contain"
              style={{
                opacity: activeVideoClips.some((c) => c.id === clip.id)
                  ? (clip.opacity ?? 1)
                  : 0,
                filter:
                  [
                    clip.contrast !== undefined && clip.contrast !== 0
                      ? `contrast(${1 + clip.contrast / 100})`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined,
                transform: `scale(${clip.scale ?? 1}) translate(${clip.positionX ?? 0}px, ${clip.positionY ?? 0}px) rotate(${clip.rotation ?? 0}deg)`,
              }}
              muted={false}
              playsInline
              preload="auto"
            />
          ))}

          {/* Empty state */}
          {!hasContent && (
            <div className="flex flex-col items-center gap-2 text-dim-3">
              <span className="text-4xl opacity-30">▶</span>
              <span className="text-sm italic">Add clips to the timeline</span>
            </div>
          )}

          {/* Timecode overlay */}
          <div className="absolute bottom-2 left-3 font-mono text-xs italic text-white/70 select-none">
            {timecode}
          </div>

          {/* Resolution badge */}
          <div className="absolute top-2 right-3 text-[10px] bg-black/60 text-white/60 px-1.5 py-0.5 rounded">
            {resolution}
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div className="w-full max-w-[620px] flex justify-between mt-1.5 px-3">
        <span className="text-xs text-dim-3">
          {position} / {total}
        </span>
        <span className="text-xs text-dim-3">
          {resolution === "4k"
            ? "3840 × 2160"
            : resolution === "720p"
              ? "1280 × 720"
              : "1920 × 1080"}{" "}
          · {fps} fps
        </span>
      </div>
    </div>
  );
}
