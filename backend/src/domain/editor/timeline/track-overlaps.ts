import type { Track } from "../../../types/timeline.types";

/** Loose enough for persisted timeline JSON (`TimelineClipJson`) and strict `Clip`. */
type OverlapClip = {
  id?: string;
  assetId?: string | null;
  speed?: number;
  startMs?: number;
  durationMs?: number;
  trimStartMs?: number;
  trimEndMs?: number;
  sourceMaxDurationMs?: number;
  isPlaceholder?: true;
  type?: string;
};

const MIN_CLIP_MS = 100;

function overlapStartMs(clip: OverlapClip): number {
  return Math.max(0, Math.round(Number(clip.startMs ?? 0)));
}

function overlapDurationMs(clip: OverlapClip): number {
  return Math.max(
    MIN_CLIP_MS,
    Math.round(Number(clip.durationMs ?? MIN_CLIP_MS)),
  );
}

function alignMediaClipSourceBounds<TClip extends OverlapClip>(clip: TClip): TClip {
  const sourceMaxDurationMs = Number(clip.sourceMaxDurationMs);
  if (
    clip.assetId == null ||
    clip.assetId === "" ||
    !Number.isFinite(sourceMaxDurationMs) ||
    sourceMaxDurationMs <= 0 ||
    (clip.type === "video" && clip.isPlaceholder)
  ) {
    return clip;
  }

  const trimStartMs = Math.max(0, Math.round(Number(clip.trimStartMs ?? 0)));
  const speed =
    Number.isFinite(clip.speed) && Number(clip.speed) > 0
      ? Number(clip.speed)
      : 1;
  const maxTimelineDuration = Math.max(
    MIN_CLIP_MS,
    Math.floor((sourceMaxDurationMs - trimStartMs) / speed),
  );
  const durationMs = Math.max(
    MIN_CLIP_MS,
    Math.min(overlapDurationMs(clip), maxTimelineDuration),
  );
  const trimEndMs = Math.max(
    0,
    sourceMaxDurationMs - trimStartMs - Math.round(durationMs * speed),
  );

  if (
    trimStartMs === Number(clip.trimStartMs ?? 0) &&
    durationMs === Number(clip.durationMs ?? 0) &&
    trimEndMs === Number(clip.trimEndMs ?? 0)
  ) {
    return clip;
  }

  return {
    ...clip,
    trimStartMs,
    durationMs,
    trimEndMs,
  };
}
/** Any track-shaped object with a `clips` array (strict `Track` or loose `TimelineTrackJson`). */
type OverlapTrack<TClip extends OverlapClip> = {
  clips: TClip[];
};

export function sanitizeTrackOverlaps<
  TClip extends OverlapClip,
  TTrack extends OverlapTrack<TClip>,
>(track: TTrack): TTrack {
  if (track.clips.length < 2) return track;

  const ordered = track.clips
    .map((clip, index) => ({ clip, index }))
    .sort((a, b) => {
      const sa = overlapStartMs(a.clip);
      const sb = overlapStartMs(b.clip);
      if (sa !== sb) return sa - sb;
      return a.index - b.index;
    });
  let cursor = 0;
  let changed = false;

  const clips = ordered.map(({ clip }) => {
    const aligned = alignMediaClipSourceBounds(clip);
    const rawStart = overlapStartMs(aligned);
    const dur = overlapDurationMs(aligned);
    const safeStart = Math.max(cursor, rawStart);
    cursor = safeStart + dur;
    if (safeStart === rawStart) return aligned;
    changed = true;
    return { ...aligned, startMs: safeStart };
  });

  if (!changed && clips.every((clip, index) => clip === track.clips[index])) {
    return track;
  }

  return { ...track, clips } as TTrack;
}

export function sanitizeEditorTrackOverlaps(tracks: Track[]): Track[] {
  return tracks.map(sanitizeTrackOverlaps);
}
