import type { Track } from "../../../types/timeline.types";

/** Loose enough for persisted timeline JSON (`TimelineClipJson`) and strict `Clip`. */
type OverlapClip = {
  id?: string;
  startMs?: number;
  durationMs?: number;
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
    const rawStart = overlapStartMs(clip);
    const dur = overlapDurationMs(clip);
    const safeStart = Math.max(cursor, rawStart);
    cursor = safeStart + dur;
    if (safeStart === rawStart) return clip;
    changed = true;
    return { ...clip, startMs: safeStart };
  });

  if (!changed && clips.every((clip, index) => clip === track.clips[index])) {
    return track;
  }

  return { ...track, clips } as TTrack;
}

export function sanitizeEditorTrackOverlaps(tracks: Track[]): Track[] {
  return tracks.map(sanitizeTrackOverlaps);
}
