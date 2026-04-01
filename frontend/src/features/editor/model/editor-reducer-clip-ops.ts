import type { EditorState, EditorAction, Track, Clip } from "../types/editor";
import { splitClip } from "../utils/split-clip";
import { clampMoveToFreeSpace, hasCollision } from "../utils/clip-constraints";
import { estimateReadingDurationMs } from "../utils/text-segments";
import {
  computeDuration,
  pushPastTracks,
  removeClipFromTracks,
  updateClipInTracks,
} from "./editor-reducer-helpers";

export function reduceClipOps(
  state: EditorState,
  action: EditorAction
): EditorState | null {
  switch (action.type) {
    case "ADD_CLIP": {
      const newTracks = state.tracks.map((t) =>
        t.id === action.trackId
          ? {
              ...t,
              clips: [...t.clips, { ...action.clip, locallyModified: true }],
            }
          : t
      );
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
      };
    }

    case "ADD_CLIP_AUTO_PROMOTE": {
      const { preferredTrackId, clip } = action;
      const preferredTrack = state.tracks.find((t) => t.id === preferredTrackId);

      if (!preferredTrack || preferredTrack.type !== "video") {
        const newTracks = state.tracks.map((t) =>
          t.id === preferredTrackId
            ? { ...t, clips: [...t.clips, { ...clip, locallyModified: true }] }
            : t
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
          t.id === targetTrack.id
            ? { ...t, clips: [...t.clips, { ...clip, locallyModified: true }] }
            : t
        );
      } else {
        const newTrack: Track = {
          id: crypto.randomUUID(),
          type: "video",
          name: `Video ${videoTracks.length + 1}`,
          muted: false,
          locked: false,
          clips: [{ ...clip, locallyModified: true }],
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
      let patch: Partial<Clip> = { ...action.patch, locallyModified: true };

      if ("textContent" in action.patch) {
        const maxMs = estimateReadingDurationMs(action.patch.textContent ?? "");
        patch.sourceMaxDurationMs = maxMs;
        if (maxMs !== undefined) patch.durationMs = maxMs;
      }

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
            if (c) return c.enabled === false ? true : false;
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
        startMs: action.startMs,
        locallyModified: true,
      };

      const clampedStart = clampMoveToFreeSpace(
        track,
        newClip.id,
        newClip.startMs,
        newClip.durationMs
      );
      newClip.startMs = clampedStart;

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
        const result = splitClip(track.clips[idx], action.atMs);
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
          startMs: trackEnd,
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
      const newTracks = updateClipInTracks(state.tracks, action.clipId, {
        startMs: action.startMs,
        locallyModified: true,
      });
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
      };
    }

    default:
      return null;
  }
}
