import type { Track } from "../types/editor";

/** Snap within this many px of a target (converted to ms at call site). */
export const SNAP_THRESHOLD_PX = 10;

/**
 * Collect all snap targets in milliseconds from the current timeline state.
 * Always includes 0 and the playhead. Excludes the clip being dragged to
 * prevent self-snapping.
 *
 * All logic is in ms — no pixel math here.
 */
export function collectSnapTargets(
  tracks: Track[],
  excludeClipId: string,
  playheadMs: number,
): number[] {
  const set = new Set<number>();
  set.add(0);
  set.add(playheadMs);

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      set.add(clip.startMs);
      set.add(clip.startMs + clip.durationMs);
    }
  }

  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Find the nearest snap target within `thresholdMs`.
 * Returns the target ms value, or null if nothing is close enough.
 */
export function findNearestSnap(
  ms: number,
  targets: number[],
  thresholdMs: number,
): number | null {
  let best: number | null = null;
  let bestDist = thresholdMs;

  for (const t of targets) {
    const dist = Math.abs(ms - t);
    if (dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }

  return best;
}
