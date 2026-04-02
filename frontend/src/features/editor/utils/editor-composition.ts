/**
 * Pure timeline/preview composition helpers — shared source for preview timing,
 * transitions, and preload windows so export or other renderers can align with UI.
 */
import type { CSSProperties } from "react";
import type { Clip, Track, Transition } from "../types/editor";
import { isMediaClip } from "./clip-types";

export const PRELOAD_WINDOW_MS = 45_000;

/** Browsers clamp `HTMLMediaElement.playbackRate`; combined JKL × clip speed is clamped to this range. */
const HTML_MEDIA_PLAYBACK_RATE_MIN = -16;
const HTML_MEDIA_PLAYBACK_RATE_MAX = 16;

/**
 * Effective `playbackRate` for `<video>` / `<audio>`: timeline transport rate × per-clip speed.
 * The playhead still advances via `usePlayback` using the global rate; element rate stays aligned
 * where codecs allow (see docs/adr/ADR-009-editor-playback-preview.md).
 */
export function effectiveHtmlMediaPlaybackRate(
  timelinePlaybackRate: number,
  clipSpeed: number
): number {
  const s = clipSpeed && Number.isFinite(clipSpeed) ? clipSpeed : 1;
  const g =
    timelinePlaybackRate && Number.isFinite(timelinePlaybackRate)
      ? timelinePlaybackRate
      : 1;
  const combined = g * s;
  if (!Number.isFinite(combined)) return s;
  return Math.min(
    HTML_MEDIA_PLAYBACK_RATE_MAX,
    Math.max(HTML_MEDIA_PLAYBACK_RATE_MIN, combined)
  );
}

/** Seek sync threshold (seconds) when matching HTMLMediaElement.currentTime to timeline. */
export const VIDEO_SYNC_SEEK_THRESHOLD_SEC = 0.1;
export const VIDEO_INCOMING_TRANSITION_SEEK_THRESHOLD_SEC = 0.15;

export function isClipActiveAtTimelineTime(
  clip: { enabled?: boolean; startMs: number; durationMs: number },
  currentTimeMs: number
): boolean {
  return (
    clip.enabled !== false &&
    currentTimeMs >= clip.startMs &&
    currentTimeMs < clip.startMs + clip.durationMs
  );
}

/** Source media time in seconds for an active clip at the given timeline time. */
export function getClipSourceTimeSecondsAtTimelineTime(
  clip: Clip,
  timelineTimeMs: number
): number {
  return (
    ((timelineTimeMs - clip.startMs) / 1000) * (clip.speed || 1) +
    (clip.trimStartMs ?? 0) / 1000
  );
}

export function buildActiveVideoClipIdsByTrackMap(
  videoTracks: Track[],
  currentTimeMs: number
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const vt of videoTracks) {
    const ids = new Set(
      vt.clips
        .filter(isMediaClip)
        .filter((c) => isClipActiveAtTimelineTime(c, currentTimeMs))
        .map((c) => c.id)
    );
    map.set(vt.id, ids);
  }
  return map;
}

export function videoClipNeedsHeavyPreload(
  clip: Clip,
  currentTimeMs: number,
  videoTransitions: Transition[],
  videoClips: Clip[],
  activeIds: Set<string>
): boolean {
  if (activeIds.has(clip.id)) return true;
  const incomingTransition = videoTransitions.find(
    (tr) =>
      tr.clipBId === clip.id &&
      (tr.type === "dissolve" || tr.type === "wipe-right")
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

export function audioClipNeedsHeavyPreload(
  clip: Clip,
  currentTimeMs: number
): boolean {
  const end = clip.startMs + clip.durationMs;
  if (currentTimeMs >= clip.startMs && currentTimeMs < end) return true;
  return (
    currentTimeMs >= clip.startMs - PRELOAD_WINDOW_MS &&
    currentTimeMs <= end + PRELOAD_WINDOW_MS
  );
}

/** True when the playhead is in the dissolve/wipe handoff window before clip (incoming B). */
export function isIncomingDissolveOrWipePrerenderWindow(
  clip: Clip,
  trackTransitions: Transition[],
  trackClips: Clip[],
  currentTimeMs: number
): boolean {
  const incomingTransition = trackTransitions.find(
    (t) =>
      t.clipBId === clip.id && (t.type === "dissolve" || t.type === "wipe-right")
  );
  if (!incomingTransition) return false;
  const clipA = trackClips.find((c) => c.id === incomingTransition.clipAId);
  if (!clipA) return false;
  const clipAEnd = clipA.startMs + clipA.durationMs;
  const windowStart = clipAEnd - incomingTransition.durationMs;
  return currentTimeMs >= windowStart && currentTimeMs < clipAEnd;
}

/** Style for the outgoing clip (clipA) during a transition. */
export function getOutgoingTransitionStyle(
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
export function getIncomingTransitionStyle(
  clip: Clip,
  transitions: Transition[],
  allClips: Clip[],
  currentTimeMs: number
): CSSProperties | null {
  const transition = transitions.find((t) => t.clipBId === clip.id);
  if (
    !transition ||
    (transition.type !== "dissolve" && transition.type !== "wipe-right")
  ) {
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
  return { clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`, opacity: 1 };
}

/** Improved warmth filter using hue-rotate instead of sepia. */
export function buildWarmthFilter(warmth: number): string {
  if (warmth === 0) return "";
  const deg = -(warmth * 0.3);
  const sat = 1 + warmth * 0.005;
  return `hue-rotate(${deg}deg) saturate(${sat})`;
}
