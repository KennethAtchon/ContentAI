import type { Track, TimelineClip } from "../types/editor";

export type PersistedTimelineClip = Omit<TimelineClip, "locallyModified">;
export type PersistedTrack = Omit<Track, "clips"> & {
  clips: PersistedTimelineClip[];
};

/** Remove client-only flags before persisting to the API */
export function stripLocallyModifiedFromTracks(
  tracks: Track[],
): PersistedTrack[] {
  return tracks.map((t) => ({
    ...t,
    clips: t.clips.map(
      ({ locallyModified: _lm, ...clip }) => clip as PersistedTimelineClip,
    ),
  }));
}
