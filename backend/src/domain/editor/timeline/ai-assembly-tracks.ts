/**
 * AI assembly track builders.
 *
 * These functions convert an AI model's assembly response (which shots to use,
 * how to trim them, cut timing) into a full timeline track set. They are used
 * today in the editor's manual AI-assembly flow.
 *
 * TODO (Phase 2 — assemble_video_cut chat tool):
 * Wire these functions to a new chat tool that lets the AI arrange shots with
 * full timing control in response to a user chat message. The flow would be:
 *   1. AI calls assemble_video_cut tool with a cuts array
 *   2. loadProjectShotAssets() fetches available shot assets
 *   3. convertAIResponseToTracks() converts the AI response to tracks
 *   4. The resulting track set is written to the editor project via
 *      a new onEditorAction callback on ToolContext (see chat-tools.ts TODO)
 *      or through SyncService.syncLinkedProjects with an assembly override
 *
 * The clips produced here should carry source:"content" for Phase 1 compatibility.
 * When the assemble_video_cut tool is AI-initiated via chat, they should carry
 * source:"ai_edit" so SyncService.mergeTrackSets can distinguish them from
 * passively derived clips. See clip-trim.ts source field TODO.
 */
import type { z } from "zod";
import { contentRepository } from "../../singletons";
import { aiAssemblyResponseSchema } from "../editor.schemas";
import { normalizeMediaClipTrimFields } from "./clip-trim";
import type { CaptionClip } from "../../../types/timeline.types";

export async function loadProjectShotAssets(
  userId: string,
  generatedContentId: number,
) {
  return contentRepository.listVideoClipAssetsForAiAssembly(
    userId,
    generatedContentId,
  );
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
  captionClip: CaptionClip | null = null,
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
      type: "video",
      assetId: asset.id,
      label: `Shot ${cut.shotIndex + 1}`,
      startMs: cursor,
      trimStartMs: t0,
      durationMs: clipDuration,
      speed: 1,
      enabled: true,
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
          type: "audio",
          assetId: aux.voiceover.id,
          label: "Voiceover",
          startMs: 0,
          speed: 1,
          enabled: true,
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
          type: "music",
          assetId: aux.music.id,
          label: "Music",
          startMs: 0,
          speed: 1,
          enabled: true,
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
      clips: captionClip ? [captionClip] : [],
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
  },
  captionClip: CaptionClip | null = null,
) {
  let cursor = 0;
  const videoClips = shotAssets.map((asset, i) => {
    const durationMs = Math.max(1, asset.durationMs ?? 5000);
    const clip = normalizeMediaClipTrimFields(durationMs, {
      id: `std-clip-${i}`,
      type: "video",
      assetId: asset.id,
      label: `Shot ${i + 1}`,
      startMs: cursor,
      speed: 1,
      enabled: true,
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
          type: "audio",
          assetId: aux.voiceover.id,
          label: "Voiceover",
          startMs: 0,
          speed: 1,
          enabled: true,
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
          type: "music",
          assetId: aux.music.id,
          label: "Music",
          startMs: 0,
          speed: 1,
          enabled: true,
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
      clips: captionClip ? [captionClip] : [],
      transitions: [],
    },
  ];
}
