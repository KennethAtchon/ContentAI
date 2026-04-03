import { Errors } from "../../utils/errors/app-error";
import type { IContentRepository } from "../content/content.repository";
import type { IEditorRepository } from "./editor.repository";
import { parseStoredEditorTracks } from "./validate-stored-tracks";
import type { TimelineClipJson } from "./timeline/clip-trim";
import { normalizeMediaClipTrimFields } from "./timeline/clip-trim";
import type { TimelineTrackJson } from "./timeline/merge-placeholders-with-assets";
import type { CaptionsService } from "./captions.service";
import { buildCaptionClip } from "./timeline/build-caption-clip";
import { debugLog } from "../../utils/debug/debug";

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

function makeVideoClip(
  assetId: string,
  durationMs: number,
  startMs: number,
  metadata: unknown,
): TimelineClipJson {
  const meta = (metadata as Record<string, unknown>) ?? {};
  const shotIdx = typeof meta.shotIndex === "number" ? meta.shotIndex : -1;
  const genPrompt =
    typeof meta.generationPrompt === "string"
      ? meta.generationPrompt
      : undefined;
  const dur = Math.max(1, durationMs);
  return normalizeMediaClipTrimFields(dur, {
    id: crypto.randomUUID(),
    type: "video",
    assetId,
    label: genPrompt ?? (shotIdx >= 0 ? `Shot ${shotIdx + 1}` : "Video clip"),
    startMs,
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
}

function makeAudioClip(
  assetId: string,
  durationMs: number,
  idPrefix: string,
  label: string,
  volume = 1,
): TimelineClipJson {
  const dur = Math.max(1, durationMs);
  return normalizeMediaClipTrimFields(dur, {
    id: `${idPrefix}-${assetId}`,
    type: idPrefix === "music" ? "music" : "audio",
    assetId,
    label,
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
    volume,
    muted: false,
  });
}

export async function mergeNewAssetsIntoProject(
  editor: IEditorRepository,
  content: IContentRepository,
  projectId: string,
  userId: string,
  captions?: CaptionsService,
): Promise<{
  changed: boolean;
  tracks: TimelineTrackJson[];
  durationMs: number;
  mergedAssetIds: string[];
}> {
  const project = await editor.findByIdAndUserId(projectId, userId);

  if (!project) throw Errors.notFound("Edit project");

  const currentTracks = parseStoredEditorTracks(
    project.tracks,
  ) as unknown as TimelineTrackJson[];
  const alreadyMerged = new Set((project.mergedAssetIds ?? []) as string[]);

  if (!project.generatedContentId) {
    return {
      changed: false,
      tracks: currentTracks,
      durationMs: project.durationMs,
      mergedAssetIds: [...alreadyMerged],
    };
  }

  const assetRows = await content.listAssetsLinkedToGeneratedContent(
    project.generatedContentId,
  );

  const newAssets = assetRows.filter((a) => !alreadyMerged.has(a.id));
  if (newAssets.length === 0) {
    return {
      changed: false,
      tracks: currentTracks,
      durationMs: project.durationMs,
      mergedAssetIds: [...alreadyMerged],
    };
  }

  const tracks: TimelineTrackJson[] = currentTracks.map((t) => ({
    ...t,
    clips: [...t.clips],
  }));

  for (const asset of newAssets) {
    if (asset.role === "video_clip") {
      const videoTrack = tracks.find((t) => t.type === "video");
      if (!videoTrack) continue;

      const placeholderIdx = videoTrack.clips.findIndex(
        (c) => c.isPlaceholder === true,
      );
      if (placeholderIdx >= 0) {
        const placeholder = videoTrack.clips[placeholderIdx];
        const dur = Math.max(
          1,
          asset.durationMs ?? Number(placeholder.durationMs ?? 5000),
        );
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
          makeVideoClip(
            asset.id,
            asset.durationMs ?? 5000,
            startMs,
            asset.metadata,
          ),
        );
      }
    } else if (asset.role === "voiceover") {
      const audioTrack = tracks.find((t) => t.type === "audio");
      if (!audioTrack) continue;
      const exists = audioTrack.clips.some((c) => c.assetId === asset.id);
      if (!exists) {
        audioTrack.clips.push(
          makeAudioClip(
            asset.id,
            asset.durationMs ?? 0,
            "voiceover",
            "Voiceover",
            1,
          ),
        );
      }

      if (captions && (asset.durationMs ?? 0) > 0) {
        try {
          const { captionDocId } = await captions.transcribeAsset(userId, asset.id);
          const captionClip = buildCaptionClip({
            captionDocId,
            voiceoverAsset: asset,
            voiceoverClipId: null,
          });
          const textTrack = tracks.find((t) => t.type === "text");
          if (textTrack) {
            const existingCaptionIdx = textTrack.clips.findIndex((c) => c.type === "caption");
            if (existingCaptionIdx >= 0) {
              textTrack.clips[existingCaptionIdx] = captionClip as unknown as TimelineClipJson;
            } else {
              textTrack.clips.push(captionClip as unknown as TimelineClipJson);
            }
          }
        } catch (err) {
          debugLog.warn("Caption transcription failed during mergeNewAssetsIntoProject", {
            service: "merge-new-assets",
            assetId: asset.id,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    } else if (asset.role === "background_music") {
      const musicTrack = tracks.find((t) => t.type === "music");
      if (!musicTrack) continue;
      const exists = musicTrack.clips.some((c) => c.assetId === asset.id);
      if (!exists) {
        musicTrack.clips.push(
          makeAudioClip(
            asset.id,
            asset.durationMs ?? 0,
            "music",
            "Music",
            0.3,
          ),
        );
      }
    }

    alreadyMerged.add(asset.id);
  }

  const durationMs = computeDuration(tracks);
  const mergedAssetIds = [...alreadyMerged];

  await editor.updateTracksDurationMerged(projectId, {
    tracks,
    durationMs,
    mergedAssetIds,
  });

  return { changed: true, tracks, durationMs, mergedAssetIds };
}
