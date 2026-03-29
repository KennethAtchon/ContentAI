import { eq } from "drizzle-orm";
import { db } from "../../../services/db/db";
import { assets, contentAssets } from "../../../infrastructure/database/drizzle/schema";
import type { TimelineClipJson } from "../../../domain/editor/timeline/clip-trim";
import { normalizeMediaClipTrimFields } from "../../../domain/editor/timeline/clip-trim";
import { parseStoredEditorTracks } from "../../../domain/editor/validate-stored-tracks";
import type { AppDb } from "../../../domain/database.types";
import { editorRepository } from "../../../domain/singletons";
import {
  mergePlaceholdersWithRealClips,
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
  await db.transaction(async (tx) => {
    const dbx = tx as AppDb;
    const chain = await editorRepository.resolveContentParentIdChainInTx(
      dbx,
      contentId,
      userId,
    );

    const project = await editorRepository.lockRootEditProjectForContentChainInTx(
      dbx,
      userId,
      chain,
    );
    if (!project) return;

    const assetRows = await tx
      .select({
        id: assets.id,
        role: contentAssets.role,
        durationMs: assets.durationMs,
        metadata: assets.metadata,
      })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .where(eq(contentAssets.generatedContentId, contentId));

    const videoClipRows: AssetMergeRow[] = assetRows
      .filter((a) => a.role === "video_clip")
      .map((a) => ({
        id: a.id,
        role: a.role,
        durationMs: a.durationMs,
        metadata: a.metadata,
      }));
    const voiceover = assetRows.find((a) => a.role === "voiceover");
    const music = assetRows.find((a) => a.role === "background_music");

    const currentTracks = parseStoredEditorTracks(
      project.tracks,
    ) as TimelineTrackJson[];

    const incomingVideoIds = new Set(videoClipRows.map((a) => a.id));
    const incomingVoiceoverId = voiceover?.id ?? null;
    const incomingMusicId = music?.id ?? null;

    const videoTrack = currentTracks.find((t) => t.type === "video");
    const audioTrack = currentTracks.find((t) => t.type === "audio");
    const musicTrack = currentTracks.find((t) => t.type === "music");

    const existingVideoIds = new Set(
      (videoTrack?.clips ?? [])
        .filter((c) => c.isPlaceholder !== true && typeof c.assetId === "string")
        .map((c) => c.assetId as string),
    );
    const existingVoiceoverId =
      audioTrack?.clips.find(
        (c) => typeof c.id === "string" && c.id.startsWith("voiceover-"),
      )?.assetId ?? null;
    const existingMusicId =
      musicTrack?.clips.find(
        (c) => typeof c.id === "string" && c.id.startsWith("music-"),
      )?.assetId ?? null;

    const hasPlaceholders = (videoTrack?.clips ?? []).some(
      (c) => c.isPlaceholder === true,
    );
    const videoIdsMatch =
      incomingVideoIds.size === existingVideoIds.size &&
      [...incomingVideoIds].every((id) => existingVideoIds.has(id));

    if (
      videoIdsMatch &&
      incomingVoiceoverId === existingVoiceoverId &&
      incomingMusicId === existingMusicId &&
      !hasPlaceholders
    ) {
      return;
    }

    const updatedTracks = mergePlaceholdersWithRealClips(
      currentTracks,
      videoClipRows,
      voiceover
        ? {
            id: voiceover.id,
            role: voiceover.role,
            durationMs: voiceover.durationMs,
            metadata: voiceover.metadata,
          }
        : undefined,
      music
        ? {
            id: music.id,
            role: music.role,
            durationMs: music.durationMs,
            metadata: music.metadata,
          }
        : undefined,
      options,
    );

    await editorRepository.setProjectTracksInTx(dbx, project.id, updatedTracks);
  });
}
