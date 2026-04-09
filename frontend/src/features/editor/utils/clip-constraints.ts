import type { MediaClip, Track } from "../types/editor";

/**
 * Returns true if placing a clip at [startMs, startMs+durationMs) would
 * overlap any existing clip on the track (optionally excluding one clip by id).
 */
export function hasCollision(
  track: Track,
  startMs: number,
  durationMs: number,
  excludeClipId?: string
): boolean {
  const end = startMs + durationMs;
  return track.clips.some((c) => {
    if (excludeClipId && c.id === excludeClipId) return false;
    return startMs < c.startMs + c.durationMs && end > c.startMs;
  });
}

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
  const others = track.clips
    .filter((c) => c.id !== movingClipId)
    .sort((a, b) => a.startMs - b.startMs);
  let start = Math.max(0, proposedStartMs);

  for (let attempt = 0; attempt < others.length + 1; attempt++) {
    const collision = others.find((other) => {
      const otherEnd = other.startMs + other.durationMs;
      return start < otherEnd && start + durationMs > other.startMs;
    });
    if (!collision) return start;

    const snapBefore = Math.max(0, collision.startMs - durationMs);
    const snapAfter = collision.startMs + collision.durationMs;
    const distBefore = Math.abs(proposedStartMs - snapBefore);
    const distAfter = Math.abs(proposedStartMs - snapAfter);
    const beforeFree = !others.some((other) => {
      const otherEnd = other.startMs + other.durationMs;
      return snapBefore < otherEnd && snapBefore + durationMs > other.startMs;
    });

    if (beforeFree && distBefore <= distAfter) {
      start = snapBefore;
    } else {
      start = snapAfter;
    }
  }

  return start;
}

export function enforceNoOverlap(
  track: Track,
  clipId: string,
  proposedStartMs: number,
  durationMs: number
): number {
  const startMs = Math.max(0, proposedStartMs);
  if (!hasCollision(track, startMs, durationMs, clipId)) {
    return startMs;
  }
  return clampMoveToFreeSpace(track, clipId, startMs, durationMs);
}

/**
 * Returns the maximum duration a clip can be extended to on the right
 * without overlapping the next clip on the same track.
 */
export function clampTrimEnd(
  track: Track,
  clip: MediaClip,
  proposedDurationMs: number
): number {
  const nextClipStart = track.clips
    .filter((c) => c.id !== clip.id && c.startMs > clip.startMs)
    .reduce<
      number | null
    >((min, c) => (min === null || c.startMs < min ? c.startMs : min), null);

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
  clip: MediaClip,
  proposedStartMs: number
): number {
  const prevClipEnd = track.clips
    .filter((c) => c.id !== clip.id && c.startMs < clip.startMs)
    .reduce<number>((max, c) => Math.max(max, c.startMs + c.durationMs), 0);

  return Math.max(proposedStartMs, prevClipEnd);
}
