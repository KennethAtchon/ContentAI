import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import type { CSSProperties } from "react";
import type { Clip, Track, Transition } from "../types/editor";
import { useAssetUrlMap } from "../contexts/asset-url-map-context";
import { drawCaptionsOnCanvas } from "../hooks/use-caption-preview";
import { formatHHMMSSFF, formatMMSS } from "../utils/timecode";
import { splitTextIntoSegments, getActiveSegment } from "../utils/text-segments";

interface Props {
  tracks: Track[];
  currentTimeMs: number;
  isPlaying: boolean;
  durationMs: number;
  fps: number;
  resolution: string;
  /** Temporary per-clip property override for effect hover preview. Not committed to state. */
  effectPreviewOverride?: { clipId: string; patch: Partial<Clip> } | null;
}

const PRELOAD_WINDOW_MS = 45_000;

function videoClipNeedsHeavyPreload(
  clip: Clip,
  currentTimeMs: number,
  videoTransitions: Transition[],
  videoClips: Clip[],
  activeIds: Set<string>,
): boolean {
  if (activeIds.has(clip.id)) return true;
  const incomingTransition = videoTransitions.find(
    (tr) =>
      tr.clipBId === clip.id &&
      (tr.type === "dissolve" || tr.type === "wipe-right"),
  );
  if (incomingTransition) {
    const clipA = videoClips.find((c) => c.id === incomingTransition.clipAId);
    if (clipA) {
      const clipAEnd = clipA.startMs + clipA.durationMs;
      const windowStart = clipAEnd - incomingTransition.durationMs;
      if (currentTimeMs >= windowStart && currentTimeMs < clipAEnd) return true;
    }
  }
  const end = clip.startMs + clip.durationMs;
  return (
    currentTimeMs >= clip.startMs - PRELOAD_WINDOW_MS &&
    currentTimeMs <= end + PRELOAD_WINDOW_MS
  );
}

function audioClipNeedsHeavyPreload(clip: Clip, currentTimeMs: number): boolean {
  const end = clip.startMs + clip.durationMs;
  if (currentTimeMs >= clip.startMs && currentTimeMs < end) return true;
  return (
    currentTimeMs >= clip.startMs - PRELOAD_WINDOW_MS &&
    currentTimeMs <= end + PRELOAD_WINDOW_MS
  );
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
  effectPreviewOverride,
}: Props) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const captionCanvasRef = useRef<HTMLCanvasElement>(null);
  const assetUrlMap = useAssetUrlMap();

  const [resW, resH] = (resolution || "1080x1920").split("x").map(Number);

  const videoTracks = tracks.filter((t) => t.type === "video");
  const audioTrack = tracks.find((t) => t.type === "audio");
  const musicTrack = tracks.find((t) => t.type === "music");
  const textTrack = tracks.find((t) => t.type === "text");

  // Combined audio clips with their parent tracks for mute propagation
  const audioClips = [
    ...(audioTrack?.clips ?? []).map((c) => ({ clip: c, track: audioTrack! })),
    ...(musicTrack?.clips ?? []).map((c) => ({ clip: c, track: musicTrack! })),
  ];

  // Per-track active clip ID sets (needed by useEffect sync + render)
  const activeVideoClipIdsByTrack = new Map(
    videoTracks.map((vt) => [
      vt.id,
      new Set(
        vt.clips
          .filter(
            (c) =>
              c.enabled !== false &&
              currentTimeMs >= c.startMs &&
              currentTimeMs < c.startMs + c.durationMs
          )
          .map((c) => c.id)
      ),
    ])
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
    for (const videoTrack of videoTracks) {
      const trackTransitions = videoTrack.transitions ?? [];
      const trackClips = videoTrack.clips;
      const activeIds = activeVideoClipIdsByTrack.get(videoTrack.id) ?? new Set();

      for (const clip of trackClips) {
        const el = videoRefs.current.get(clip.id);
        if (!el) continue;

        el.muted = videoTrack.muted;

        const isActive = activeIds.has(clip.id);

        // Check for incoming dissolve/wipe-right pre-render window
        const incomingTransition = trackTransitions.find(
          (t) => t.clipBId === clip.id && (t.type === "dissolve" || t.type === "wipe-right")
        );
        let isIncomingWindow = false;
        if (incomingTransition) {
          const clipA = trackClips.find((c) => c.id === incomingTransition.clipAId);
          if (clipA) {
            const clipAEnd = clipA.startMs + clipA.durationMs;
            const windowStart = clipAEnd - incomingTransition.durationMs;
            isIncomingWindow = currentTimeMs >= windowStart && currentTimeMs < clipAEnd;
          }
        }

        if (isActive) {
          // Multiply timeline offset by clip.speed so the source position stays
          // in sync with the playhead when speed != 1 (e.g. 2× plays 2s of source
          // per 1s of timeline, so at timeline+5s we need source frame at 10s).
          const targetTime =
            ((currentTimeMs - clip.startMs) / 1000) * (clip.speed || 1) +
            clip.trimStartMs / 1000;
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
    }
  }, [currentTimeMs, isPlaying, videoTracks, activeVideoClipIdsByTrack]);

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
          ((currentTimeMs - clip.startMs) / 1000) * (clip.speed || 1) +
          (clip.trimStartMs ?? 0) / 1000;
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

  const hasContent = videoTracks.some((vt) => vt.clips.length > 0);
  const timecode = formatHHMMSSFF(currentTimeMs, fps);
  const position = formatMMSS(currentTimeMs);
  const total = formatMMSS(durationMs);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-studio-bg overflow-hidden px-2 py-2 min-w-0">
      <p className="text-[10px] font-semibold text-dim-3 mb-2 tracking-widest uppercase">
        {t("editor_preview_label")}
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
          {/* Layered video tracks — Track 0 at bottom, Track N at top */}
          {videoTracks.map((videoTrack, trackIdx) => {
            const trackClips = videoTrack.clips;
            const trackTransitions = videoTrack.transitions ?? [];
            const activeIds = activeVideoClipIdsByTrack.get(videoTrack.id) ?? new Set();

            return (
              <div
                key={videoTrack.id}
                className="absolute inset-0"
                style={{ zIndex: videoTracks.length - 1 - trackIdx }}
              >
                {trackClips.map((clip) => {
                  const isActive = activeIds.has(clip.id);
                  const heavyPreload = videoClipNeedsHeavyPreload(
                    clip,
                    currentTimeMs,
                    trackTransitions,
                    trackClips,
                    activeIds,
                  );
                  const isDisabled = clip.enabled === false;

                  // Merge effect hover preview (non-destructive, display only)
                  const preview =
                    effectPreviewOverride?.clipId === clip.id
                      ? effectPreviewOverride.patch
                      : null;
                  const contrast = preview?.contrast ?? clip.contrast;
                  const warmth = preview?.warmth ?? clip.warmth;
                  const baseOpacity = preview?.opacity ?? clip.opacity ?? 1;

                  const outgoing = getOutgoingTransitionStyle(clip, trackTransitions, currentTimeMs);
                  const incoming = getIncomingTransitionStyle(clip, trackTransitions, trackClips, currentTimeMs);

                  // Determine final opacity
                  let opacity: number;
                  if (isDisabled) {
                    opacity = 0;
                  } else if (outgoing.opacity !== undefined) {
                    opacity = outgoing.opacity as number;
                  } else if (incoming?.opacity !== undefined) {
                    opacity = incoming.opacity as number;
                  } else {
                    opacity = isActive ? baseOpacity : 0;
                  }

                  const clipPath = incoming?.clipPath as string | undefined;

                  const transform =
                    (outgoing.transform as string | undefined) ??
                    `scale(${clip.scale ?? 1}) translate(${clip.positionX ?? 0}px, ${clip.positionY ?? 0}px) rotate(${clip.rotation ?? 0}deg)`;

                  const filterParts: string[] = [];
                  if (contrast !== undefined && contrast !== 0) {
                    filterParts.push(`contrast(${1 + contrast / 100})`);
                  }
                  if (warmth !== undefined && warmth !== 0) {
                    filterParts.push(buildWarmthFilter(warmth));
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
                      preload={heavyPreload ? "auto" : "metadata"}
                    />
                  );
                })}
              </div>
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
              preload={
                audioClipNeedsHeavyPreload(clip, currentTimeMs)
                  ? "auto"
                  : "metadata"
              }
            />
          ))}

          {/* Text clip overlays — rendered as DOM elements for correct CSS scaling */}
          {activeTextClips.map((clip) => {
            if (!clip.textContent) return null;
            const segments = splitTextIntoSegments(clip.textContent, clip.durationMs);
            const elapsed = currentTimeMs - clip.startMs;
            const displayText = getActiveSegment(segments, elapsed);
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
                {displayText}
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
                {t("editor_preview_empty")}
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
