const minClipMs = 100;

export type TimelineClipJson = Record<string, unknown> & {
  id?: string;
  assetId?: string | null;
  type?: string;
  isPlaceholder?: true;
  placeholderShotIndex?: number;
  placeholderLabel?: string;
  placeholderStatus?: "pending" | "generating" | "failed";
  trimStartMs?: number;
  durationMs?: number;
  trimEndMs?: number;
  sourceMaxDurationMs?: number;
};

export function normalizeMediaClipTrimFields<T extends TimelineClipJson>(
  sourceMaxMs: number,
  clip: T,
): T & {
  trimStartMs: number;
  durationMs: number;
  trimEndMs: number;
  sourceMaxDurationMs: number;
} {
  const max = Math.max(minClipMs, Math.round(Number(sourceMaxMs) || minClipMs));
  let trimStart = Math.max(0, Math.floor(Number(clip.trimStartMs ?? 0)));
  if (trimStart > max - minClipMs) trimStart = Math.max(0, max - minClipMs);

  let durationMs = Math.max(
    minClipMs,
    Math.floor(Number(clip.durationMs ?? max - trimStart)),
  );
  if (trimStart + durationMs > max) {
    durationMs = Math.max(minClipMs, max - trimStart);
  }

  const trimEndMs = Math.max(0, max - trimStart - durationMs);

  return {
    ...clip,
    trimStartMs: trimStart,
    durationMs,
    trimEndMs,
    sourceMaxDurationMs: max,
  };
}
