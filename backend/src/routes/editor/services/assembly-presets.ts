type EditorClip = {
  id: string;
  assetId: string | null;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  speed: number;
  opacity: number;
  warmth: number;
  contrast: number;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  volume: number;
  muted: boolean;
};

type EditorTrack = {
  id: string;
  type: string;
  name: string;
  muted: boolean;
  locked: boolean;
  clips: EditorClip[];
};

// Standard: shots in original order, full duration — no-op.
export function applyStandardPreset(tracks: EditorTrack[]): EditorTrack[] {
  return tracks;
}

// FastCut: each clip trimmed to min(duration, 3000ms). Recalculates startMs.
export function applyFastCutPreset(tracks: EditorTrack[]): EditorTrack[] {
  const MAX_CLIP_MS = 3000;
  return tracks.map((track) => {
    if (track.type !== "video") return track;

    let cursor = 0;
    const clips = track.clips.map((clip) => {
      const trimmedDuration = Math.min(clip.durationMs, MAX_CLIP_MS);
      const newTrimEndMs = Math.min(
        clip.trimEndMs,
        clip.trimStartMs + trimmedDuration,
      );
      const updated = {
        ...clip,
        startMs: cursor,
        durationMs: trimmedDuration,
        trimEndMs: newTrimEndMs,
      };
      cursor += trimmedDuration;
      return updated;
    });

    return { ...track, clips };
  });
}

// Cinematic: overlapping clips (fade feel) + music at 50%.
export function applyCinematicPreset(tracks: EditorTrack[]): EditorTrack[] {
  const FADE_MS = 500;

  return tracks.map((track) => {
    if (track.type === "video") {
      let cursor = 0;
      const clips = track.clips.map((clip, i) => {
        const updated = { ...clip, startMs: cursor };
        cursor += clip.durationMs - (i < track.clips.length - 1 ? FADE_MS : 0);
        return updated;
      });
      return { ...track, clips };
    }

    if (track.type === "music") {
      const clips = track.clips.map((clip) => ({ ...clip, volume: 0.5 }));
      return { ...track, clips };
    }

    return track;
  });
}
