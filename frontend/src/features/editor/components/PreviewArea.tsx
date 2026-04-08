import { useRef, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import type { ClipPatch, Track } from "../types/editor";
import { useAssetUrlMap } from "../contexts/asset-url-map-context";
import { useCaptionCanvas } from "../caption/hooks/useCaptionCanvas";
import { useCaptionDoc } from "../caption/hooks/useCaptionDoc";
import { useCaptionPresets } from "../caption/hooks/useCaptionPresets";
import { applyCaptionStyleOverrides } from "../caption/apply-style-overrides";
import { formatHHMMSSd, formatMMSS } from "../utils/timecode";
import { getTextClipPreviewDisplay } from "../utils/text-segments";
import {
  audioClipNeedsHeavyPreload,
  buildActiveVideoClipIdsByTrackMap,
  buildWarmthFilter,
  effectiveHtmlMediaPlaybackRate,
  getClipSourceTimeSecondsAtTimelineTime,
  getIncomingTransitionStyle,
  getOutgoingTransitionStyle,
  isClipActiveAtTimelineTime,
  isIncomingDissolveOrWipePrerenderWindow,
  PREVIEW_MEDIA_MOUNT_WINDOW_MS,
  videoClipNeedsHeavyPreload,
  VIDEO_INCOMING_TRANSITION_SEEK_THRESHOLD_SEC,
  VIDEO_SYNC_SEEK_THRESHOLD_SEC,
} from "../utils/editor-composition";
import {
  isCaptionClip,
  isMediaClip,
  isTextClip,
  isVideoClip,
} from "../utils/clip-types";

interface Props {
  tracks: Track[];
  currentTimeMs: number;
  isPlaying: boolean;
  /** Global transport rate from JKL / transport (1 = normal). Multiplied with clip speed on media elements. */
  playbackRate: number;
  durationMs: number;
  resolution: string;
  /** Temporary per-clip property override for effect hover preview. Not committed to state. */
  effectPreviewOverride?: { clipId: string; patch: ClipPatch } | null;
}

export function PreviewArea({
  tracks,
  currentTimeMs,
  isPlaying,
  playbackRate,
  durationMs,
  resolution,
  effectPreviewOverride,
}: Props) {
  const { t } = useTranslation();
  const outerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const assetUrlMap = useAssetUrlMap();

  const [resW, resH] = (resolution || "1080x1920").split("x").map(Number);

  // Compute preview box dimensions that fit within the available space
  // while maintaining the correct aspect ratio (portrait, landscape, square).
  const [previewSize, setPreviewSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const compute = () => {
      // Reserve ~40px for the label row above and bottom info row below
      const availW = el.clientWidth;
      const availH = el.clientHeight - 40;
      if (availW <= 0 || availH <= 0) return;
      const ratio = resW / resH;
      if (availW / availH >= ratio) {
        setPreviewSize({ w: availH * ratio, h: availH });
      } else {
        setPreviewSize({ w: availW, h: availW / ratio });
      }
    };
    compute();
    const ResizeObserverImpl = window.ResizeObserver;
    if (!ResizeObserverImpl) return;
    const obs = new ResizeObserverImpl(compute);
    obs.observe(el);
    return () => obs.disconnect();
  }, [resW, resH]);

  const videoTracks = useMemo(() => tracks.filter((t) => t.type === "video"), [tracks]);
  const audioTrack = useMemo(() => tracks.find((t) => t.type === "audio"), [tracks]);
  const musicTrack = useMemo(() => tracks.find((t) => t.type === "music"), [tracks]);
  const textTrack = useMemo(() => tracks.find((t) => t.type === "text"), [tracks]);

  const activeVideoClipIdsByTrack = useMemo(
    () => buildActiveVideoClipIdsByTrackMap(videoTracks, currentTimeMs),
    [videoTracks, currentTimeMs]
  );

  const activeTextClips = useMemo(
    () =>
      (textTrack?.clips ?? []).filter(isTextClip).filter((c) =>
        isClipActiveAtTimelineTime(c, currentTimeMs)
      ),
    [textTrack?.clips, currentTimeMs]
  );
  const activeCaptionClip = useMemo(
    () => {
      const activeClips = (textTrack?.clips ?? [])
        .filter(isCaptionClip)
        .filter((clip) => isClipActiveAtTimelineTime(clip, currentTimeMs));
      return activeClips[activeClips.length - 1] ?? null;
    },
    [textTrack?.clips, currentTimeMs]
  );
  const { data: captionPresets } = useCaptionPresets();
  const { data: activeCaptionDoc } = useCaptionDoc(activeCaptionClip?.captionDocId ?? null);
  const activeCaptionPreset = useMemo(() => {
    const preset = captionPresets?.find((item) => item.id === activeCaptionClip?.stylePresetId);
    if (!preset || !activeCaptionClip) return null;
    return applyCaptionStyleOverrides(preset, activeCaptionClip.styleOverrides);
  }, [captionPresets, activeCaptionClip]);
  const captionCanvasRef = useCaptionCanvas({
    clip: activeCaptionClip,
    doc: activeCaptionDoc ?? null,
    preset: activeCaptionPreset,
    currentTimeMs,
    canvasW: Math.max(1, Math.round(previewSize?.w ?? resW)),
    canvasH: Math.max(1, Math.round(previewSize?.h ?? resH)),
  });

  const audioClips = useMemo(
    () => [
      ...(audioTrack?.clips ?? []).filter(isMediaClip).map((c) => ({
        clip: c,
        track: audioTrack!,
      })),
      ...(musicTrack?.clips ?? []).filter(isMediaClip).map((c) => ({
        clip: c,
        track: musicTrack!,
      })),
    ],
    [audioTrack, musicTrack]
  );

  const isClipWithinMountWindow = (startMs: number, durationMs: number) => {
    const endMs = startMs + durationMs;
    return (
      currentTimeMs >= startMs - PREVIEW_MEDIA_MOUNT_WINDOW_MS &&
      currentTimeMs <= endMs + PREVIEW_MEDIA_MOUNT_WINDOW_MS
    );
  };

  // Depends only on time + track data — not on derived Maps — so unrelated
  // re-renders (e.g. selection) do not re-run sync; still updates every frame while playing.
  useEffect(() => {
    for (const videoTrack of videoTracks) {
      const trackTransitions = videoTrack.transitions ?? [];
      const trackClips = videoTrack.clips.filter(isVideoClip);
      const activeIds =
        activeVideoClipIdsByTrack.get(videoTrack.id) ?? new Set<string>();

      for (const clip of trackClips) {
        const el = videoRefs.current.get(clip.id);
        if (!el) continue;

        el.muted = videoTrack.muted;

        const isActive = activeIds.has(clip.id);
        const isIncomingWindow = isIncomingDissolveOrWipePrerenderWindow(
          clip,
          trackTransitions,
          trackClips,
          currentTimeMs
        );

        if (isActive) {
          const targetTime = getClipSourceTimeSecondsAtTimelineTime(
            clip,
            currentTimeMs
          );
          if (Math.abs(el.currentTime - targetTime) > VIDEO_SYNC_SEEK_THRESHOLD_SEC) {
            el.currentTime = targetTime;
          }
          el.playbackRate = effectiveHtmlMediaPlaybackRate(
            playbackRate,
            clip.speed || 1
          );
          if (isPlaying && el.paused) el.play().catch(() => {});
          if (!isPlaying && !el.paused) el.pause();
        } else if (isIncomingWindow) {
          const targetTime = clip.trimStartMs / 1000;
          if (
            Math.abs(el.currentTime - targetTime) >
            VIDEO_INCOMING_TRANSITION_SEEK_THRESHOLD_SEC
          ) {
            el.currentTime = targetTime;
          }
          el.playbackRate = effectiveHtmlMediaPlaybackRate(
            playbackRate,
            clip.speed || 1
          );
          if (isPlaying && el.paused) el.play().catch(() => {});
          if (!isPlaying && !el.paused) el.pause();
        } else {
          if (!el.paused) el.pause();
        }
      }
    }
  }, [activeVideoClipIdsByTrack, currentTimeMs, isPlaying, playbackRate, videoTracks]);

  useEffect(() => {
    const runForTrack = (track: Track | undefined) => {
      if (!track) return;
      for (const clip of track.clips.filter(isMediaClip)) {
        const el = audioRefs.current.get(clip.id);
        if (!el) continue;

        const isActive = isClipActiveAtTimelineTime(clip, currentTimeMs);

        if (isActive) {
          const targetTime = getClipSourceTimeSecondsAtTimelineTime(
            clip,
            currentTimeMs
          );
          if (Math.abs(el.currentTime - targetTime) > VIDEO_SYNC_SEEK_THRESHOLD_SEC) {
            el.currentTime = targetTime;
          }
          el.playbackRate = effectiveHtmlMediaPlaybackRate(
            playbackRate,
            clip.speed || 1
          );
          el.volume = Math.min(1, Math.max(0, clip.volume ?? 1));
          el.muted = (clip.muted ?? false) || track.muted;
          if (isPlaying && el.paused) el.play().catch(() => {});
          if (!isPlaying && !el.paused) el.pause();
        } else {
          if (!el.paused) el.pause();
        }
      }
    };
    runForTrack(audioTrack);
    runForTrack(musicTrack);
  }, [currentTimeMs, isPlaying, playbackRate, audioTrack, musicTrack]);

  // Prune stale entries from videoRefs/audioRefs after every render
  const currentVideoClipIds = new Set(
    videoTracks.flatMap((vt) => vt.clips.filter(isMediaClip).map((c) => c.id))
  );
  const currentAudioClipIds = new Set(
    [
      ...(audioTrack?.clips ?? []).filter(isMediaClip),
      ...(musicTrack?.clips ?? []).filter(isMediaClip),
    ].map((c) => c.id)
  );
  useEffect(() => {
    for (const id of videoRefs.current.keys()) {
      if (!currentVideoClipIds.has(id)) videoRefs.current.delete(id);
    }
    for (const id of audioRefs.current.keys()) {
      if (!currentAudioClipIds.has(id)) audioRefs.current.delete(id);
    }
  });

  const hasContent = tracks.some((track) => track.clips.length > 0);
  const timecode = formatHHMMSSd(currentTimeMs);
  const position = formatMMSS(currentTimeMs);
  const total = formatMMSS(durationMs);

  return (
    <div ref={outerRef} className="flex-1 flex flex-col items-center justify-center bg-studio-bg overflow-hidden px-2 py-2 min-w-0">
      <p className="text-[10px] font-semibold text-dim-3 mb-2 tracking-widest uppercase">
        {t("editor_preview_label")}
      </p>

      {/* Preview screen — dimensions computed by ResizeObserver to correctly contain any aspect ratio */}
      <div
        className="relative"
        style={{
          width: previewSize?.w ?? 0,
          height: previewSize?.h ?? 0,
        }}
      >
        {/* Preview screen */}
        <div
          ref={containerRef}
          className="absolute inset-0 bg-black overflow-hidden flex items-center justify-center"
        >
          {/* Layered video tracks — Track 0 at bottom, Track N at top */}
          {videoTracks.map((videoTrack, trackIdx) => {
            const trackClips = videoTrack.clips.filter(isVideoClip);
            const trackTransitions = videoTrack.transitions ?? [];
            const activeIds =
              activeVideoClipIdsByTrack.get(videoTrack.id) ?? new Set();

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
                    activeIds
                  );
                  const isDisabled = clip.enabled === false;

                  const preview =
                    effectPreviewOverride?.clipId === clip.id
                      ? effectPreviewOverride.patch
                      : null;
                  const contrast =
                    (preview && "contrast" in preview ? preview.contrast : undefined) ??
                    clip.contrast;
                  const warmth =
                    (preview && "warmth" in preview ? preview.warmth : undefined) ??
                    clip.warmth;
                  const baseOpacity =
                    (preview && "opacity" in preview ? preview.opacity : undefined) ??
                    clip.opacity ??
                    1;

                  const outgoing = getOutgoingTransitionStyle(
                    clip,
                    trackTransitions,
                    currentTimeMs
                  );
                  const incoming = getIncomingTransitionStyle(
                    clip,
                    trackTransitions,
                    trackClips,
                    currentTimeMs
                  );

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

                  const resolvedSrc = assetUrlMap.get(clip.assetId ?? "");
                  const shouldMount = isClipWithinMountWindow(
                    clip.startMs,
                    clip.durationMs
                  );
                  if (!shouldMount) return null;

                  return (
                    <div key={clip.id} className="absolute inset-0">
                      <video
                        ref={(el) => {
                          if (el) videoRefs.current.set(clip.id, el);
                          else videoRefs.current.delete(clip.id);
                        }}
                        {...(resolvedSrc ? { src: resolvedSrc } : {})}
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
                      {!resolvedSrc && (
                        <div className="absolute inset-0 bg-overlay-sm animate-pulse rounded" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {audioClips
            .filter(({ clip }) => isClipWithinMountWindow(clip.startMs, clip.durationMs))
            .map(({ clip }) => (
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

          {activeTextClips.map((clip) => {
            if (!clip.textContent) return null;
            const elapsed = currentTimeMs - clip.startMs;
            const displayText = getTextClipPreviewDisplay(
              clip.textContent,
              clip.durationMs,
              elapsed,
              clip.textAutoChunk
            );
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
                  width: "80%",
                  maxWidth: "80%",
                  zIndex: 10,
                  lineHeight: 1.2,
                }}
              >
                {displayText}
              </div>
            );
          })}

          <canvas
            ref={captionCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden="true"
          />

          {!hasContent && (
            <div className="flex flex-col items-center gap-2">
              <Play size={32} className="text-white/40" />
              <span className="text-xs text-white/70">
                {t("editor_preview_empty")}
              </span>
            </div>
          )}

          <div className="absolute bottom-2 left-3 font-mono text-xs italic text-white/70 select-none">
            {timecode}
          </div>

          <div className="absolute top-2 right-3 text-[10px] bg-black/60 text-white/60 px-1.5 py-0.5 rounded">
            {resolution}
          </div>
        </div>
      </div>

      <div className="w-full flex justify-between mt-1 px-3">
        <span className="text-xs text-dim-3">
          {position} / {total}
        </span>
        <span className="text-xs text-dim-3">
          {resW} × {resH}
        </span>
      </div>
    </div>
  );
}
