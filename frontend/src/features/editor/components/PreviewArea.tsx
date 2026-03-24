import { useRef, useEffect } from "react";
import { Play } from "lucide-react";
import type { CSSProperties } from "react";
import type { Clip, Track, Transition } from "../types/editor";
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

/** Style for the outgoing clip (clipA) during a transition. */
function getOutgoingTransitionStyle(
  clip: Clip,
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
    case "dissolve":
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

/**
 * Style for the incoming clip (clipB) during dissolve/wipe-right.
 * Returns null if the clip is not in an incoming transition window.
 */
function getIncomingTransitionStyle(
  clip: Clip,
  transitions: Transition[],
  allClips: Clip[],
  currentTimeMs: number
): CSSProperties | null {
  const transition = transitions.find((t) => t.clipBId === clip.id);
  if (!transition || (transition.type !== "dissolve" && transition.type !== "wipe-right")) {
    return null;
  }

  const clipA = allClips.find((c) => c.id === transition.clipAId);
  if (!clipA) return null;

  const clipAEnd = clipA.startMs + clipA.durationMs;
  const windowStart = clipAEnd - transition.durationMs;
  if (currentTimeMs < windowStart || currentTimeMs > clipAEnd) return null;

  const progress = (currentTimeMs - windowStart) / transition.durationMs;

  if (transition.type === "dissolve") {
    return { opacity: progress };
  }
  // wipe-right: reveal from left to right
  return { clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`, opacity: 1 };
}

/** Improved warmth filter using hue-rotate instead of sepia. */
function buildWarmthFilter(warmth: number): string {
  if (warmth === 0) return "";
  // Positive = warm (shift hue towards orange), negative = cool (shift towards blue)
  const deg = -(warmth * 0.3);
  const sat = 1 + warmth * 0.005;
  return `hue-rotate(${deg}deg) saturate(${sat})`;
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
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const captionCanvasRef = useRef<HTMLCanvasElement>(null);
  const assetUrlMap = useAssetUrlMap();

  const [resW, resH] = (resolution || "1080x1920").split("x").map(Number);

  const videoTrack = tracks.find((t) => t.type === "video");
  const audioTrack = tracks.find((t) => t.type === "audio");
  const musicTrack = tracks.find((t) => t.type === "music");
  const textTrack = tracks.find((t) => t.type === "text");

  // Combined audio clips with their parent tracks for mute propagation
  const audioClips = [
    ...(audioTrack?.clips ?? []).map((c) => ({ clip: c, track: audioTrack! })),
    ...(musicTrack?.clips ?? []).map((c) => ({ clip: c, track: musicTrack! })),
  ];

  const videoClips = videoTrack?.clips ?? [];
  const videoTransitions = videoTrack?.transitions ?? [];

  // Active video clips at the current playhead position
  const activeVideoClipIds = new Set(
    videoClips
      .filter(
        (c) =>
          c.enabled !== false &&
          currentTimeMs >= c.startMs &&
          currentTimeMs < c.startMs + c.durationMs
      )
      .map((c) => c.id)
  );

  // Text clips active at current time
  const activeTextClips = (textTrack?.clips ?? []).filter(
    (c) =>
      c.enabled !== false &&
      currentTimeMs >= c.startMs &&
      currentTimeMs < c.startMs + c.durationMs
  );

  // Sync all video elements to current playhead position
  useEffect(() => {
    for (const clip of videoClips) {
      const el = videoRefs.current.get(clip.id);
      if (!el) continue;

      // Mute if the whole track is muted
      el.muted = videoTrack?.muted ?? false;

      const isActive = activeVideoClipIds.has(clip.id);

      // Check for incoming dissolve/wipe-right pre-render window
      const incomingTransition = videoTransitions.find(
        (t) => t.clipBId === clip.id && (t.type === "dissolve" || t.type === "wipe-right")
      );
      let isIncomingWindow = false;
      if (incomingTransition) {
        const clipA = videoClips.find((c) => c.id === incomingTransition.clipAId);
        if (clipA) {
          const clipAEnd = clipA.startMs + clipA.durationMs;
          const windowStart = clipAEnd - incomingTransition.durationMs;
          isIncomingWindow = currentTimeMs >= windowStart && currentTimeMs < clipAEnd;
        }
      }

      if (isActive) {
        const targetTime =
          (currentTimeMs - clip.startMs) / 1000 + clip.trimStartMs / 1000;
        if (Math.abs(el.currentTime - targetTime) > 0.1) {
          el.currentTime = targetTime;
        }
        el.playbackRate = clip.speed || 1;
        if (isPlaying && el.paused) el.play().catch(() => {});
        if (!isPlaying && !el.paused) el.pause();
      } else if (isIncomingWindow) {
        // Pre-render incoming clip during dissolve/wipe: start from trimStart
        const targetTime = clip.trimStartMs / 1000;
        if (Math.abs(el.currentTime - targetTime) > 0.15) {
          el.currentTime = targetTime;
        }
        el.playbackRate = clip.speed || 1;
        if (isPlaying && el.paused) el.play().catch(() => {});
        if (!isPlaying && !el.paused) el.pause();
      } else {
        if (!el.paused) el.pause();
      }
    }
  }, [currentTimeMs, isPlaying, videoTrack, videoClips, videoTransitions, activeVideoClipIds]);

  // Sync all audio elements (voiceover + music) to current playhead position
  useEffect(() => {
    for (const { clip, track } of audioClips) {
      const el = audioRefs.current.get(clip.id);
      if (!el) continue;

      const isActive =
        currentTimeMs >= clip.startMs &&
        currentTimeMs < clip.startMs + clip.durationMs;

      if (isActive) {
        const targetTime =
          (currentTimeMs - clip.startMs) / 1000 + (clip.trimStartMs ?? 0) / 1000;
        if (Math.abs(el.currentTime - targetTime) > 0.1) {
          el.currentTime = targetTime;
        }
        el.playbackRate = clip.speed || 1;
        el.volume = Math.min(1, Math.max(0, clip.volume ?? 1));
        // Mute if clip is muted OR the parent track is muted
        el.muted = (clip.muted ?? false) || track.muted;
        if (isPlaying && el.paused) el.play().catch(() => {});
        if (!isPlaying && !el.paused) el.pause();
      } else {
        if (!el.paused) el.pause();
      }
    }
  }, [currentTimeMs, isPlaying, audioClips]);

  // Caption canvas rendering — redraws on every currentTimeMs change
  useEffect(() => {
    const canvas = captionCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
  }, [currentTimeMs, tracks, textTrack]);

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
          {/* Stacked video elements — all rendered for preload, visibility via opacity */}
          {videoClips.map((clip) => {
            const isActive = activeVideoClipIds.has(clip.id);
            const isDisabled = clip.enabled === false;

            const outgoing = getOutgoingTransitionStyle(clip, videoTransitions, currentTimeMs);
            const incoming = getIncomingTransitionStyle(clip, videoTransitions, videoClips, currentTimeMs);

            // Determine final opacity
            let opacity: number;
            if (isDisabled) {
              opacity = 0;
            } else if (outgoing.opacity !== undefined) {
              opacity = outgoing.opacity as number;
            } else if (incoming?.opacity !== undefined) {
              opacity = incoming.opacity as number;
            } else {
              opacity = isActive ? (clip.opacity ?? 1) : 0;
            }

            const clipPath = incoming?.clipPath as string | undefined;

            const transform =
              (outgoing.transform as string | undefined) ??
              `scale(${clip.scale ?? 1}) translate(${clip.positionX ?? 0}px, ${clip.positionY ?? 0}px) rotate(${clip.rotation ?? 0}deg)`;

            const filterParts: string[] = [];
            if (clip.contrast !== undefined && clip.contrast !== 0) {
              filterParts.push(`contrast(${1 + clip.contrast / 100})`);
            }
            if (clip.warmth !== undefined && clip.warmth !== 0) {
              filterParts.push(buildWarmthFilter(clip.warmth));
            }

            return (
              <video
                key={clip.id}
                ref={(el) => {
                  if (el) videoRefs.current.set(clip.id, el);
                  else videoRefs.current.delete(clip.id);
                }}
                src={assetUrlMap.get(clip.assetId ?? "") ?? ""}
                className="absolute inset-0 w-full h-full object-contain"
                style={{
                  opacity,
                  clipPath,
                  filter: filterParts.join(" ") || undefined,
                  transform,
                }}
                playsInline
                preload="auto"
              />
            );
          })}

          {/* Hidden audio elements for voiceover + music tracks */}
          {audioClips.map(({ clip }) => (
            <audio
              key={clip.id}
              ref={(el) => {
                if (el) audioRefs.current.set(clip.id, el);
                else audioRefs.current.delete(clip.id);
              }}
              src={assetUrlMap.get(clip.assetId ?? "") ?? ""}
              preload="auto"
            />
          ))}

          {/* Text clip overlays — rendered as DOM elements for correct CSS scaling */}
          {activeTextClips.map((clip) => {
            if (!clip.textContent) return null;
            return (
              <div
                key={clip.id}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(calc(-50% + ${clip.positionX ?? 0}px), calc(-50% + ${clip.positionY ?? 0}px)) scale(${clip.scale ?? 1}) rotate(${clip.rotation ?? 0}deg)`,
                  fontSize: clip.textStyle?.fontSize ?? 32,
                  fontWeight: clip.textStyle?.fontWeight ?? "normal",
                  color: clip.textStyle?.color ?? "#fff",
                  textAlign: clip.textStyle?.align ?? "center",
                  opacity: clip.opacity ?? 1,
                  pointerEvents: "none",
                  userSelect: "none",
                  textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                  whiteSpace: "pre-wrap",
                  maxWidth: "80%",
                  zIndex: 10,
                  lineHeight: 1.2,
                }}
              >
                {clip.textContent}
              </div>
            );
          })}

          {/* Caption canvas overlay — dimensions match resolution for correct positioning */}
          <canvas
            ref={captionCanvasRef}
            width={resW}
            height={resH}
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: "none", zIndex: 11 }}
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
