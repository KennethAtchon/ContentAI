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
  /**
   * Who placed this clip on the timeline.
   * - "content": derived from AI-generated content assets (placed/replaced by SyncService)
   * - "user": manually added by the user in the editor (never touched by sync)
   *
   * Clips without this field are treated as "content" (they predate this field
   * and were all content-derived anyway).
   *
   * TODO (Phase 2 — AI direct-edit):
   * Add "ai_edit" for clips placed by AI direct-edit tools (trim_clip, reorder_shots,
   * assemble_video_cut, create_text_overlay, etc.). This is the discriminator that
   * SyncService.mergeTrackSets will use to decide whose intent wins during a sync:
   * - "ai_edit" clips should survive text content re-syncs (they were explicitly
   *   placed by AI intent, not derived from assets)
   * - "ai_edit" clips are replaceable by a subsequent AI edit operation
   * - "ai_edit" clips are overrideable by user manual edits (user wins)
   * The exact merge semantics depend on the operational model chosen for Phase 2.
   */
  source?: "content" | "user";
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
