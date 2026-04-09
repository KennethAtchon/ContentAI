import type { ClipPatch, MediaClip, TextClip, Track, VideoClip } from "../types/editor";
import {
  audioClipNeedsHeavyPreload,
  buildActiveVideoClipIdsByTrackMap,
  buildWarmthFilter,
  getIncomingTransitionStyle,
  getOutgoingTransitionStyle,
  isClipActiveAtTimelineTime,
  videoClipNeedsHeavyPreload,
} from "../utils/editor-composition";
import { isCaptionClip, isMediaClip, isTextClip, isVideoClip } from "../utils/clip-types";

const MIN_ADAPTIVE_MOUNT_WINDOW_MS = 6_000;
const MAX_ADAPTIVE_MOUNT_WINDOW_MS = 18_000;
const BASE_ADAPTIVE_MOUNT_WINDOW_MS = 12_000;
const ADAPTIVE_WINDOW_STEP_MS = 250;

export interface PreviewVideoObject {
  id: string;
  trackId: string;
  src: string | null;
  shouldMount: boolean;
  preload: "auto" | "metadata";
  style: {
    opacity: number;
    clipPath?: string;
    filter?: string;
    transform: string;
    zIndex: number;
  };
}

export interface PreviewAudioObject {
  id: string;
  src: string;
  shouldMount: boolean;
  preload: "auto" | "metadata";
}

export interface PreviewTextObject {
  clip: TextClip;
}

export interface PreviewScene {
  activeCaptionClipId: string | null;
  adaptiveMountWindowMs: number;
  audioObjects: PreviewAudioObject[];
  hasContent: boolean;
  textObjects: PreviewTextObject[];
  videoObjects: PreviewVideoObject[];
}

interface DerivePreviewSceneParams {
  assetUrlMap: Map<string, string>;
  currentTimeMs: number;
  effectPreviewOverride?: { clipId: string; patch: ClipPatch } | null;
  tracks: Track[];
}

/**
 * Computes a bounded media mount window based on timeline density.
 *
 * The previous preview path used a broad fixed mount window, which could keep a
 * large number of decoders and DOM nodes alive at once. This adaptive version
 * narrows the window as clip counts rise so dense projects degrade more
 * predictably.
 */
export function computeAdaptiveMountWindowMs(clipCount: number): number {
  const penaltyMs = Math.max(0, clipCount - 8) * ADAPTIVE_WINDOW_STEP_MS;
  return Math.max(
    MIN_ADAPTIVE_MOUNT_WINDOW_MS,
    Math.min(MAX_ADAPTIVE_MOUNT_WINDOW_MS, BASE_ADAPTIVE_MOUNT_WINDOW_MS - penaltyMs)
  );
}

function isWithinAdaptiveMountWindow(
  currentTimeMs: number,
  startMs: number,
  durationMs: number,
  mountWindowMs: number
): boolean {
  const endMs = startMs + durationMs;
  return (
    currentTimeMs >= startMs - mountWindowMs &&
    currentTimeMs <= endMs + mountWindowMs
  );
}

/**
 * Derives the retained preview scene from editor document state.
 *
 * This is intentionally pure data: it converts tracks, time, and temporary
 * visual overrides into renderable stage objects plus mount/preload metadata.
 * Keeping this pure makes the preview easier to test and prevents rendering,
 * playback sync, and media lifecycle rules from collapsing back into one
 * component.
 */
export function derivePreviewScene({
  assetUrlMap,
  currentTimeMs,
  effectPreviewOverride,
  tracks,
}: DerivePreviewSceneParams): PreviewScene {
  const videoTracks = tracks.filter((track) => track.type === "video");
  const audioTrack = tracks.find((track) => track.type === "audio");
  const musicTrack = tracks.find((track) => track.type === "music");
  const textTrack = tracks.find((track) => track.type === "text");
  const visualClipCount = tracks.reduce(
    (total, track) =>
      total +
      track.clips.filter((clip) => isVideoClip(clip) || isTextClip(clip)).length,
    0
  );
  const adaptiveMountWindowMs = computeAdaptiveMountWindowMs(visualClipCount);
  const activeVideoClipIdsByTrack = buildActiveVideoClipIdsByTrackMap(
    videoTracks,
    currentTimeMs
  );

  const videoObjects: PreviewVideoObject[] = [];
  for (const videoTrack of videoTracks) {
    const trackClips = videoTrack.clips.filter(isVideoClip);
    const trackTransitions = videoTrack.transitions ?? [];
    const activeIds = activeVideoClipIdsByTrack.get(videoTrack.id) ?? new Set();

    for (const clip of trackClips) {
      const preview =
        effectPreviewOverride?.clipId === clip.id ? effectPreviewOverride.patch : null;
      const contrast =
        (preview && "contrast" in preview ? preview.contrast : undefined) ??
        clip.contrast;
      const warmth =
        (preview && "warmth" in preview ? preview.warmth : undefined) ?? clip.warmth;
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
      const isDisabled = clip.enabled === false;
      const isActive = activeIds.has(clip.id);
      const opacity =
        isDisabled
          ? 0
          : typeof outgoing.opacity === "number"
            ? outgoing.opacity
            : typeof incoming?.opacity === "number"
              ? incoming.opacity
              : isActive
                ? baseOpacity
                : 0;
      const filterParts: string[] = [];
      if (contrast !== undefined && contrast !== 0) {
        filterParts.push(`contrast(${1 + contrast / 100})`);
      }
      if (warmth !== undefined && warmth !== 0) {
        filterParts.push(buildWarmthFilter(warmth));
      }

      videoObjects.push({
        id: clip.id,
        trackId: videoTrack.id,
        src: assetUrlMap.get(clip.assetId ?? "") ?? null,
        shouldMount: isWithinAdaptiveMountWindow(
          currentTimeMs,
          clip.startMs,
          clip.durationMs,
          adaptiveMountWindowMs
        ),
        preload: videoClipNeedsHeavyPreload(
          clip,
          currentTimeMs,
          trackTransitions,
          trackClips,
          activeIds
        )
          ? "auto"
          : "metadata",
        style: {
          opacity,
          clipPath: incoming?.clipPath as string | undefined,
          filter: filterParts.join(" ") || undefined,
          transform:
            (outgoing.transform as string | undefined) ??
            `scale(${clip.scale ?? 1}) translate(${clip.positionX ?? 0}px, ${clip.positionY ?? 0}px) rotate(${clip.rotation ?? 0}deg)`,
          zIndex: videoTracks.length - 1 - videoTracks.indexOf(videoTrack),
        },
      });
    }
  }

  const audioObjects: PreviewAudioObject[] = [];
  for (const track of [audioTrack, musicTrack]) {
    if (!track) continue;

    for (const clip of track.clips.filter(isMediaClip)) {
      audioObjects.push({
        id: clip.id,
        src: assetUrlMap.get(clip.assetId ?? "") ?? "",
        shouldMount: isWithinAdaptiveMountWindow(
          currentTimeMs,
          clip.startMs,
          clip.durationMs,
          adaptiveMountWindowMs
        ),
        preload: audioClipNeedsHeavyPreload(clip, currentTimeMs)
          ? "auto"
          : "metadata",
      });
    }
  }

  const textObjects =
    textTrack?.clips
      .filter(isTextClip)
      .filter((clip) => isClipActiveAtTimelineTime(clip, currentTimeMs))
      .map((clip) => ({ clip })) ?? [];
  const activeCaptionClips = (textTrack?.clips ?? [])
    .filter(isCaptionClip)
    .filter((clip) => isClipActiveAtTimelineTime(clip, currentTimeMs));
  const activeCaptionClip =
    activeCaptionClips[activeCaptionClips.length - 1] ?? null;

  return {
    activeCaptionClipId: activeCaptionClip?.id ?? null,
    adaptiveMountWindowMs,
    audioObjects,
    hasContent: tracks.some((track) => track.clips.length > 0),
    textObjects,
    videoObjects,
  };
}

/**
 * Collects the clip ids that can produce mounted media nodes in the preview.
 *
 * The runtime registry uses this to prune refs for clips that no longer exist
 * in the current document, avoiding stale element handles after edits.
 */
export function collectMountedMediaClips(tracks: Track[]): {
  audioClips: MediaClip[];
  videoClips: VideoClip[];
} {
  const videoClips = tracks
    .filter((track) => track.type === "video")
    .flatMap((track) => track.clips.filter(isVideoClip));
  const audioClips = tracks
    .filter((track) => track.type === "audio" || track.type === "music")
    .flatMap((track) => track.clips.filter(isMediaClip));

  return { audioClips, videoClips };
}
