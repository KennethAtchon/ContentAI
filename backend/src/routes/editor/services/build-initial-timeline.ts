import { and, eq } from "drizzle-orm";
import { db } from "../../../services/db/db";
import {
  assets,
  contentAssets,
  generatedContent,
} from "../../../infrastructure/database/drizzle/schema";
import { parseScriptShots } from "../../../shared/services/parse-script-shots";
import {
  mergePlaceholdersWithRealClips,
  type AssetMergeRow,
  type TimelineTrackJson,
} from "./refresh-editor-timeline";
import { debugLog } from "../../../utils/debug/debug";

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

export async function buildInitialTimeline(
  generatedContentId: number,
  userId: string,
): Promise<{ tracks: TimelineTrackJson[]; durationMs: number }> {
  const [content] = await db
    .select({
      id: generatedContent.id,
      generatedScript: generatedContent.generatedScript,
      generatedHook: generatedContent.generatedHook,
    })
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

  let shots: { description: string; estimatedDurationMs: number }[] = [];
  if (content.generatedScript) {
    try {
      const parsed = parseScriptShots(content.generatedScript);
      shots = parsed.map((s) => ({
        description: s.description,
        estimatedDurationMs: s.durationSeconds * 1000,
      }));
    } catch {
      shots = [];
    }
  }

  if (shots.length === 0) {
    if (content.generatedScript) {
      debugLog.warn(
        "[buildInitialTimeline] parseScriptShots returned 0 shots; falling back to hook placeholder",
        {
          service: "build-initial-timeline",
          contentId: content.id,
        },
      );
    }
    shots = [
      {
        description: content.generatedHook ?? "Shot 1",
        estimatedDurationMs: 5000,
      },
    ];
  }

  let cursor = 0;
  const placeholderClips: TimelineTrackJson["clips"] = shots.map((shot, i) => {
    const dur = shot.estimatedDurationMs ?? 5000;
    const start = cursor;
    cursor += dur;
    return {
      id: `placeholder-shot-${i}`,
      assetId: null,
      label: shot.description,
      isPlaceholder: true as const,
      placeholderShotIndex: i,
      placeholderLabel: shot.description,
      placeholderStatus: "pending" as const,
      startMs: start,
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
    };
  });

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
    id: a.assetId,
    role: a.role,
    durationMs: a.durationMs,
    metadata: a.metadata,
  }));

  const voiceRow = linkedAssets.find((a) => a.role === "voiceover");
  const musicRow = linkedAssets.find((a) => a.role === "background_music");

  const voiceover: AssetMergeRow | undefined = voiceRow
    ? {
        id: voiceRow.assetId,
        role: voiceRow.role,
        durationMs: voiceRow.durationMs,
        metadata: voiceRow.metadata,
      }
    : undefined;

  const music: AssetMergeRow | undefined = musicRow
    ? {
        id: musicRow.assetId,
        role: musicRow.role,
        durationMs: musicRow.durationMs,
        metadata: musicRow.metadata,
      }
    : undefined;

  let tracks = emptyTracksFromVideo(placeholderClips);
  tracks = mergePlaceholdersWithRealClips(
    tracks,
    videoRows,
    voiceover,
    music,
    undefined,
  );

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
