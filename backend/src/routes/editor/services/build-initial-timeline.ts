import { eq } from "drizzle-orm";
import { db } from "../../../services/db/db";
import {
  assets,
  contentAssets,
} from "../../../infrastructure/database/drizzle/schema";

interface TimelineClip {
  id: string;
  assetId: string;
  label: string;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  speed: number;
  opacity: number;
  warmth: number;
  contrast: number;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  volume: number;
  muted: boolean;
}

interface TimelineTrack {
  id: string;
  type: "video" | "audio" | "music" | "text";
  name: string;
  muted: boolean;
  locked: boolean;
  clips: TimelineClip[];
  transitions: [];
}

export async function buildInitialTimeline(
  generatedContentId: number,
): Promise<{ tracks: TimelineTrack[]; durationMs: number }> {
  const linkedAssets = await db
    .select({
      role: contentAssets.role,
      assetId: assets.id,
      durationMs: assets.durationMs,
      type: assets.type,
      name: assets.name,
    })
    .from(contentAssets)
    .innerJoin(assets, eq(assets.id, contentAssets.assetId))
    .where(eq(contentAssets.generatedContentId, generatedContentId))
    .orderBy(assets.createdAt);

  const videoClipAssets = linkedAssets.filter(
    (a) => a.role === "video_clip" || a.role === "final_video",
  );
  const voiceoverAssets = linkedAssets.filter((a) => a.role === "voiceover");
  const musicAssets = linkedAssets.filter((a) => a.role === "background_music");
  const imageAssets = linkedAssets.filter((a) => a.role === "image");

  function makeClip(
    asset: (typeof linkedAssets)[number],
    startMs: number,
    overrides?: Partial<TimelineClip>,
  ): TimelineClip {
    return {
      id: crypto.randomUUID(),
      assetId: asset.assetId,
      label: asset.name ?? asset.type,
      startMs,
      durationMs: asset.durationMs ?? 5000,
      trimStartMs: 0,
      trimEndMs: 0,
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
      ...overrides,
    };
  }

  let videoPosition = 0;
  const videoTrackClips: TimelineClip[] = [];
  for (const asset of videoClipAssets) {
    const duration = asset.durationMs ?? 5000;
    videoTrackClips.push(makeClip(asset, videoPosition));
    videoPosition += duration;
  }
  for (const asset of imageAssets) {
    videoTrackClips.push(makeClip(asset, videoPosition, { durationMs: 5000 }));
    videoPosition += 5000;
  }

  const totalDuration = videoPosition;

  const audioTrackClips = voiceoverAssets.map((asset) =>
    makeClip(asset, 0, {
      durationMs: asset.durationMs ?? totalDuration,
    }),
  );

  const musicTrackClips = musicAssets.map((asset) =>
    makeClip(asset, 0, {
      durationMs: asset.durationMs ?? totalDuration,
      volume: 0.3,
    }),
  );

  return {
    tracks: [
      { id: crypto.randomUUID(), type: "video", name: "Video", muted: false, locked: false, clips: videoTrackClips, transitions: [] },
      { id: crypto.randomUUID(), type: "audio", name: "Voiceover", muted: false, locked: false, clips: audioTrackClips, transitions: [] },
      { id: crypto.randomUUID(), type: "music", name: "Music", muted: false, locked: false, clips: musicTrackClips, transitions: [] },
      { id: crypto.randomUUID(), type: "text", name: "Text", muted: false, locked: false, clips: [], transitions: [] },
    ],
    durationMs: totalDuration,
  };
}
