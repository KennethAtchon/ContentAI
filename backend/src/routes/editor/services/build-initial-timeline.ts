import { and, eq } from "drizzle-orm";
import { db } from "../../../services/db/db";
import {
  assets,
  contentAssets,
  generatedContent,
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
  userId: string,
): Promise<{ tracks: TimelineTrack[]; durationMs: number }> {
  // Verify ownership before reading any assets — prevents latent IDOR if a
  // future call site passes an unvalidated generatedContentId.
  const [content] = await db
    .select({ id: generatedContent.id })
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.id, generatedContentId),
        eq(generatedContent.userId, userId),
      ),
    )
    .limit(1);

  if (!content) {
    return { tracks: [], durationMs: 0 };
  }

  const linkedAssets = await db
    .select({
      role: contentAssets.role,
      assetId: assets.id,
      durationMs: assets.durationMs,
      type: assets.type,
      name: assets.name,
      metadata: assets.metadata,
    })
    .from(contentAssets)
    .innerJoin(assets, eq(assets.id, contentAssets.assetId))
    .where(eq(contentAssets.generatedContentId, generatedContentId));

  // Sort video clips by shotIndex to match the intended playback order.
  // Assets are committed asynchronously during generation so createdAt order
  // does not match shotIndex order.
  const byShotIndex = (
    a: (typeof linkedAssets)[number],
    b: (typeof linkedAssets)[number],
  ) => {
    const ai = Number((a.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    const bi = Number((b.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    return ai - bi;
  };

  // Only video_clip role — final_video/assembled_video would be duplicates of
  // the raw clips; image is excluded from the initial editor bootstrap.
  const videoClipAssets = linkedAssets
    .filter((a) => a.role === "video_clip")
    .sort(byShotIndex);
  const voiceoverAssets = linkedAssets.filter((a) => a.role === "voiceover");
  const musicAssets = linkedAssets.filter((a) => a.role === "background_music");

  function makeClip(
    asset: (typeof linkedAssets)[number],
    startMs: number,
    overrides?: Partial<TimelineClip>,
  ): TimelineClip {
    const dur = asset.durationMs ?? 5000;
    return {
      id: crypto.randomUUID(),
      assetId: asset.assetId,
      label: asset.name ?? asset.type,
      startMs,
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

  // Clamp total duration: min 1 second, max 3 minutes (matches _buildInitialTimeline).
  const totalDuration = Math.min(Math.max(videoPosition, 1000), 180_000);

  const audioTrackClips = voiceoverAssets.map((asset) =>
    makeClip(asset, 0, {
      durationMs: asset.durationMs ?? totalDuration,
      trimEndMs: asset.durationMs ?? totalDuration,
    }),
  );

  const musicTrackClips = musicAssets.map((asset) =>
    makeClip(asset, 0, {
      durationMs: asset.durationMs ?? totalDuration,
      trimEndMs: asset.durationMs ?? totalDuration,
      volume: 0.3,
    }),
  );

  return {
    tracks: [
      {
        id: crypto.randomUUID(),
        type: "video",
        name: "Video",
        muted: false,
        locked: false,
        clips: videoTrackClips,
        transitions: [],
      },
      {
        id: crypto.randomUUID(),
        type: "audio",
        name: "Voiceover",
        muted: false,
        locked: false,
        clips: audioTrackClips,
        transitions: [],
      },
      {
        id: crypto.randomUUID(),
        type: "music",
        name: "Music",
        muted: false,
        locked: false,
        clips: musicTrackClips,
        transitions: [],
      },
      {
        id: crypto.randomUUID(),
        type: "text",
        name: "Text",
        muted: false,
        locked: false,
        clips: [],
        transitions: [],
      },
    ],
    durationMs: totalDuration,
  };
}
