import type { Clip, Track } from "../../../types/timeline.types";

function compareClipsByTimeline(a: Clip, b: Clip): number {
  if (a.startMs !== b.startMs) return a.startMs - b.startMs;
  if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
  return a.id.localeCompare(b.id);
}

type OverlapClip = Pick<Clip, "id" | "startMs" | "durationMs">;
type OverlapTrack<TClip extends OverlapClip> = Omit<Track, "clips"> & { clips: TClip[] };

export function sanitizeTrackOverlaps<TClip extends OverlapClip, TTrack extends OverlapTrack<TClip>>(
  track: TTrack,
): TTrack {
  if (track.clips.length < 2) return track;

  const ordered = [...track.clips].sort(compareClipsByTimeline);
  let cursor = 0;
  let changed = false;

  const clips = ordered.map((clip) => {
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
