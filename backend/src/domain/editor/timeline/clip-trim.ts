const MIN_CLIP_MS = 100;

/** Minimal clip shape stored in edit_project.tracks JSONB */
export type TimelineClipJson = Record<string, unknown> & {
  id: string;
  assetId?: string | null;
  isPlaceholder?: true;
  placeholderShotIndex?: number;
  placeholderLabel?: string;
  placeholderStatus?: "pending" | "generating" | "failed";
};

/**
 * Frontend/editor invariant for media clips (video, voiceover, music):
 * trimStartMs + durationMs + trimEndMs === sourceMaxDurationMs.
 * trimEndMs is the unused tail of the source file (not an absolute out-point).
 */
export function normalizeMediaClipTrimFields(
  sourceMaxMs: number,
  clip: TimelineClipJson,
): TimelineClipJson {
  const max = Math.max(MIN_CLIP_MS, Math.round(Number(sourceMaxMs) || MIN_CLIP_MS));
  let trimStart = Math.max(0, Math.floor(Number(clip.trimStartMs ?? 0)));
  if (trimStart > max - MIN_CLIP_MS) trimStart = Math.max(0, max - MIN_CLIP_MS);

  let durationMs = Math.max(MIN_CLIP_MS, Math.floor(Number(clip.durationMs ?? max - trimStart)));
  if (trimStart + durationMs > max) {
    durationMs = Math.max(MIN_CLIP_MS, max - trimStart);
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
