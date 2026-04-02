import type { TimelineClipJson } from "./clip-trim";
import { normalizeMediaClipTrimFields } from "./clip-trim";

export type TimelineTrackJson = {
  id: string;
  type: "video" | "audio" | "music" | "text";
  name: string;
  muted: boolean;
  locked: boolean;
  clips: TimelineClipJson[];
  transitions: unknown[];
};

export type AssetMergeRow = {
  id: string;
  role: string;
  durationMs: number | null;
  metadata: unknown;
};

function metadataShotIndex(metadata: unknown): number {
  const m = metadata as Record<string, unknown> | null | undefined;
  if (!m || typeof m !== "object") return -1;
  const v = m.shotIndex ?? m.shot_index;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))
    return Number(v);
  return -1;
}

function sortVideoAssetsByShot(a: AssetMergeRow, b: AssetMergeRow): number {
  const ai = metadataShotIndex(a.metadata);
  const bi = metadataShotIndex(b.metadata);
  const aMissing = ai < 0;
  const bMissing = bi < 0;
  if (aMissing && bMissing) return a.id.localeCompare(b.id);
  if (aMissing) return 1;
  if (bMissing) return -1;
  if (ai !== bi) return ai - bi;
  return a.id.localeCompare(b.id);
}

/**
 * Places video clips end-to-end in track order so none share the same timeline range.
 * Preserves the clips array order (script / placeholder slot order).
 */
export function sequentializeVideoClipStarts(
  clips: TimelineClipJson[],
): TimelineClipJson[] {
  let cursor = 0;
  return clips.map((c) => {
    const dur = Math.max(0, Number(c.durationMs ?? 0));
    const next = { ...c, startMs: cursor };
    cursor += dur;
    return next;
  });
}

function videoTimelineSpanMs(tracks: TimelineTrackJson[]): number {
  const v = tracks.find((t) => t.type === "video");
  if (!v?.clips.length) return 5000;
  return v.clips.reduce((s, c) => s + Number(c.durationMs ?? 0), 0);
}

/**
 * Builds the video track from content_assets order when there are no placeholders
 * (editor timeline is asset-driven, not script-driven). Preserves existing clip
 * rows when asset ids match so incremental refresh during reel generation keeps
 * stable ids and user trim fields.
 */
export function reconcileVideoClipsWithoutPlaceholders(
  existingClips: TimelineClipJson[],
  videoPool: AssetMergeRow[],
): TimelineClipJson[] {
  const sortedPool = [...videoPool].sort(sortVideoAssetsByShot);
  const consumedIds = new Set<string>();
  let cursor = 0;
  const result: TimelineClipJson[] = [];

  for (const asset of sortedPool) {
    const existing = existingClips.find(
      (c) =>
        c.isPlaceholder !== true &&
        c.assetId === asset.id &&
        typeof c.id === "string" &&
        !consumedIds.has(c.id),
    );
    if (existing && typeof existing.id === "string") {
      consumedIds.add(existing.id);
    }

    const meta = (asset.metadata as Record<string, unknown>) ?? {};
    const genPrompt =
      typeof meta.generationPrompt === "string"
        ? meta.generationPrompt
        : undefined;
    const shotIdx = metadataShotIndex(asset.metadata);
    const sourceDur = Math.max(
      1,
      Number(asset.durationMs ?? existing?.durationMs ?? 5000),
    );

    if (existing) {
      const preservedStartMs = Number(existing.startMs ?? cursor);
      const normalized = normalizeMediaClipTrimFields(sourceDur, {
        ...existing,
        assetId: asset.id,
        startMs: preservedStartMs,
        label:
          typeof existing.label === "string" && existing.label.trim() !== ""
            ? existing.label
            : genPrompt ??
              `Shot ${shotIdx >= 0 ? shotIdx + 1 : result.length + 1}`,
      });
      result.push(normalized);
      cursor = Math.max(
        cursor,
        preservedStartMs + Number(normalized.durationMs ?? sourceDur),
      );
    } else {
      const row = normalizeMediaClipTrimFields(sourceDur, {
        id: crypto.randomUUID(),
        type: "video",
        assetId: asset.id,
        label:
          genPrompt ??
          `Shot ${shotIdx >= 0 ? shotIdx + 1 : result.length + 1}`,
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
      result.push(row);
      cursor += Number(row.durationMs ?? sourceDur);
    }
  }
  return result;
}

export function mergePlaceholdersWithRealClips(
  currentTracks: TimelineTrackJson[],
  videoClips: AssetMergeRow[],
  voiceover: AssetMergeRow | undefined,
  music: AssetMergeRow | undefined,
  options?: {
    placeholderStatus?: "pending" | "generating" | "failed";
    shotIndex?: number;
  },
): TimelineTrackJson[] {
  const spanMs = videoTimelineSpanMs(currentTracks);
  const videoPool = [...videoClips].sort(sortVideoAssetsByShot);
  const usedVideoAssetIds = new Set<string>();

  return currentTracks.map((track) => {
    if (track.type === "video") {
      const hasPlaceholder = track.clips.some((c) => c.isPlaceholder === true);
      if (!hasPlaceholder) {
        const reconciled = reconcileVideoClipsWithoutPlaceholders(
          track.clips,
          videoPool,
        );
        return { ...track, clips: reconciled };
      }

      const updatedClips = track.clips.map((raw) => {
        let clip: TimelineClipJson = { ...raw };
        if (!clip.isPlaceholder) return clip;

        if (
          options?.placeholderStatus !== undefined &&
          (options.shotIndex === undefined ||
            options.shotIndex === clip.placeholderShotIndex)
        ) {
          clip = { ...clip, placeholderStatus: options.placeholderStatus };
        }

        const shotIndex = clip.placeholderShotIndex ?? 0;
        const exact = videoPool.find(
          (a) =>
            !usedVideoAssetIds.has(a.id) &&
            metadataShotIndex(a.metadata) === shotIndex,
        );
        const unindexed = videoPool.find(
          (a) =>
            !usedVideoAssetIds.has(a.id) && metadataShotIndex(a.metadata) < 0,
        );
        const realAsset =
          exact ?? unindexed ?? videoPool.find((a) => !usedVideoAssetIds.has(a.id));
        if (!realAsset) return clip;

        usedVideoAssetIds.add(realAsset.id);

        const meta = (realAsset.metadata as Record<string, unknown>) ?? {};
        const genPrompt =
          typeof meta.generationPrompt === "string"
            ? meta.generationPrompt
            : undefined;
        const dur = realAsset.durationMs ?? Number(clip.durationMs ?? 5000);

        return normalizeMediaClipTrimFields(dur, {
          ...clip,
          assetId: realAsset.id,
          label:
            genPrompt ??
            (typeof clip.placeholderLabel === "string"
              ? clip.placeholderLabel
              : `Shot ${shotIndex + 1}`),
          isPlaceholder: undefined,
          placeholderShotIndex: undefined,
          placeholderLabel: undefined,
          placeholderStatus: undefined,
        });
      });
      const sequenced = sequentializeVideoClipStarts(updatedClips);
      return { ...track, clips: sequenced };
    }

    if (track.type === "audio") {
      if (!voiceover) return track;
      const nonVoiceoverClips = track.clips.filter(
        (c) => typeof c.id === "string" && !c.id.startsWith("voiceover-"),
      );
      const dur = voiceover.durationMs ?? spanMs;
      const existingVoiceover = track.clips.find(
        (c) =>
          typeof c.id === "string" &&
          c.id.startsWith("voiceover-") &&
          c.assetId === voiceover.id,
      );
      const voiceoverClip = existingVoiceover
        ? normalizeMediaClipTrimFields(dur, {
            ...existingVoiceover,
            assetId: voiceover.id,
          })
        : normalizeMediaClipTrimFields(dur, {
            id: `voiceover-${voiceover.id}`,
            type: "audio",
            assetId: voiceover.id,
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
          });
      return { ...track, clips: [...nonVoiceoverClips, voiceoverClip] };
    }

    if (track.type === "music") {
      if (!music) return track;
      const nonMusicClips = track.clips.filter(
        (c) => typeof c.id === "string" && !c.id.startsWith("music-"),
      );
      const dur = music.durationMs ?? spanMs;
      const existingMusic = track.clips.find(
        (c) =>
          typeof c.id === "string" &&
          c.id.startsWith("music-") &&
          c.assetId === music.id,
      );
      const musicClip = existingMusic
        ? normalizeMediaClipTrimFields(dur, {
            ...existingMusic,
            assetId: music.id,
          })
        : normalizeMediaClipTrimFields(dur, {
            id: `music-${music.id}`,
            type: "music",
            assetId: music.id,
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
            volume: 0.3,
            muted: false,
          });
      return { ...track, clips: [...nonMusicClips, musicClip] };
    }

    return track;
  });
}
