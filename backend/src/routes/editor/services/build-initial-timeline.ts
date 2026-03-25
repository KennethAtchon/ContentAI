import { and, eq } from "drizzle-orm";
import { db } from "../../../services/db/db";
import {
  assets,
  contentAssets,
  generatedContent,
} from "../../../infrastructure/database/drizzle/schema";
import { extractCaptionSourceText } from "../../video/utils";
import {
  mergePlaceholdersWithRealClips,
  type AssetMergeRow,
  type TimelineClipJson,
  type TimelineTrackJson,
} from "./refresh-editor-timeline";

/** Collapse whitespace for on-screen copy (hook / caption / clean script). */
function normalizeCopy(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Caption track text: hook + model “clean” words (clean_script_for_audio, no
 * timestamp lines) + social caption. Omits duplicate clean block when it only
 * repeats the hook.
 */
export function composeCaptionOverlayText(input: {
  generatedHook: string | null;
  generatedCaption: string | null;
  cleanScriptForAudio: string | null;
}): string {
  const hook = normalizeCopy(input.generatedHook);
  const caption = normalizeCopy(input.generatedCaption);
  const clean = normalizeCopy(
    extractCaptionSourceText({
      cleanScriptForAudio: input.cleanScriptForAudio,
      generatedScript: null,
    }),
  );

  const parts: string[] = [];
  if (hook) parts.push(hook);
  if (clean && clean !== hook) parts.push(clean);
  if (caption) parts.push(caption);
  return parts.join("\n\n");
}

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
      name: "Caption",
      muted: false,
      locked: false,
      clips: [],
      transitions: [],
    },
  ];
}

function buildCaptionClip(text: string, spanMs: number): TimelineClipJson {
  const trimmed = text.trim();
  const dur = Math.min(Math.max(spanMs, 1000), 180_000);
  const label = trimmed.length > 40 ? `${trimmed.slice(0, 37)}…` : trimmed;
  return {
    id: crypto.randomUUID(),
    assetId: null,
    label,
    textContent: trimmed,
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
    volume: 0,
    muted: true,
  };
}

/**
 * Builds editor tracks from linked assets plus caption overlay copy from hook,
 * clean_script_for_audio, and generated_caption. Does not read generated_script
 * (that stays in the video job / parseScriptShots only).
 */
export async function buildInitialTimeline(
  generatedContentId: number,
  userId: string,
): Promise<{ tracks: TimelineTrackJson[]; durationMs: number }> {
  const [content] = await db
    .select({
      id: generatedContent.id,
      generatedHook: generatedContent.generatedHook,
      generatedCaption: generatedContent.generatedCaption,
      cleanScriptForAudio: generatedContent.cleanScriptForAudio,
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

  let tracks = emptyTracksFromVideo([]);
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

  const overlayText = composeCaptionOverlayText({
    generatedHook: content.generatedHook,
    generatedCaption: content.generatedCaption,
    cleanScriptForAudio: content.cleanScriptForAudio,
  });
  if (overlayText.length > 0) {
    const spanMs = Math.min(Math.max(maxEnd, 1000), 180_000);
    tracks = tracks.map((t) =>
      t.type === "text"
        ? { ...t, clips: [buildCaptionClip(overlayText, spanMs)] }
        : t,
    );
    const capEnd = spanMs;
    if (capEnd > maxEnd) maxEnd = capEnd;
  }

  const durationMs = Math.min(Math.max(maxEnd, 1000), 180_000);

  return { tracks, durationMs };
}
