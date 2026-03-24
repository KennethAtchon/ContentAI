import type { Track, Clip } from "../types/editor";

/**
 * Returns the nearest non-overlapping startMs for a clip being moved.
 * If the proposed position collides with another clip, snaps to just before
 * or just after the blocking clip — whichever is closer to the proposed position.
 */
export function clampMoveToFreeSpace(
  track: Track,
  movingClipId: string,
  proposedStartMs: number,
  durationMs: number
): number {
  const others = track.clips.filter((c) => c.id !== movingClipId);
  let start = Math.max(0, proposedStartMs);

  for (const other of others) {
    const otherEnd = other.startMs + other.durationMs;
    if (start < otherEnd && start + durationMs > other.startMs) {
      const snapBefore = Math.max(0, other.startMs - durationMs);
      const snapAfter = otherEnd;
      const distBefore = Math.abs(proposedStartMs - snapBefore);
      const distAfter = Math.abs(proposedStartMs - snapAfter);
      start = distBefore <= distAfter ? snapBefore : snapAfter;
    }
  }

  return start;
}

/**
 * Returns the maximum duration a clip can be extended to on the right
 * without overlapping the next clip on the same track.
 */
export function clampTrimEnd(
  track: Track,
  clip: Clip,
  proposedDurationMs: number
): number {
  const nextClipStart = track.clips
    .filter((c) => c.id !== clip.id && c.startMs > clip.startMs)
    .reduce<number | null>((min, c) => (min === null || c.startMs < min ? c.startMs : min), null);

  if (nextClipStart === null) return Math.max(100, proposedDurationMs);
  const maxDuration = nextClipStart - clip.startMs;
  return Math.min(Math.max(100, proposedDurationMs), maxDuration);
}

/**
 * Returns the earliest startMs for a trim-left operation that won't overlap
 * the previous clip on the same track.
 */
export function clampTrimStart(
  track: Track,
  clip: Clip,
  proposedStartMs: number
): number {
  const prevClipEnd = track.clips
    .filter((c) => c.id !== clip.id && c.startMs < clip.startMs)
    .reduce<number>((max, c) => Math.max(max, c.startMs + c.durationMs), 0);

  return Math.max(proposedStartMs, prevClipEnd);
}
