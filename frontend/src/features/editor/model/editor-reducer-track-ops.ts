import type {
  EditorState,
  EditorAction,
  Clip,
  Track,
  Transition,
} from "../types/editor";
import {
  computeDuration,
  pushPastTracks,
  sanitizeTracksNoOverlap,
} from "./editor-reducer-helpers";

export function reduceTrackOps(
  state: EditorState,
  action: EditorAction
): EditorState | null {
  switch (action.type) {
    case "TOGGLE_TRACK_MUTE": {
      const newTracks = state.tracks.map((t) =>
        t.id === action.trackId ? { ...t, muted: !t.muted } : t
      );
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
      };
    }

    case "TOGGLE_TRACK_LOCK": {
      const newTracks = state.tracks.map((t) =>
        t.id === action.trackId ? { ...t, locked: !t.locked } : t
      );
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
      };
    }

    case "SET_TRANSITION": {
      const track = state.tracks.find((t) => t.id === action.trackId);
      if (!track) return state;

      const clipA = track.clips.find((c) => c.id === action.clipAId);
      const clipB = track.clips.find((c) => c.id === action.clipBId);
      if (!clipA || !clipB) return state;

      const maxDuration = Math.min(clipA.durationMs, clipB.durationMs) - 100;
      const clampedDuration = Math.max(
        200,
        Math.min(action.durationMs, maxDuration)
      );

      const transitions = track.transitions ?? [];
      const existingIdx = transitions.findIndex(
        (t) => t.clipAId === action.clipAId && t.clipBId === action.clipBId
      );

      let newTransitions: Transition[];
      if (existingIdx >= 0) {
        newTransitions = transitions.map((t, idx) =>
          idx === existingIdx
            ? { ...t, type: action.transitionType, durationMs: clampedDuration }
            : t
        );
      } else {
        newTransitions = [
          ...transitions,
          {
            id: crypto.randomUUID(),
            type: action.transitionType,
            durationMs: clampedDuration,
            clipAId: action.clipAId,
            clipBId: action.clipBId,
          },
        ];
      }

      const newTracks = state.tracks.map((t) =>
        t.id === action.trackId ? { ...t, transitions: newTransitions } : t
      );
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
      };
    }

    case "REORDER_SHOTS": {
      const videoTrack = state.tracks.find((t) => t.id === action.trackId);
      if (!videoTrack) return state;

      const clipMap = new Map(videoTrack.clips.map((c) => [c.id, c]));
      let cursor = 0;
      const reorderedClips: Clip[] = [];
      for (const clipId of action.clipIds) {
        const clip = clipMap.get(clipId);
        if (!clip) continue;
        reorderedClips.push({
          ...clip,
          startMs: cursor,
          locallyModified: true,
        });
        cursor += clip.durationMs;
      }

      const oldTransitions = videoTrack.transitions ?? [];
      const newTransitions = reorderedClips
        .slice(0, -1)
        .flatMap((clipA, idx) => {
          const clipB = reorderedClips[idx + 1];
          const existing = oldTransitions.find(
            (tr) => tr.clipAId === clipA.id && tr.clipBId === clipB.id
          );
          return existing ? [existing] : [];
        });

      const newTracks = state.tracks.map((t) =>
        t.id === action.trackId
          ? { ...t, clips: reorderedClips, transitions: newTransitions }
          : t
      );

      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
      };
    }

    case "REMOVE_TRANSITION": {
      const newTracks = state.tracks.map((t) =>
        t.id === action.trackId
          ? {
              ...t,
              transitions: (t.transitions ?? []).filter(
                (tr) => tr.id !== action.transitionId
              ),
            }
          : t
      );
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
      };
    }

    case "MERGE_TRACKS_FROM_SERVER": {
      const serverTracks = action.tracks;
      const merged = state.tracks.map((localTrack) => {
        const serverTrack = serverTracks.find((t) => t.id === localTrack.id);
        if (!serverTrack) return localTrack;

        if (localTrack.type === "video") {
          const videoLocallyModified = localTrack.clips.some(
            (c) => c.locallyModified
          );
          if (!videoLocallyModified) {
            return {
              ...localTrack,
              clips: serverTrack.clips.map((c) => ({ ...c })),
              transitions:
                serverTrack.transitions ?? localTrack.transitions ?? [],
            };
          }

          const mergedClips: Clip[] = [];
          const seen = new Set<string>();
          for (const sc of serverTrack.clips) {
            const local = localTrack.clips.find((lc) => lc.id === sc.id);
            mergedClips.push(local?.locallyModified ? local : sc);
            seen.add(sc.id);
          }
          for (const lc of localTrack.clips) {
            if (!seen.has(lc.id) && lc.locallyModified) mergedClips.push(lc);
          }
          return {
            ...localTrack,
            clips: mergedClips,
            transitions:
              serverTrack.transitions ?? localTrack.transitions ?? [],
          };
        }

        if (
          localTrack.type === "audio" ||
          localTrack.type === "music" ||
          localTrack.type === "text"
        ) {
          const localClipMap = new Map(localTrack.clips.map((c) => [c.id, c]));
          const serverClipMap = new Map(
            serverTrack.clips.map((c) => [c.id, c])
          );

          const mergedClips = serverTrack.clips.map((sc) => {
            const local = localClipMap.get(sc.id);
            return local?.locallyModified ? local : sc;
          });

          for (const lc of localTrack.clips) {
            if (!serverClipMap.has(lc.id) && lc.locallyModified) {
              mergedClips.push(lc);
            }
          }

          return { ...localTrack, clips: mergedClips };
        }

        return localTrack;
      });
      return {
        ...state,
        tracks: sanitizeTracksNoOverlap(merged),
        durationMs: computeDuration(sanitizeTracksNoOverlap(merged)),
      };
    }

    case "ADD_VIDEO_TRACK": {
      const videoCount = state.tracks.filter((t) => t.type === "video").length;
      const track: Track = {
        id: crypto.randomUUID(),
        type: "video",
        name: `Video ${videoCount + 1}`,
        muted: false,
        locked: false,
        clips: [],
        transitions: [],
      };
      const afterIdx = state.tracks.findIndex(
        (t) => t.id === action.afterTrackId
      );
      const newTracks =
        afterIdx >= 0
          ? [
              ...state.tracks.slice(0, afterIdx + 1),
              track,
              ...state.tracks.slice(afterIdx + 1),
            ]
          : [...state.tracks, track];
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
      };
    }

    case "ADD_TRACK": {
      let newTracks: typeof state.tracks;
      if (action.track.type === "video") {
        let insertAt: number;
        if (action.afterTrackId) {
          const idx = state.tracks.findIndex(
            (t) => t.id === action.afterTrackId
          );
          insertAt = idx >= 0 ? idx + 1 : state.tracks.length;
        } else {
          const lastVideoIdx = state.tracks.reduce(
            (last, t, i) => (t.type === "video" ? i : last),
            -1
          );
          insertAt = lastVideoIdx >= 0 ? lastVideoIdx + 1 : state.tracks.length;
        }
        newTracks = [
          ...state.tracks.slice(0, insertAt),
          action.track,
          ...state.tracks.slice(insertAt),
        ];
      } else {
        newTracks = [...state.tracks, action.track];
      }
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
      };
    }

    case "REMOVE_TRACK": {
      const newTracks = state.tracks.filter((t) => t.id !== action.trackId);
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
        durationMs: computeDuration(newTracks),
        selectedClipId: state.tracks
          .find((t) => t.id === action.trackId)
          ?.clips.some((c) => c.id === state.selectedClipId)
          ? null
          : state.selectedClipId,
      };
    }

    case "RENAME_TRACK": {
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.trackId ? { ...t, name: action.name } : t
        ),
      };
    }

    case "REORDER_TRACKS": {
      const trackMap = new Map(state.tracks.map((t) => [t.id, t]));
      const newTracks = action.trackIds
        .map((id) => trackMap.get(id)!)
        .filter(Boolean);
      return {
        ...state,
        ...pushPastTracks(state, newTracks),
      };
    }

    default:
      return null;
  }
}
