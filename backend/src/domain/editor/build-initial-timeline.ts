import type { IContentRepository } from "../content/content.repository";
import type { TimelineClipJson } from "./timeline/clip-trim";
import {
  mergePlaceholdersWithRealClips,
  type AssetMergeRow,
  type TimelineTrackJson,
} from "./timeline/merge-placeholders-with-assets";
import type { CaptionsService } from "./captions.service";
import { buildCaptionClip } from "./timeline/build-caption-clip";
import type { CaptionClip } from "../../types/timeline.types";
import { debugLog } from "../../utils/debug/debug";

function emptyTracksFromVideo(
  videoClips: TimelineTrackJson["clips"],
): TimelineTrackJson[] {
  return [
    {
      id: crypto.randomUUID(),
      type: "video",
      name: "Video",
      muted: false,
      locked: false,
      clips: videoClips,
      transitions: [],
    },
    {
      id: crypto.randomUUID(),
      type: "audio",
      name: "Voiceover",
      muted: false,
      locked: false,
      clips: [],
      transitions: [],
    },
    {
      id: crypto.randomUUID(),
      type: "music",
      name: "Music",
      muted: false,
      locked: false,
      clips: [],
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
  ];
}

/**
 * Builds editor tracks from linked media assets.
 * Caption clips are not created during init; they are added later once a real
 * caption doc exists.
 */
export async function buildInitialTimeline(
  content: IContentRepository,
  generatedContentId: number,
  userId: string,
  captions?: CaptionsService,
): Promise<{ tracks: TimelineTrackJson[]; durationMs: number }> {
  const row = await content.findHookAndVoiceoverForUser(
    generatedContentId,
    userId,
  );
  if (!row) {
    return { tracks: [], durationMs: 0 };
  }

  const linkedAssets = await content.listAssetsLinkedToGeneratedContent(
    generatedContentId,
  );

  const byShotIndex = (
    a: (typeof linkedAssets)[number],
    b: (typeof linkedAssets)[number],
  ) => {
    const ai = Number((a.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    const bi = Number((b.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    return ai - bi;
  };

  const videoClipAssets = linkedAssets
    .filter((a) => a.role === "video_clip")
    .sort(byShotIndex);

  const videoRows: AssetMergeRow[] = videoClipAssets.map((a) => ({
    id: a.id,
    role: "video_clip",
    durationMs: a.durationMs,
    metadata: a.metadata,
  }));

  const voiceRow = linkedAssets.find((a) => a.role === "voiceover");
  const musicRow = linkedAssets.find((a) => a.role === "background_music");

  const voiceover: AssetMergeRow | undefined = voiceRow
    ? {
        id: voiceRow.id,
        role: voiceRow.role ?? "voiceover",
        durationMs: voiceRow.durationMs,
        metadata: voiceRow.metadata,
      }
    : undefined;

  const music: AssetMergeRow | undefined = musicRow
    ? {
        id: musicRow.id,
        role: musicRow.role ?? "background_music",
        durationMs: musicRow.durationMs,
        metadata: musicRow.metadata,
      }
    : undefined;

  let captionClip: CaptionClip | null = null;
  if (captions && voiceover && (voiceover.durationMs ?? 0) > 0) {
    try {
      const { captionDocId } = await captions.transcribeAsset(userId, voiceover.id);
      captionClip = buildCaptionClip({ captionDocId, voiceoverAsset: voiceover, voiceoverClipId: null });
    } catch (err) {
      debugLog.warn("Caption transcription failed during buildInitialTimeline", {
        service: "build-initial-timeline",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  let tracks = emptyTracksFromVideo([]);
  tracks = mergePlaceholdersWithRealClips(
    tracks,
    videoRows,
    voiceover,
    music,
    undefined,
  );

  if (captionClip) {
    const textTrack = tracks.find((t) => t.type === "text");
    if (textTrack) {
      textTrack.clips = [captionClip as unknown as TimelineClipJson];
    }
  }

  let maxEnd = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const end =
        Number(clip.startMs ?? 0) + Number(clip.durationMs ?? 0);
      if (end > maxEnd) maxEnd = end;
    }
  }

  const durationMs = Math.min(Math.max(maxEnd, 1000), 180_000);

  return { tracks, durationMs };
}
