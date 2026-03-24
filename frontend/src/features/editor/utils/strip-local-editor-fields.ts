import type { Track } from "../types/editor";

/** Remove client-only flags before persisting to the API */
export function stripLocallyModifiedFromTracks(tracks: Track[]): Track[] {
  return tracks.map((t) => ({
    ...t,
    clips: t.clips.map(({ locallyModified: _lm, ...clip }) => clip),
  }));
}
