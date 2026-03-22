import { useRef, useEffect } from "react";
import { Play } from "lucide-react";
import type { CSSProperties } from "react";
import type { Track, Transition } from "../types/editor";
import { useAssetUrlMap } from "../contexts/asset-url-map-context";
import { drawCaptionsOnCanvas } from "../hooks/use-caption-preview";

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

function getTransitionStyle(
  clip: {
    id: string;
    startMs: number;
    durationMs: number;
    scale?: number;
    rotation?: number;
  },
  transitions: Transition[],
  currentTimeMs: number
): CSSProperties {
  const transition = transitions.find((t) => t.clipAId === clip.id);
  if (!transition || transition.type === "none") return {};

  const clipEnd = clip.startMs + clip.durationMs;
  const windowStart = clipEnd - transition.durationMs;
  if (currentTimeMs < windowStart || currentTimeMs > clipEnd) return {};

  const progress = (currentTimeMs - windowStart) / transition.durationMs;

  switch (transition.type) {
    case "fade":
      return { opacity: 1 - progress };
    case "slide-left":
      return {
        transform: `translateX(${-progress * 100}%) scale(${clip.scale ?? 1}) rotate(${clip.rotation ?? 0}deg)`,
      };
    case "slide-up":
      return {
        transform: `translateY(${-progress * 100}%) scale(${clip.scale ?? 1}) rotate(${clip.rotation ?? 0}deg)`,
      };
    default:
      return {};
  }
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
  const captionCanvasRef = useRef<HTMLCanvasElement>(null);
  const assetUrlMap = useAssetUrlMap();

  const [resW, resH] = (resolution || "1080x1920").split("x").map(Number);

  // Video track clips that are currently active at currentTimeMs
  const videoTrack = tracks.find((t) => t.type === "video");
  const activeVideoClips = (videoTrack?.clips ?? []).filter(
    (c) =>
      currentTimeMs >= c.startMs && currentTimeMs < c.startMs + c.durationMs
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

  // Caption canvas rendering — runs on every currentTimeMs change
  useEffect(() => {
    const canvas = captionCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const textTrack = tracks.find((t) => t.type === "text");
    if (!textTrack) return;

    for (const clip of textTrack.clips) {
      if (!clip.captionWords?.length) continue;
      const isActive =
        currentTimeMs >= clip.startMs &&
        currentTimeMs < clip.startMs + clip.durationMs;
      if (!isActive) continue;

      drawCaptionsOnCanvas(
        ctx,
        clip,
        currentTimeMs,
        canvas.width,
        canvas.height
      );
    }
  }, [currentTimeMs, tracks]);

  const hasContent = (videoTrack?.clips.length ?? 0) > 0;
  const timecode = formatHHMMSSFF(currentTimeMs, fps);
  const position = formatMMSS(currentTimeMs);
  const total = formatMMSS(durationMs);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-studio-bg overflow-hidden px-2 py-2 min-w-0">
      <p className="text-[10px] font-semibold text-dim-3 mb-2 tracking-widest uppercase">
        Preview
      </p>

      {/* Preview screen — aspect ratio derived from resolution string */}
      <div
        className="relative w-full"
        style={{
          aspectRatio: `${resW}/${resH}`,
          maxHeight: "calc(100% - 40px)",
        }}
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
              src={assetUrlMap.get(clip.assetId ?? "") ?? ""}
              className="absolute inset-0 w-full h-full object-contain"
              style={{
                ...(() => {
                  const vt = tracks.find((t) => t.type === "video");
                  const transStyle = getTransitionStyle(
                    clip,
                    vt?.transitions ?? [],
                    currentTimeMs
                  );
                  const isActive = activeVideoClips.some(
                    (c) => c.id === clip.id
                  );
                  return {
                    opacity:
                      transStyle.opacity !== undefined
                        ? transStyle.opacity
                        : isActive
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
                    transform:
                      transStyle.transform ??
                      `scale(${clip.scale ?? 1}) translate(${clip.positionX ?? 0}px, ${clip.positionY ?? 0}px) rotate(${clip.rotation ?? 0}deg)`,
                  };
                })(),
              }}
              muted={false}
              playsInline
              preload="auto"
            />
          ))}

          {/* Caption canvas overlay */}
          <canvas
            ref={captionCanvasRef}
            width={1920}
            height={1080}
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: "none" }}
          />

          {/* Empty state */}
          {!hasContent && (
            <div className="flex flex-col items-center gap-2">
              <Play size={32} className="text-white/40" />
              <span className="text-xs text-white/70">
                Add clips to the timeline
              </span>
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
      <div className="w-full flex justify-between mt-1 px-3">
        <span className="text-xs text-dim-3">
          {position} / {total}
        </span>
        <span className="text-xs text-dim-3">
          {resW} × {resH} · {fps} fps
        </span>
      </div>
    </div>
  );
}
