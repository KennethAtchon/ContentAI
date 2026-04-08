import type {
  Track,
  Clip,
  ClipPatch,
  EditorState,
  EditorHistorySnapshot,
} from "../types/editor";
import { isMediaClip } from "../utils/clip-types";

function compareClipsByTimeline(a: Clip, b: Clip): number {
  if (a.startMs !== b.startMs) return a.startMs - b.startMs;
  if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
  return a.id.localeCompare(b.id);
}

export function snapshotEditorState(state: EditorState): EditorHistorySnapshot {
  return {
    tracks: state.tracks,
    resolution: state.resolution,
    fps: state.fps,
    title: state.title,
    playbackRate: state.playbackRate,
  };
}

export const DEFAULT_TRACKS: Track[] = [
  {
    id: "video",
    type: "video",
    name: "Video 1",
    muted: false,
    locked: false,
    clips: [],
    transitions: [],
  },
  {
    id: "audio",
    type: "audio",
    name: "Audio",
    muted: false,
    locked: false,
    clips: [],
    transitions: [],
  },
  {
    id: "music",
    type: "music",
    name: "Music",
    muted: false,
    locked: false,
    clips: [],
    transitions: [],
  },
  {
    id: "text",
    type: "text",
    name: "Text",
    muted: false,
    locked: false,
    clips: [],
    transitions: [],
  },
];

export const INITIAL_EDITOR_STATE: EditorState = {
  editProjectId: null,
  title: "Untitled Edit",
  durationMs: 0,
  fps: 30,
  resolution: "1080x1920",
  currentTimeMs: 0,
  isPlaying: false,
  playbackRate: 1,
  zoom: 40,
  tracks: DEFAULT_TRACKS,
  selectedClipId: null,
  clipboardClip: null,
  clipboardSourceTrackId: null,
  past: [],
  future: [],
  exportJobId: null,
  exportStatus: null,
  isReadOnly: false,
};

export function computeDuration(tracks: Track[]): number {
  let max = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const end = clip.startMs + clip.durationMs;
      if (end > max) max = end;
    }
  }
  return max;
}

export function hydrateClip(clip: Clip): Clip {
  return {
    ...clip,
    locallyModified: clip.locallyModified ?? false,
  };
}

export function alignClipTrimEndToInvariant(clip: Clip): Clip {
  clip = hydrateClip(clip);
  if (!isMediaClip(clip)) return clip;
  const sm = clip.sourceMaxDurationMs;
  if (sm === undefined || clip.assetId == null) return clip;
  if (clip.type === "video" && clip.isPlaceholder) return clip;
  const ts = clip.trimStartMs ?? 0;
  const d = clip.durationMs ?? 0;
  const te = Math.max(0, sm - ts - d);
  if (te === (clip.trimEndMs ?? 0)) return clip;
  return { ...clip, trimEndMs: te };
}

export function alignTracksTrimInvariant(tracks: Track[]): Track[] {
  return tracks.map((t) => ({
    ...t,
    clips: t.clips.map(alignClipTrimEndToInvariant),
  }));
}

export function sanitizeTracksNoOverlap(tracks: Track[]): Track[] {
  return tracks.map((track) => {
    if (track.clips.length < 2) {
      return {
        ...track,
        clips: track.clips.map(alignClipTrimEndToInvariant),
      };
    }

    const ordered = [...track.clips].sort(compareClipsByTimeline);
    let changed = false;
    let cursor = 0;

    const clips = ordered.map((clip) => {
      const aligned = alignClipTrimEndToInvariant(clip);
      const safeStart = Math.max(cursor, Math.max(0, aligned.startMs));
      cursor = safeStart + aligned.durationMs;
      if (safeStart === aligned.startMs) {
        return aligned;
      }
      changed = true;
      return { ...aligned, startMs: safeStart };
    });

    const sameOrder =
      !changed &&
      clips.length === track.clips.length &&
      clips.every((clip, index) => clip === track.clips[index]);

    if (sameOrder) return track;
    return { ...track, clips };
  });
}

function sanitizeClipPatch(clip: Clip, patch: ClipPatch): ClipPatch {
  const patchRecord = patch as Partial<Record<string, unknown>>;
  const pick = (...keys: string[]) =>
    Object.fromEntries(
      keys
        .filter((key) => Object.prototype.hasOwnProperty.call(patchRecord, key))
        .map((key) => [key, patchRecord[key]]),
    ) as ClipPatch;

  switch (clip.type) {
    case "video":
      return pick(
        "startMs",
        "durationMs",
        "locallyModified",
        "label",
        "enabled",
        "speed",
        "opacity",
        "warmth",
        "contrast",
        "positionX",
        "positionY",
        "scale",
        "rotation",
        "assetId",
        "trimStartMs",
        "trimEndMs",
        "sourceMaxDurationMs",
        "volume",
        "muted",
        "isPlaceholder",
        "placeholderShotIndex",
        "placeholderLabel",
        "placeholderStatus",
      );
    case "audio":
    case "music":
      return pick(
        "startMs",
        "durationMs",
        "locallyModified",
        "label",
        "enabled",
        "speed",
        "opacity",
        "warmth",
        "contrast",
        "positionX",
        "positionY",
        "scale",
        "rotation",
        "assetId",
        "trimStartMs",
        "trimEndMs",
        "sourceMaxDurationMs",
        "volume",
        "muted",
      );
    case "text":
      return pick(
        "startMs",
        "durationMs",
        "locallyModified",
        "label",
        "enabled",
        "speed",
        "opacity",
        "warmth",
        "contrast",
        "positionX",
        "positionY",
        "scale",
        "rotation",
        "textContent",
        "textAutoChunk",
        "textStyle",
      );
    case "caption":
      return pick(
        "startMs",
        "durationMs",
        "locallyModified",
        "originVoiceoverClipId",
        "captionDocId",
        "sourceStartMs",
        "sourceEndMs",
        "stylePresetId",
        "styleOverrides",
        "groupingMs",
      );
  }
}

export function updateClipInTracks(
  tracks: Track[],
  clipId: string,
  patch: ClipPatch
): Track[] {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (clip.id !== clipId) return clip;
      const nextClip = {
        ...clip,
        ...sanitizeClipPatch(clip, patch),
      } as Clip;
      return alignClipTrimEndToInvariant(nextClip);
    }),
  }));
}

export function removeClipFromTracks(tracks: Track[], clipId: string): Track[] {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((c) => c.id !== clipId),
  }));
}

export function pushPastTracks(state: EditorState, newTracks: Track[]): Pick<EditorState, "past" | "future" | "tracks"> {
  return {
    past: [...state.past, snapshotEditorState(state)].slice(-50),
    future: [],
    tracks: sanitizeTracksNoOverlap(newTracks),
  };
}
