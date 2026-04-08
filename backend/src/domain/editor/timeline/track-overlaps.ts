import type { Clip, Track } from "../../../types/timeline.types";

type OverlapClip = Pick<Clip, "id" | "startMs" | "durationMs">;
type OverlapTrack<TClip extends OverlapClip> = Omit<Track, "clips"> & { clips: TClip[] };

export function sanitizeTrackOverlaps<TClip extends OverlapClip, TTrack extends OverlapTrack<TClip>>(
  track: TTrack,
): TTrack {
  if (track.clips.length < 2) return track;

  const ordered = track.clips
    .map((clip, index) => ({ clip, index }))
    .sort((a, b) => {
      if (a.clip.startMs !== b.clip.startMs) {
        return a.clip.startMs - b.clip.startMs;
      }
      return a.index - b.index;
    });
  let cursor = 0;
  let changed = false;

  const clips = ordered.map(({ clip }) => {
    const safeStart = Math.max(cursor, Math.max(0, clip.startMs));
    cursor = safeStart + clip.durationMs;
    if (safeStart === clip.startMs) return clip;
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
