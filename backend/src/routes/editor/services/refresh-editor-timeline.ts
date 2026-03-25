import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../../services/db/db";
import {
  assets,
  contentAssets,
  editProjects,
  generatedContent,
} from "../../../infrastructure/database/drizzle/schema";

/** Minimal clip shape stored in edit_project.tracks JSONB */
export type TimelineClipJson = Record<string, unknown> & {
  id: string;
  assetId?: string | null;
  isPlaceholder?: true;
  placeholderShotIndex?: number;
  placeholderLabel?: string;
  placeholderStatus?: "pending" | "generating" | "failed";
};

export type TimelineTrackJson = {
  id: string;
  type: "video" | "audio" | "music" | "text";
  name: string;
  muted: boolean;
  locked: boolean;
  clips: TimelineClipJson[];
  transitions: unknown[];
};

export type AssetMergeRow = {
  id: string;
  role: string;
  durationMs: number | null;
  metadata: unknown;
};

function metadataShotIndex(metadata: unknown): number {
  const m = metadata as Record<string, unknown> | null | undefined;
  if (!m || typeof m !== "object") return -1;
  const v = m.shotIndex ?? m.shot_index;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))
    return Number(v);
  return -1;
}

function sortVideoAssetsByShot(a: AssetMergeRow, b: AssetMergeRow): number {
  const ai = metadataShotIndex(a.metadata);
  const bi = metadataShotIndex(b.metadata);
  const aMissing = ai < 0;
  const bMissing = bi < 0;
  if (aMissing && bMissing) return a.id.localeCompare(b.id);
  if (aMissing) return 1;
  if (bMissing) return -1;
  if (ai !== bi) return ai - bi;
  return a.id.localeCompare(b.id);
}

/**
 * Places video clips end-to-end in track order so none share the same timeline range.
 * Preserves the clips array order (script / placeholder slot order).
 */
export function sequentializeVideoClipStarts(
  clips: TimelineClipJson[],
): TimelineClipJson[] {
  let cursor = 0;
  return clips.map((c) => {
    const dur = Math.max(0, Number(c.durationMs ?? 0));
    const next = { ...c, startMs: cursor };
    cursor += dur;
    return next;
  });
}

export async function resolveContentChainIds(
  contentId: number,
  userId: string,
): Promise<number[]> {
  const chain: number[] = [contentId];
  let currentId = contentId;
  while (true) {
    const [row] = await db
      .select({ parentId: generatedContent.parentId })
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.id, currentId),
          eq(generatedContent.userId, userId),
        ),
      )
      .limit(1);
    if (!row?.parentId) break;
    chain.push(row.parentId);
    currentId = row.parentId;
  }
  return chain;
}

function videoTimelineSpanMs(tracks: TimelineTrackJson[]): number {
  const v = tracks.find((t) => t.type === "video");
  if (!v?.clips.length) return 5000;
  return v.clips.reduce((s, c) => s + Number(c.durationMs ?? 0), 0);
}

export function mergePlaceholdersWithRealClips(
  currentTracks: TimelineTrackJson[],
  videoClips: AssetMergeRow[],
  voiceover: AssetMergeRow | undefined,
  music: AssetMergeRow | undefined,
  options?: {
    placeholderStatus?: "pending" | "generating" | "failed";
    shotIndex?: number;
  },
): TimelineTrackJson[] {
  const spanMs = videoTimelineSpanMs(currentTracks);
  const videoPool = [...videoClips].sort(sortVideoAssetsByShot);
  const usedVideoAssetIds = new Set<string>();

  return currentTracks.map((track) => {
    if (track.type === "video") {
      const updatedClips = track.clips.map((raw) => {
        let clip: TimelineClipJson = { ...raw };
        if (!clip.isPlaceholder) return clip;

        if (
          options?.placeholderStatus !== undefined &&
          (options.shotIndex === undefined ||
            options.shotIndex === clip.placeholderShotIndex)
        ) {
          clip = { ...clip, placeholderStatus: options.placeholderStatus };
        }

        const shotIndex = clip.placeholderShotIndex ?? 0;
        const exact = videoPool.find(
          (a) =>
            !usedVideoAssetIds.has(a.id) &&
            metadataShotIndex(a.metadata) === shotIndex,
        );
        const unindexed = videoPool.find(
          (a) =>
            !usedVideoAssetIds.has(a.id) && metadataShotIndex(a.metadata) < 0,
        );
        const realAsset =
          exact ?? unindexed ?? videoPool.find((a) => !usedVideoAssetIds.has(a.id));
        if (!realAsset) return clip;

        usedVideoAssetIds.add(realAsset.id);

        const meta = (realAsset.metadata as Record<string, unknown>) ?? {};
        const genPrompt =
          typeof meta.generationPrompt === "string"
            ? meta.generationPrompt
            : undefined;
        const dur = realAsset.durationMs ?? Number(clip.durationMs ?? 5000);

        return {
          ...clip,
          assetId: realAsset.id,
          label:
            genPrompt ??
            (typeof clip.placeholderLabel === "string"
              ? clip.placeholderLabel
              : `Shot ${shotIndex + 1}`),
          durationMs: dur,
          trimEndMs: dur,
          isPlaceholder: undefined,
          placeholderShotIndex: undefined,
          placeholderLabel: undefined,
          placeholderStatus: undefined,
        };
      });
      const sequenced = sequentializeVideoClipStarts(updatedClips);
      return { ...track, clips: sequenced };
    }

    if (track.type === "audio") {
      if (!voiceover) return track;
      const nonVoiceoverClips = track.clips.filter(
        (c) => typeof c.id === "string" && !c.id.startsWith("voiceover-"),
      );
      const dur = voiceover.durationMs ?? spanMs;
      return {
        ...track,
        clips: [
          ...nonVoiceoverClips,
          {
            id: `voiceover-${voiceover.id}`,
            assetId: voiceover.id,
            label: "Voiceover",
            startMs: 0,
            durationMs: dur,
            trimStartMs: 0,
            trimEndMs: dur,
            speed: 1,
            opacity: 1,
            warmth: 0,
            contrast: 0,
            positionX: 0,
            positionY: 0,
            scale: 1,
            rotation: 0,
            volume: 1,
            muted: false,
          },
        ],
      };
    }

    if (track.type === "music") {
      if (!music) return track;
      const nonMusicClips = track.clips.filter(
        (c) => typeof c.id === "string" && !c.id.startsWith("music-"),
      );
      const dur = music.durationMs ?? spanMs;
      return {
        ...track,
        clips: [
          ...nonMusicClips,
          {
            id: `music-${music.id}`,
            assetId: music.id,
            label: "Music",
            startMs: 0,
            durationMs: dur,
            trimStartMs: 0,
            trimEndMs: dur,
            speed: 1,
            opacity: 1,
            warmth: 0,
            contrast: 0,
            positionX: 0,
            positionY: 0,
            scale: 1,
            rotation: 0,
            volume: 0.3,
            muted: false,
          },
        ],
      };
    }

    return track;
  });
}

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
    const chain: number[] = [contentId];
    let cur = contentId;
    while (true) {
      const [row] = await tx
        .select({ parentId: generatedContent.parentId })
        .from(generatedContent)
        .where(
          and(
            eq(generatedContent.id, cur),
            eq(generatedContent.userId, userId),
          ),
        )
        .limit(1);
      if (!row?.parentId) break;
      chain.push(row.parentId);
      cur = row.parentId;
    }

    const rows = await tx
      .select()
      .from(editProjects)
      .where(
        and(
          eq(editProjects.userId, userId),
          inArray(editProjects.generatedContentId, chain),
          isNull(editProjects.parentProjectId),
        ),
      )
      .for("update")
      .limit(1);

    const [project] = rows;
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

    const currentTracks = project.tracks as TimelineTrackJson[];
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

    await tx
      .update(editProjects)
      .set({ tracks: updatedTracks })
      .where(eq(editProjects.id, project.id));
  });
}
