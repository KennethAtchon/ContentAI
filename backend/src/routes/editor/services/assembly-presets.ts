import type {
  MusicClip,
  Track,
  VideoClip,
} from "../../../types/timeline.types";

type PresetTrack = Track;

export function applyStandardPreset(tracks: PresetTrack[]): PresetTrack[] {
  return tracks;
}

export function applyFastCutPreset(tracks: PresetTrack[]): PresetTrack[] {
  const maxClipMs = 3000;
  return tracks.map((track) => {
    if (track.type !== "video") return track;

    let cursor = 0;
    const clips = track.clips.map((clip) => {
      if (clip.type !== "video") return clip;
      const trimmedDuration = Math.min(clip.durationMs, maxClipMs);
      const removedRight = clip.durationMs - trimmedDuration;
      const updated: VideoClip = {
        ...clip,
        startMs: cursor,
        durationMs: trimmedDuration,
        trimEndMs: clip.trimEndMs + removedRight,
      };
      cursor += trimmedDuration;
      return updated;
    });

    return { ...track, clips };
  });
}

export function applyCinematicPreset(tracks: PresetTrack[]): PresetTrack[] {
  const fadeMs = 500;

  return tracks.map((track) => {
    if (track.type === "video") {
      let cursor = 0;
      const clips = track.clips.map((clip, i) => {
        if (clip.type !== "video") return clip;
        const updated: VideoClip = { ...clip, startMs: cursor };
        cursor += clip.durationMs - (i < track.clips.length - 1 ? fadeMs : 0);
        return updated;
      });
      return { ...track, clips };
    }

    if (track.type === "music") {
      const clips = track.clips.map((clip) =>
        clip.type === "music"
          ? ({ ...clip, volume: 0.5 } satisfies MusicClip)
          : clip,
      );
      return { ...track, clips };
    }

    return track;
  });
}
