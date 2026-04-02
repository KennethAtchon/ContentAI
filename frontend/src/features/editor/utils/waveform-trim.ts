import type { MediaClip } from "../types/editor";

/**
 * Cuts full-asset waveform peaks down to the source time range this clip plays.
 * Peaks are assumed to be uniformly sampled across the entire source file.
 * Aligns with preview audio: source position advances by timelineDelta × speed from trimStartMs.
 */
export function slicePeaksForClipTrim(
  peaks: Float32Array | null,
  clip: MediaClip
): Float32Array | null {
  if (!peaks || peaks.length === 0) return peaks;

  const speed = clip.speed ?? 1;
  const trimStart = Math.max(0, clip.trimStartMs ?? 0);
  const trimEnd = Math.max(0, clip.trimEndMs ?? 0);
  const durationMs = Math.max(1, clip.durationMs ?? 1);

  const sourceMax =
    clip.sourceMaxDurationMs != null && clip.sourceMaxDurationMs > 0
      ? clip.sourceMaxDurationMs
      : trimStart + durationMs + trimEnd;

  if (!Number.isFinite(sourceMax) || sourceMax <= 0) return peaks;

  const sourceStartMs = trimStart;
  const sourceEndMs = Math.min(
    sourceMax,
    trimStart + durationMs * speed
  );

  const t0 = sourceStartMs / sourceMax;
  const t1 = sourceEndMs / sourceMax;

  const n = peaks.length;
  let i0 = Math.floor(t0 * n);
  let i1 = Math.ceil(t1 * n);
  i0 = Math.max(0, Math.min(n - 1, i0));
  i1 = Math.max(i0 + 1, Math.min(n, i1));

  if (i1 - i0 >= n) return peaks;

  return peaks.slice(i0, i1);
}
