import type { MediaClip } from "../types/editor";

/**
 * Splits a clip at `atMs` (a timeline position in ms).
 *
 * Trim invariant preserved on both partitions:
 *   trimStartMs + durationMs + trimEndMs = sourceDuration (constant)
 *
 * Returns [clipA, clipB] or null if atMs is not strictly inside the clip.
 */
export function splitClip(
  clip: MediaClip,
  atMs: number
): [MediaClip, MediaClip] | null {
  if (atMs <= clip.startMs || atMs >= clip.startMs + clip.durationMs) {
    return null;
  }

  const clipADuration = atMs - clip.startMs;
  const clipBDuration = clip.durationMs - clipADuration;

  const clipA: MediaClip = {
    ...clip,
    id: crypto.randomUUID(),
    durationMs: clipADuration,
    // trimEndMs grows to cover the portion we cut off at the right
    trimEndMs: clip.trimEndMs + clipBDuration,
  };

  const clipB: MediaClip = {
    ...clip,
    id: crypto.randomUUID(),
    startMs: atMs,
    durationMs: clipBDuration,
    // trimStartMs grows to cover the portion we cut off at the left
    trimStartMs: clip.trimStartMs + clipADuration,
  };

  return [clipA, clipB];
}
