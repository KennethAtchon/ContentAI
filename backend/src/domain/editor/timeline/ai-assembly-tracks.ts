import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "../../../services/db/db";
import {
  assets,
  contentAssets,
} from "../../../infrastructure/database/drizzle/schema";
import { aiAssemblyResponseSchema } from "../editor.schemas";
import { normalizeMediaClipTrimFields } from "./clip-trim";

export async function loadProjectShotAssets(
  userId: string,
  generatedContentId: number,
) {
  const rows = await db
    .select({
      id: assets.id,
      durationMs: assets.durationMs,
      metadata: assets.metadata,
    })
    .from(contentAssets)
    .innerJoin(assets, eq(contentAssets.assetId, assets.id))
    .where(
      and(
        eq(contentAssets.generatedContentId, generatedContentId),
        eq(assets.userId, userId),
        eq(contentAssets.role, "video_clip"),
      ),
    );

  return rows.sort((a, b) => {
    const ai = Number((a.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    const bi = Number((b.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    return ai - bi;
  });
}

export function mapCaptionStyleToPresetId(
  style: z.infer<typeof aiAssemblyResponseSchema>["captionStyle"],
): string {
  return style ?? "hormozi";
}

export function convertAIResponseToTracks(
  aiResponse: z.infer<typeof aiAssemblyResponseSchema>,
  shotAssets: Array<{
    id: string;
    durationMs: number | null;
    metadata: unknown;
  }>,
  aux: {
    voiceover?: { id: string; durationMs: number | null };
    music?: { id: string; durationMs: number | null };
    totalVideoMs: number;
  },
) {
  let cursor = 0;
  const videoClips = aiResponse.cuts.map((cut, i) => {
    const asset = shotAssets[cut.shotIndex];
    const shotDuration = Math.max(1, asset.durationMs ?? 5000);
    let t0 = Math.max(0, Math.floor(cut.trimStartMs));
    let t1 = Math.floor(cut.trimEndMs);
    if (t0 >= shotDuration) t0 = 0;
    t1 = Math.min(Math.max(t1, t0 + 1), shotDuration);
    if (t0 >= t1) t1 = Math.min(t0 + 1, shotDuration);
    const clipDuration = t1 - t0;
    const clip = normalizeMediaClipTrimFields(shotDuration, {
      id: `ai-clip-${i}`,
      assetId: asset.id,
      label: `Shot ${cut.shotIndex + 1}`,
      startMs: cursor,
      trimStartMs: t0,
      durationMs: clipDuration,
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
    cursor += clipDuration;
    return clip;
  });

  const totalVideoMs = cursor;
  const spanMs = Math.max(totalVideoMs, aux.totalVideoMs, 1000);

  const voiceDur = Math.max(1, aux.voiceover?.durationMs ?? spanMs);
  const audioClips = aux.voiceover
    ? [
        normalizeMediaClipTrimFields(voiceDur, {
          id: `voiceover-${aux.voiceover.id}`,
          assetId: aux.voiceover.id,
          label: "Voiceover",
          startMs: 0,
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
        }),
      ]
    : [];

  const musicDur = Math.max(1, aux.music?.durationMs ?? spanMs);
  const musicClips = aux.music
    ? [
        normalizeMediaClipTrimFields(musicDur, {
          id: `music-${aux.music.id}`,
          assetId: aux.music.id,
          label: "Music",
          startMs: 0,
          speed: 1,
          opacity: 1,
          warmth: 0,
          contrast: 0,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0,
          volume: aiResponse.musicVolume,
          muted: false,
        }),
      ]
    : [];

  const captionPresetId = aiResponse.captionStyle
    ? mapCaptionStyleToPresetId(aiResponse.captionStyle)
    : "hormozi";
  const captionGroupSize = aiResponse.captionGroupSize ?? 3;
  const textClips =
    totalVideoMs > 0
      ? [
          {
            id: `ai-caption-${crypto.randomUUID()}`,
            assetId: aux.voiceover?.id ?? null,
            label: "Captions",
            startMs: 0,
            durationMs: totalVideoMs,
            trimStartMs: 0,
            trimEndMs: 0,
            sourceMaxDurationMs: totalVideoMs,
            speed: 1,
            opacity: 1,
            warmth: 0,
            contrast: 0,
            positionX: 0,
            positionY: 0,
            scale: 1,
            rotation: 0,
            volume: 0,
            muted: true,
            captionPresetId,
            captionGroupSize,
            captionPositionY: 80,
            captionWords: [] as {
              word: string;
              startMs: number;
              endMs: number;
            }[],
          },
        ]
      : [];

  return [
    {
      id: "video",
      type: "video" as const,
      name: "Video",
      muted: false,
      locked: false,
      clips: videoClips,
      transitions: [],
    },
    {
      id: "audio",
      type: "audio" as const,
      name: "Audio",
      muted: false,
      locked: false,
      clips: audioClips,
      transitions: [],
    },
    {
      id: "music",
      type: "music" as const,
      name: "Music",
      muted: false,
      locked: false,
      clips: musicClips,
      transitions: [],
    },
    {
      id: "text",
      type: "text" as const,
      name: "Caption",
      muted: false,
      locked: false,
      clips: textClips,
      transitions: [],
    },
  ];
}

export function buildStandardPresetTracks(
  shotAssets: Array<{
    id: string;
    durationMs: number | null;
    metadata: unknown;
  }>,
  aux?: {
    voiceover?: { id: string; durationMs: number | null };
    music?: { id: string; durationMs: number | null };
    musicVolume?: number;
    captionPresetId?: string;
    captionGroupSize?: number;
  },
) {
  let cursor = 0;
  const videoClips = shotAssets.map((asset, i) => {
    const durationMs = Math.max(1, asset.durationMs ?? 5000);
    const clip = normalizeMediaClipTrimFields(durationMs, {
      id: `std-clip-${i}`,
      assetId: asset.id,
      label: `Shot ${i + 1}`,
      startMs: cursor,
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
    cursor += durationMs;
    return clip;
  });

  const totalVideoMs = cursor;
  const spanMs = Math.max(totalVideoMs, 1000);
  const musicVol = aux?.musicVolume ?? 0.22;

  const voiceDur = Math.max(1, aux?.voiceover?.durationMs ?? spanMs);
  const audioClips = aux?.voiceover
    ? [
        normalizeMediaClipTrimFields(voiceDur, {
          id: `voiceover-${aux.voiceover.id}`,
          assetId: aux.voiceover.id,
          label: "Voiceover",
          startMs: 0,
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
        }),
      ]
    : [];

  const musicDur = Math.max(1, aux?.music?.durationMs ?? spanMs);
  const musicClips = aux?.music
    ? [
        normalizeMediaClipTrimFields(musicDur, {
          id: `music-${aux.music.id}`,
          assetId: aux.music.id,
          label: "Music",
          startMs: 0,
          speed: 1,
          opacity: 1,
          warmth: 0,
          contrast: 0,
          positionX: 0,
          positionY: 0,
          scale: 1,
          rotation: 0,
          volume: musicVol,
          muted: false,
        }),
      ]
    : [];

  const capPreset = aux?.captionPresetId ?? "hormozi";
  const capGroup = aux?.captionGroupSize ?? 3;
  const textClips =
    totalVideoMs > 0
      ? [
          {
            id: `std-caption-${crypto.randomUUID()}`,
            assetId: aux?.voiceover?.id ?? null,
            label: "Captions",
            startMs: 0,
            durationMs: totalVideoMs,
            trimStartMs: 0,
            trimEndMs: 0,
            sourceMaxDurationMs: totalVideoMs,
            speed: 1,
            opacity: 1,
            warmth: 0,
            contrast: 0,
            positionX: 0,
            positionY: 0,
            scale: 1,
            rotation: 0,
            volume: 0,
            muted: true,
            captionPresetId: capPreset,
            captionGroupSize: capGroup,
            captionPositionY: 80,
            captionWords: [] as {
              word: string;
              startMs: number;
              endMs: number;
            }[],
          },
        ]
      : [];

  return [
    {
      id: "video",
      type: "video" as const,
      name: "Video",
      muted: false,
      locked: false,
      clips: videoClips,
      transitions: [],
    },
    {
      id: "audio",
      type: "audio" as const,
      name: "Audio",
      muted: false,
      locked: false,
      clips: audioClips,
      transitions: [],
    },
    {
      id: "music",
      type: "music" as const,
      name: "Music",
      muted: false,
      locked: false,
      clips: musicClips,
      transitions: [],
    },
    {
      id: "text",
      type: "text" as const,
      name: "Caption",
      muted: false,
      locked: false,
      clips: textClips,
      transitions: [],
    },
  ];
}
