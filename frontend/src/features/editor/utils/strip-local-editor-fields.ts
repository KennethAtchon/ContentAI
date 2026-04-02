import type { Track, Clip } from "../types/editor";

export type PersistedClip = Omit<Clip, "locallyModified">;
export type PersistedTrack = Omit<Track, "clips"> & {
  clips: PersistedClip[];
};

/** Remove client-only flags before persisting to the API */
export function stripLocallyModifiedFromTracks(
  tracks: Track[],
): PersistedTrack[] {
  return tracks.map((t) => ({
    ...t,
    clips: t.clips.map(
      ({ locallyModified: _lm, ...clip }) => clip as PersistedClip,
    ),
  }));
}
