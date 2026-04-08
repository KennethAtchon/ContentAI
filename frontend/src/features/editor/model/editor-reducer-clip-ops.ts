import type {
  EditorState,
  EditorAction,
  Track,
  CaptionClip,
  Clip,
  ClipPatch,
} from "../types/editor";
import { splitClip } from "../utils/split-clip";
import { enforceNoOverlap, hasCollision } from "../utils/clip-constraints";
import { estimateReadingDurationMs } from "../utils/text-segments";
import { isCaptionClip, isMediaClip } from "../utils/clip-types";
import {
  computeDuration,
  pushPastTracks,
  removeClipFromTracks,
  updateClipInTracks,
} from "./editor-reducer-helpers";

function findTrackByClipId(tracks: Track[], clipId: string): Track | null {
  return tracks.find((track) => track.clips.some((clip) => clip.id === clipId)) ?? null;
}

function isValidCaptionClipRange(action: {
  durationMs: number;
  sourceStartMs: number;
  sourceEndMs: number;
}): boolean {
  return action.durationMs > 0 && action.sourceStartMs < action.sourceEndMs;
}

export function reduceClipOps(
  state: EditorState,
  action: EditorAction
): EditorState | null {
  switch (action.type) {
    case "ADD_CLIP": {
      const newTracks = state.tracks.map((t) =>
        t.id !== action.trackId
          ? t
          : {
              ...t,
              clips: [
                ...t.clips,
                {
                  ...action.clip,
                  startMs: enforceNoOverlap(
                    t,
                    action.clip.id,
                    action.clip.startMs,
                    action.clip.durationMs
                  ),
                  locallyModified: true,
                  source: "user" as const,
                },
              ],
            }
      );
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
      };
    }

    case "ADD_CAPTION_CLIP": {
      if (!isValidCaptionClipRange(action)) {
        return state;
      }

      const captionClip: CaptionClip = {
        id: crypto.randomUUID(),
        type: "caption",
        captionDocId: action.captionDocId,
        originVoiceoverClipId: action.originVoiceoverClipId,
        startMs: action.startMs,
        durationMs: action.durationMs,
        sourceStartMs: action.sourceStartMs,
        sourceEndMs: action.sourceEndMs,
        stylePresetId: action.presetId,
        styleOverrides: {},
        groupingMs: action.groupingMs ?? 1400,
        locallyModified: true,
      };
      const newTracks = state.tracks.map((t) =>
        t.id !== action.trackId
          ? t
          : {
              ...t,
              clips: [
                ...t.clips,
                {
                  ...captionClip,
                  startMs: enforceNoOverlap(
                    t,
                    captionClip.id,
                    captionClip.startMs,
                    captionClip.durationMs
                  ),
                },
              ],
            }
      );
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
        selectedClipId: captionClip.id,
      };
    }

    case "ADD_CLIP_AUTO_PROMOTE": {
      const { preferredTrackId, clip } = action;
      const preferredTrack = state.tracks.find((t) => t.id === preferredTrackId);

      if (!preferredTrack || preferredTrack.type !== "video") {
        const newTracks = state.tracks.map((t) =>
          t.id !== preferredTrackId
            ? t
            : {
                ...t,
                clips: [
                  ...t.clips,
                  {
                    ...clip,
                    startMs: enforceNoOverlap(t, clip.id, clip.startMs, clip.durationMs),
                    locallyModified: true,
                    source: "user" as const,
                  },
                ],
              }
        );
        return {
          ...state,
          ...pushPastTracks(state, newTracks),
          durationMs: computeDuration(newTracks),
        };
      }

      const videoTracks = state.tracks.filter((t) => t.type === "video");
      const preferredIdx = videoTracks.findIndex((t) => t.id === preferredTrackId);
      const ordered = [
        ...videoTracks.slice(preferredIdx),
        ...videoTracks.slice(0, preferredIdx),
      ];
      const targetTrack = ordered.find(
        (t) => !hasCollision(t, clip.startMs, clip.durationMs)
      );

      let newTracks: Track[];

      if (targetTrack) {
        newTracks = state.tracks.map((t) =>
          t.id !== targetTrack.id
            ? t
            : {
                ...t,
                clips: [
                  ...t.clips,
                  {
                    ...clip,
                    startMs: enforceNoOverlap(
                      t,
                      clip.id,
                      clip.startMs,
                      clip.durationMs
                    ),
                    locallyModified: true,
                    source: "user" as const,
                  },
                ],
              }
        );
      } else {
        const newTrack: Track = {
          id: crypto.randomUUID(),
          type: "video",
          name: `Video ${videoTracks.length + 1}`,
          muted: false,
          locked: false,
          clips: [{ ...clip, locallyModified: true, source: "user" as const }],
          transitions: [],
        };
        const lastVideoIdx = state.tracks.reduce(
          (last, t, i) => (t.type === "video" ? i : last),
          0
        );
        newTracks = [
          ...state.tracks.slice(0, lastVideoIdx + 1),
          newTrack,
          ...state.tracks.slice(lastVideoIdx + 1),
        ];
      }

      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
      };
    }

    case "UPDATE_CLIP": {
      let patch: ClipPatch = { ...action.patch, locallyModified: true };

      if ("textContent" in action.patch && typeof action.patch.textContent === "string") {
        const maxMs = estimateReadingDurationMs(action.patch.textContent ?? "");
        patch = {
          ...patch,
          durationMs: maxMs,
        };
      }

      const track = findTrackByClipId(state.tracks, action.clipId);
      const currentClip = track?.clips.find((clip) => clip.id === action.clipId);
      if (
        track &&
        currentClip &&
        (Object.prototype.hasOwnProperty.call(action.patch, "startMs") ||
          Object.prototype.hasOwnProperty.call(action.patch, "durationMs"))
      ) {
        const nextDuration =
          typeof patch.durationMs === "number" ? patch.durationMs : currentClip.durationMs;
        const nextStart =
          typeof patch.startMs === "number" ? patch.startMs : currentClip.startMs;
        patch = {
          ...patch,
          startMs: enforceNoOverlap(track, currentClip.id, nextStart, nextDuration),
        };
      }

      const newTracks = updateClipInTracks(state.tracks, action.clipId, patch);
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
      };
    }

    case "UPDATE_CAPTION_STYLE": {
      const target = state.tracks
        .flatMap((track) => track.clips)
        .find((clip) => clip.id === action.clipId);
      if (!target || !isCaptionClip(target)) {
        return state;
      }

      const patch: ClipPatch = {
        locallyModified: true,
        stylePresetId: action.presetId ?? target.stylePresetId,
        styleOverrides: {
          ...target.styleOverrides,
          ...(action.overrides ?? {}),
        },
        groupingMs: action.groupingMs ?? target.groupingMs,
      };

      const newTracks = updateClipInTracks(state.tracks, action.clipId, patch);
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
      };
    }

    case "REMOVE_CLIP": {
      const newTracks = removeClipFromTracks(state.tracks, action.clipId);
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        selectedClipId:
          state.selectedClipId === action.clipId ? null : state.selectedClipId,
        durationMs: computeDuration(newTracks),
      };
    }

    case "RIPPLE_DELETE_CLIP": {
      let newTracks = state.tracks;
      for (const track of state.tracks) {
        const clip = track.clips.find((c) => c.id === action.clipId);
        if (!clip) continue;
        const newClips = track.clips
          .filter((c) => c.id !== action.clipId)
          .map((c) =>
            c.startMs > clip.startMs
              ? {
                  ...c,
                  startMs: c.startMs - clip.durationMs,
                  locallyModified: true as const,
                }
              : c
          );
        const newTransitions = (track.transitions ?? []).filter(
          (tr) => tr.clipAId !== action.clipId && tr.clipBId !== action.clipId
        );
        newTracks = state.tracks.map((t) =>
          t.id === track.id
            ? { ...t, clips: newClips, transitions: newTransitions }
            : t
        );
        break;
      }
      if (newTracks === state.tracks) return state;
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        selectedClipId:
          state.selectedClipId === action.clipId ? null : state.selectedClipId,
        durationMs: computeDuration(newTracks),
      };
    }

    case "TOGGLE_CLIP_ENABLED": {
      const newTracks = updateClipInTracks(state.tracks, action.clipId, {
        enabled: (() => {
          for (const t of state.tracks) {
            const c = t.clips.find((cl) => cl.id === action.clipId);
            if (c && !isCaptionClip(c)) return c.enabled === false ? true : false;
          }
          return false;
        })(),
        locallyModified: true,
      });
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
      };
    }

    case "COPY_CLIP": {
      for (const track of state.tracks) {
        const clip = track.clips.find((c) => c.id === action.clipId);
        if (clip)
          return {
            ...state,
            clipboardClip: clip,
            clipboardSourceTrackId: track.id,
          };
      }
      return state;
    }

    case "PASTE_CLIP": {
      if (!state.clipboardClip) return state;
      const track = state.tracks.find((t) => t.id === action.trackId);
      if (!track) return state;

      const newClip: Clip = {
        ...state.clipboardClip,
        id: crypto.randomUUID(),
        startMs: enforceNoOverlap(
          track,
          state.clipboardClip.id,
          action.startMs,
          state.clipboardClip.durationMs
        ),
        locallyModified: true,
        source: "user" as const,
      };

      const newTracks = state.tracks.map((t) =>
        t.id === action.trackId ? { ...t, clips: [...t.clips, newClip] } : t
      );
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
        selectedClipId: newClip.id,
      };
    }

    case "SPLIT_CLIP": {
      let newTracks = state.tracks;
      for (const track of state.tracks) {
        const idx = track.clips.findIndex((c) => c.id === action.clipId);
        if (idx === -1) continue;
        const clip = track.clips[idx];
        if (!isMediaClip(clip)) break;
        const result = splitClip(clip, action.atMs);
        if (!result) break;
        const newClips = [
          ...track.clips.slice(0, idx),
          { ...result[0], locallyModified: true },
          { ...result[1], locallyModified: true },
          ...track.clips.slice(idx + 1),
        ];
        newTracks = state.tracks.map((t) =>
          t.id === track.id ? { ...t, clips: newClips } : t
        );
        break;
      }
      if (newTracks === state.tracks) return state;
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
      };
    }

    case "DUPLICATE_CLIP": {
      let newTracks = state.tracks;
      for (const track of state.tracks) {
        const clip = track.clips.find((c) => c.id === action.clipId);
        if (!clip) continue;
        const trackEnd = track.clips.reduce(
          (max, c) => Math.max(max, c.startMs + c.durationMs),
          0
        );
        const copy: Clip = {
          ...clip,
          id: crypto.randomUUID(),
          startMs: enforceNoOverlap(track, clip.id, trackEnd, clip.durationMs),
          locallyModified: true,
        };
        newTracks = state.tracks.map((t) =>
          t.id === track.id ? { ...t, clips: [...t.clips, copy] } : t
        );
        break;
      }
      if (newTracks === state.tracks) return state;
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
      };
    }

    case "MOVE_CLIP": {
      const track = findTrackByClipId(state.tracks, action.clipId);
      const clip = track?.clips.find((item) => item.id === action.clipId);
      if (!track || !clip) return state;
      const newTracks = updateClipInTracks(state.tracks, action.clipId, {
        startMs: enforceNoOverlap(track, action.clipId, action.startMs, clip.durationMs),
        locallyModified: true,
      });
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
      };
    }

    case "MARK_CAPTION_STALE": {
      const newTracks = updateClipInTracks(state.tracks, action.clipId, {
        stale: true,
        locallyModified: true,
      });
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
      };
    }

    default:
      return null;
  }
}
