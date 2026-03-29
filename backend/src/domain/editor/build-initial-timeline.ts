import { extractCaptionSourceText } from "../../routes/video/utils";
import type { IContentRepository } from "../content/content.repository";
import type { TimelineClipJson } from "./timeline/clip-trim";
import {
  mergePlaceholdersWithRealClips,
  type AssetMergeRow,
  type TimelineTrackJson,
} from "./timeline/merge-placeholders-with-assets";

/** Mirror of frontend estimateReadingDurationMs — 2.5 words/sec, 2s minimum. */
function estimateReadingDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 2000;
  return Math.max(2000, Math.ceil(words / 2.5) * 1000);
}

function normalizeCopy(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim();
}

/**
 * On-screen overlay text: hook + voiceover body (voiceover_script, no
 * timestamp lines). Post caption is for the social post only — not shown here.
 */
export function composeOverlayText(input: {
  generatedHook: string | null;
  voiceoverScript: string | null;
}): string {
  const hook = normalizeCopy(input.generatedHook);
  const clean = normalizeCopy(
    extractCaptionSourceText({
      voiceoverScript: input.voiceoverScript,
      generatedScript: null,
    }),
  );

  const parts: string[] = [];
  if (hook) parts.push(hook);
  if (clean && clean !== hook) parts.push(clean);
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
      name: "Text",
      muted: false,
      locked: false,
      clips: [],
      transitions: [],
    },
  ];
}

function buildCaptionClip(text: string, spanMs: number): TimelineClipJson {
  const trimmed = text.trim();
  const dur = Math.min(
    Math.max(spanMs, estimateReadingDurationMs(trimmed)),
    180_000,
  );
  const codePoints = [...trimmed];
  const label =
    codePoints.length > 40
      ? `${codePoints.slice(0, 37).join("")}…`
      : trimmed;
  return {
    id: crypto.randomUUID(),
    assetId: null,
    label,
    textContent: trimmed,
    startMs: 0,
    durationMs: dur,
    trimStartMs: 0,
    trimEndMs: 0,
    sourceMaxDurationMs: dur,
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
 * Builds editor tracks from linked assets plus overlay copy from hook and
 * voiceover_script (not post_caption).
 */
export async function buildInitialTimeline(
  content: IContentRepository,
  generatedContentId: number,
  userId: string,
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

  const overlayText = composeOverlayText({
    generatedHook: row.generatedHook,
    voiceoverScript: row.voiceoverScript,
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
