import { and, eq } from "drizzle-orm";
import { db } from "../../../services/db/db";
import {
  assets,
  contentAssets,
  editProjects,
} from "../../../infrastructure/database/drizzle/schema";
import {
  normalizeMediaClipTrimFields,
  type TimelineClipJson,
  type TimelineTrackJson,
} from "./refresh-editor-timeline";

function computeDuration(tracks: TimelineTrackJson[]): number {
  let maxEnd = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const end = Number(clip.startMs ?? 0) + Number(clip.durationMs ?? 0);
      if (end > maxEnd) maxEnd = end;
    }
  }
  return Math.min(Math.max(maxEnd, 1000), 180_000);
}

function endOfTrack(clips: TimelineClipJson[]): number {
  let end = 0;
  for (const c of clips) {
    end = Math.max(end, Number(c.startMs ?? 0) + Number(c.durationMs ?? 0));
  }
  return end;
}

function makeVideoClip(assetId: string, durationMs: number, startMs: number, metadata: unknown): TimelineClipJson {
  const meta = (metadata as Record<string, unknown>) ?? {};
  const shotIdx = typeof meta.shotIndex === "number" ? meta.shotIndex : -1;
  const genPrompt = typeof meta.generationPrompt === "string" ? meta.generationPrompt : undefined;
  const dur = Math.max(1, durationMs);
  return normalizeMediaClipTrimFields(dur, {
    id: crypto.randomUUID(),
    assetId,
    label: genPrompt ?? (shotIdx >= 0 ? `Shot ${shotIdx + 1}` : "Video clip"),
    startMs,
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
  });
}

function makeAudioClip(assetId: string, durationMs: number, idPrefix: string, label: string, volume = 1): TimelineClipJson {
  const dur = Math.max(1, durationMs);
  return normalizeMediaClipTrimFields(dur, {
    id: `${idPrefix}-${assetId}`,
    assetId,
    label,
    startMs: 0,
    speed: 1,
    opacity: 1,
    warmth: 0,
    contrast: 0,
    positionX: 0,
    positionY: 0,
    scale: 1,
    rotation: 0,
    volume,
    muted: false,
  });
}

export async function mergeNewAssetsIntoProject(
  projectId: string,
  userId: string,
): Promise<{
  changed: boolean;
  tracks: TimelineTrackJson[];
  durationMs: number;
  mergedAssetIds: string[];
}> {
  const [project] = await db
    .select()
    .from(editProjects)
    .where(
      and(
        eq(editProjects.id, projectId),
        eq(editProjects.userId, userId),
      ),
    )
    .limit(1);

  if (!project) throw new Error("Project not found");

  const currentTracks = (project.tracks ?? []) as TimelineTrackJson[];
  const alreadyMerged = new Set((project.mergedAssetIds ?? []) as string[]);

  if (!project.generatedContentId) {
    return {
      changed: false,
      tracks: currentTracks,
      durationMs: project.durationMs,
      mergedAssetIds: [...alreadyMerged],
    };
  }

  const assetRows = await db
    .select({
      id: assets.id,
      role: contentAssets.role,
      durationMs: assets.durationMs,
      metadata: assets.metadata,
    })
    .from(contentAssets)
    .innerJoin(assets, eq(contentAssets.assetId, assets.id))
    .where(eq(contentAssets.generatedContentId, project.generatedContentId));

  const newAssets = assetRows.filter((a) => !alreadyMerged.has(a.id));
  if (newAssets.length === 0) {
    return {
      changed: false,
      tracks: currentTracks,
      durationMs: project.durationMs,
      mergedAssetIds: [...alreadyMerged],
    };
  }

  // Deep clone tracks so we don't mutate the DB row
  const tracks: TimelineTrackJson[] = currentTracks.map((t) => ({
    ...t,
    clips: [...t.clips],
  }));

  for (const asset of newAssets) {
    if (asset.role === "video_clip") {
      const videoTrack = tracks.find((t) => t.type === "video");
      if (!videoTrack) continue;

      // Fill a matching placeholder first, otherwise append
      const placeholderIdx = videoTrack.clips.findIndex((c) => c.isPlaceholder === true);
      if (placeholderIdx >= 0) {
        const placeholder = videoTrack.clips[placeholderIdx];
        const dur = Math.max(1, asset.durationMs ?? Number(placeholder.durationMs ?? 5000));
        videoTrack.clips[placeholderIdx] = normalizeMediaClipTrimFields(dur, {
          ...placeholder,
          assetId: asset.id,
          isPlaceholder: undefined,
          placeholderShotIndex: undefined,
          placeholderLabel: undefined,
          placeholderStatus: undefined,
        });
      } else {
        const startMs = endOfTrack(videoTrack.clips);
        videoTrack.clips.push(
          makeVideoClip(asset.id, asset.durationMs ?? 5000, startMs, asset.metadata),
        );
      }
    } else if (asset.role === "voiceover") {
      const audioTrack = tracks.find((t) => t.type === "audio");
      if (!audioTrack) continue;
      const exists = audioTrack.clips.some((c) => c.assetId === asset.id);
      if (!exists) {
        audioTrack.clips.push(makeAudioClip(asset.id, asset.durationMs ?? 0, "voiceover", "Voiceover", 1));
      }
    } else if (asset.role === "background_music") {
      const musicTrack = tracks.find((t) => t.type === "music");
      if (!musicTrack) continue;
      const exists = musicTrack.clips.some((c) => c.assetId === asset.id);
      if (!exists) {
        musicTrack.clips.push(makeAudioClip(asset.id, asset.durationMs ?? 0, "music", "Music", 0.3));
      }
    }

    alreadyMerged.add(asset.id);
  }

  const durationMs = computeDuration(tracks);
  const mergedAssetIds = [...alreadyMerged];

  await db
    .update(editProjects)
    .set({ tracks, durationMs, mergedAssetIds })
    .where(eq(editProjects.id, projectId));

  return { changed: true, tracks, durationMs, mergedAssetIds };
}
