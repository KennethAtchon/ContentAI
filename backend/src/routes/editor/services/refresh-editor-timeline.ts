import type { TimelineClipJson } from "../../../domain/editor/timeline/clip-trim";
import { normalizeMediaClipTrimFields } from "../../../domain/editor/timeline/clip-trim";
import { editorRepository } from "../../../domain/singletons";
import {
  type AssetMergeRow,
  type TimelineTrackJson,
} from "../../../domain/editor/timeline/merge-placeholders-with-assets";

export type { TimelineClipJson };
export type { AssetMergeRow, TimelineTrackJson };
export {
  mergePlaceholdersWithRealClips,
  sequentializeVideoClipStarts,
  reconcileVideoClipsWithoutPlaceholders,
} from "../../../domain/editor/timeline/merge-placeholders-with-assets";

export { normalizeMediaClipTrimFields };

/**
 * Merges content_assets into the editor project's tracks (placeholders → real clips).
 * Runs in a transaction with row lock to prevent concurrent clip completions corrupting JSON.
 */
export async function refreshEditorTimeline(
  contentId: number,
  userId: string,
  options?: {
    placeholderStatus?: "pending" | "generating" | "failed";
    shotIndex?: number;
  },
): Promise<void> {
  return editorRepository.refreshEditorTimeline(contentId, userId, options);
}
