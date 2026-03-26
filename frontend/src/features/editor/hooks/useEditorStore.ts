import { useReducer, useCallback } from "react";
import type {
  EditorState,
  EditorAction,
  Track,
  Clip,
  EditProject,
  ExportJobStatus,
  CaptionWord,
  Transition,
} from "../types/editor";
import { splitClip } from "../utils/split-clip";
import { clampMoveToFreeSpace } from "../utils/clip-constraints";

const DEFAULT_TRACKS: Track[] = [
  {
    id: "video",
    type: "video",
    name: "Video",
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
  zoom: 40, // px/s
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

function computeDuration(tracks: Track[]): number {
  let max = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const end = clip.startMs + clip.durationMs;
      if (end > max) max = end;
    }
  }
  return max;
}

function updateClipInTracks(
  tracks: Track[],
  clipId: string,
  patch: Partial<Clip>
): Track[] {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
  }));
}

function removeClipFromTracks(tracks: Track[], clipId: string): Track[] {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((c) => c.id !== clipId),
  }));
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "LOAD_PROJECT": {
      const { project } = action;
      const tracks =
        project.tracks && project.tracks.length > 0
          ? project.tracks
          : DEFAULT_TRACKS;
      return {
        ...state,
        editProjectId: project.id,
        title: project.title ?? "Untitled Edit",
        durationMs: project.durationMs,
        fps: project.fps,
        resolution: project.resolution,
        tracks,
        selectedClipId: null,
        clipboardClip: null,
        clipboardSourceTrackId: null,
        past: [],
        future: [],
        isReadOnly: project.status === "published",
      };
    }

    case "SET_TITLE":
      return { ...state, title: action.title };

    case "SET_RESOLUTION":
      return { ...state, resolution: action.resolution };

    case "SET_CURRENT_TIME":
      return { ...state, currentTimeMs: Math.max(0, action.ms) };

    case "SET_PLAYING":
      return { ...state, isPlaying: action.playing };

    case "SET_PLAYBACK_RATE":
      return { ...state, playbackRate: action.rate };

    case "SET_ZOOM":
      return { ...state, zoom: Math.max(5, Math.min(200, action.zoom)) };

    case "SELECT_CLIP":
      return { ...state, selectedClipId: action.clipId };

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
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
        durationMs: computeDuration(newTracks),
      };
    }

    case "UPDATE_CLIP": {
      const newTracks = updateClipInTracks(state.tracks, action.clipId, {
        ...action.patch,
        locallyModified: true,
      });
      return {
        ...state,
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
        durationMs: computeDuration(newTracks),
      };
    }

    case "REMOVE_CLIP": {
      const newTracks = removeClipFromTracks(state.tracks, action.clipId);
      return {
        ...state,
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
        selectedClipId:
          state.selectedClipId === action.clipId ? null : state.selectedClipId,
        durationMs: computeDuration(newTracks),
      };
    }

    case "RIPPLE_DELETE_CLIP": {
      // Find the clip, remove it, and shift all subsequent clips on the same
      // track left by the deleted clip's duration to close the gap.
      let newTracks = state.tracks;
      for (const track of state.tracks) {
        const clip = track.clips.find((c) => c.id === action.clipId);
        if (!clip) continue;
        const newClips = track.clips
          .filter((c) => c.id !== action.clipId)
          .map((c) =>
            c.startMs > clip.startMs
              ? { ...c, startMs: c.startMs - clip.durationMs, locallyModified: true as const }
              : c
          );
        // Also drop transitions that referenced the deleted clip
        const newTransitions = (track.transitions ?? []).filter(
          (tr) => tr.clipAId !== action.clipId && tr.clipBId !== action.clipId
        );
        newTracks = state.tracks.map((t) =>
          t.id === track.id ? { ...t, clips: newClips, transitions: newTransitions } : t
        );
        break;
      }
      if (newTracks === state.tracks) return state;
      return {
        ...state,
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
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
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
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

      // Clamp to free space
      const clampedStart = clampMoveToFreeSpace(
        track,
        newClip.id,
        newClip.startMs,
        newClip.durationMs
      );
      newClip.startMs = clampedStart;

      const newTracks = state.tracks.map((t) =>
        t.id === action.trackId
          ? { ...t, clips: [...t.clips, newClip] }
          : t
      );
      return {
        ...state,
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
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
        if (!result) break; // atMs not inside clip — no-op
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
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
        durationMs: computeDuration(newTracks),
      };
    }

    case "DUPLICATE_CLIP": {
      let newTracks = state.tracks;
      for (const track of state.tracks) {
        const clip = track.clips.find((c) => c.id === action.clipId);
        if (!clip) continue;
        const proposedStart = clip.startMs + clip.durationMs;
        const clampedStart = clampMoveToFreeSpace(
          track,
          "new", // placeholder id that won't match any existing clip
          proposedStart,
          clip.durationMs
        );
        const copy: Clip = {
          ...clip,
          id: crypto.randomUUID(),
          startMs: clampedStart,
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
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
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
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
        durationMs: computeDuration(newTracks),
      };
    }

    case "TOGGLE_TRACK_MUTE": {
      const newTracks = state.tracks.map((t) =>
        t.id === action.trackId ? { ...t, muted: !t.muted } : t
      );
      return {
        ...state,
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
      };
    }

    case "TOGGLE_TRACK_LOCK": {
      const newTracks = state.tracks.map((t) =>
        t.id === action.trackId ? { ...t, locked: !t.locked } : t
      );
      return {
        ...state,
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
      };
    }

    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        future: [state.tracks, ...state.future],
        tracks: previous,
        durationMs: computeDuration(previous),
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        past: [...state.past, state.tracks],
        future: state.future.slice(1),
        tracks: next,
        durationMs: computeDuration(next),
      };
    }

    case "SET_EXPORT_JOB":
      return { ...state, exportJobId: action.jobId };

    case "SET_EXPORT_STATUS":
      return { ...state, exportStatus: action.status };

    case "ADD_CAPTION_CLIP": {
      const captionClip: Clip = {
        id: crypto.randomUUID(),
        assetId: action.assetId,
        label: "Captions",
        startMs: action.startMs,
        durationMs: action.durationMs,
        trimStartMs: 0,
        trimEndMs: 0,
        speed: 1,
        opacity: 1,
        warmth: 0,
        contrast: 0,
        positionX: 0,
        positionY: 0,
        scale: 1,
        rotation: 0,
        volume: 0,
        muted: true,
        captionId: action.captionId,
        captionWords: action.captionWords,
        captionPresetId: action.presetId,
        captionGroupSize: 3,
        captionPositionY: 80,
        locallyModified: true,
      };

      const newTracks = state.tracks.map((t) =>
        t.id === "text" ? { ...t, clips: [...t.clips, captionClip] } : t
      );

      return {
        ...state,
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
        durationMs: computeDuration(newTracks),
        selectedClipId: captionClip.id,
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
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
      };
    }

    case "REORDER_SHOTS": {
      const videoTrack = state.tracks.find((t) => t.type === "video");
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

      // Remap transitions to match the new clip order (by index adjacency).
      const oldTransitions = videoTrack.transitions ?? [];
      const newTransitions = reorderedClips.slice(0, -1).flatMap((clipA, idx) => {
        const clipB = reorderedClips[idx + 1];
        const existing = oldTransitions.find(
          (tr) => tr.clipAId === clipA.id && tr.clipBId === clipB.id
        );
        return existing ? [existing] : [];
      });

      const newTracks = state.tracks.map((t) =>
        t.type === "video"
          ? { ...t, clips: reorderedClips, transitions: newTransitions }
          : t
      );

      return {
        ...state,
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
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
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
      };
    }

    case "MERGE_TRACKS_FROM_SERVER": {
      const serverTracks = action.tracks;
      const merged = state.tracks.map((localTrack) => {
        // Match by id first (preserves user-added extra tracks), fall back to type
        const serverTrack =
          serverTracks.find((t) => t.id === localTrack.id) ??
          serverTracks.find((t) => t.type === localTrack.type);
        if (!serverTrack) return localTrack;

        if (localTrack.type === "video") {
          // Server timeline is canonical while reels generate (buildInitialTimeline +
          // refreshEditorTimeline sequentialize video on the backend). Prefer the
          // server's clip order and timing; only keep local clips the user edited.
          const videoLocallyModified = localTrack.clips.some(
            (c) => c.locallyModified,
          );
          if (!videoLocallyModified) {
            return {
              ...localTrack,
              clips: serverTrack.clips.map((c) => ({ ...c })),
              transitions: serverTrack.transitions ?? localTrack.transitions ?? [],
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
            transitions: serverTrack.transitions ?? localTrack.transitions ?? [],
          };
        }

        if (
          localTrack.type === "audio" ||
          localTrack.type === "music" ||
          localTrack.type === "text"
        ) {
          // Per-clip merge: locally modified clips are preserved; others take
          // the server version. New server clips are appended.
          const localClipMap = new Map(localTrack.clips.map((c) => [c.id, c]));
          const serverClipMap = new Map(serverTrack.clips.map((c) => [c.id, c]));

          const mergedClips = serverTrack.clips.map((sc) => {
            const local = localClipMap.get(sc.id);
            return local?.locallyModified ? local : sc;
          });

          // Keep local-only clips (not yet on server) that are locally modified
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
        tracks: merged,
        durationMs: computeDuration(merged),
      };
    }

    case "ADD_TRACK": {
      return {
        ...state,
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: [...state.tracks, action.track],
      };
    }

    case "REMOVE_TRACK": {
      const newTracks = state.tracks.filter((t) => t.id !== action.trackId);
      return {
        ...state,
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
        durationMs: computeDuration(newTracks),
        selectedClipId: state.tracks
          .find((t) => t.id === action.trackId)
          ?.clips.some((c) => c.id === state.selectedClipId)
          ? null
          : state.selectedClipId,
      };
    }

    default:
      return state;
  }
}

export function useEditorReducer() {
  const [state, dispatch] = useReducer(editorReducer, INITIAL_EDITOR_STATE);

  const loadProject = useCallback(
    (project: EditProject) => dispatch({ type: "LOAD_PROJECT", project }),
    []
  );
  const setTitle = useCallback(
    (title: string) => dispatch({ type: "SET_TITLE", title }),
    []
  );
  const setResolution = useCallback(
    (resolution: string) => dispatch({ type: "SET_RESOLUTION", resolution }),
    []
  );
  const setCurrentTime = useCallback(
    (ms: number) => dispatch({ type: "SET_CURRENT_TIME", ms }),
    []
  );
  const setPlaying = useCallback(
    (playing: boolean) => dispatch({ type: "SET_PLAYING", playing }),
    []
  );
  const setPlaybackRate = useCallback(
    (rate: number) => dispatch({ type: "SET_PLAYBACK_RATE", rate }),
    []
  );
  const setZoom = useCallback(
    (zoom: number) => dispatch({ type: "SET_ZOOM", zoom }),
    []
  );
  const selectClip = useCallback(
    (clipId: string | null) => dispatch({ type: "SELECT_CLIP", clipId }),
    []
  );
  const addClip = useCallback(
    (trackId: string, clip: Clip) =>
      dispatch({ type: "ADD_CLIP", trackId, clip }),
    []
  );
  const updateClip = useCallback(
    (clipId: string, patch: Partial<Clip>) =>
      dispatch({ type: "UPDATE_CLIP", clipId, patch }),
    []
  );
  const removeClip = useCallback(
    (clipId: string) => dispatch({ type: "REMOVE_CLIP", clipId }),
    []
  );
  const rippleDeleteClip = useCallback(
    (clipId: string) => dispatch({ type: "RIPPLE_DELETE_CLIP", clipId }),
    []
  );
  const toggleClipEnabled = useCallback(
    (clipId: string) => dispatch({ type: "TOGGLE_CLIP_ENABLED", clipId }),
    []
  );
  const copyClip = useCallback(
    (clipId: string) => dispatch({ type: "COPY_CLIP", clipId }),
    []
  );
  const pasteClip = useCallback(
    (trackId: string, startMs: number) =>
      dispatch({ type: "PASTE_CLIP", trackId, startMs }),
    []
  );
  const splitClipAction = useCallback(
    (clipId: string, atMs: number) =>
      dispatch({ type: "SPLIT_CLIP", clipId, atMs }),
    []
  );
  const duplicateClip = useCallback(
    (clipId: string) => dispatch({ type: "DUPLICATE_CLIP", clipId }),
    []
  );
  const moveClip = useCallback(
    (clipId: string, startMs: number) =>
      dispatch({ type: "MOVE_CLIP", clipId, startMs }),
    []
  );
  const toggleTrackMute = useCallback(
    (trackId: string) => dispatch({ type: "TOGGLE_TRACK_MUTE", trackId }),
    []
  );
  const toggleTrackLock = useCallback(
    (trackId: string) => dispatch({ type: "TOGGLE_TRACK_LOCK", trackId }),
    []
  );
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const setExportJob = useCallback(
    (jobId: string | null) => dispatch({ type: "SET_EXPORT_JOB", jobId }),
    []
  );
  const setExportStatus = useCallback(
    (status: ExportJobStatus | null) =>
      dispatch({ type: "SET_EXPORT_STATUS", status }),
    []
  );
  const addCaptionClip = useCallback(
    (params: {
      captionId: string;
      captionWords: CaptionWord[];
      assetId: string;
      presetId: string;
      startMs: number;
      durationMs: number;
    }) => dispatch({ type: "ADD_CAPTION_CLIP", ...params }),
    []
  );
  const setTransition = useCallback(
    (
      trackId: string,
      clipAId: string,
      clipBId: string,
      transitionType: Transition["type"],
      durationMs: number
    ) =>
      dispatch({
        type: "SET_TRANSITION",
        trackId,
        clipAId,
        clipBId,
        transitionType,
        durationMs,
      }),
    []
  );
  const removeTransition = useCallback(
    (trackId: string, transitionId: string) =>
      dispatch({ type: "REMOVE_TRANSITION", trackId, transitionId }),
    []
  );
  const reorderShots = useCallback(
    (clipIds: string[]) => dispatch({ type: "REORDER_SHOTS", clipIds }),
    []
  );
  const addVideoTrack = useCallback(() => {
    const track: Track = {
      id: crypto.randomUUID(),
      type: "video",
      name: "Video",
      muted: false,
      locked: false,
      clips: [],
      transitions: [],
    };
    dispatch({ type: "ADD_TRACK", track });
  }, []);
  const removeTrack = useCallback(
    (trackId: string) => dispatch({ type: "REMOVE_TRACK", trackId }),
    []
  );

  return {
    state,
    dispatch,
    loadProject,
    setTitle,
    setResolution,
    setCurrentTime,
    setPlaying,
    setPlaybackRate,
    setZoom,
    selectClip,
    addClip,
    updateClip,
    removeClip,
    rippleDeleteClip,
    toggleClipEnabled,
    copyClip,
    pasteClip,
    splitClip: splitClipAction,
    duplicateClip,
    moveClip,
    toggleTrackMute,
    toggleTrackLock,
    undo,
    redo,
    setExportJob,
    setExportStatus,
    addCaptionClip,
    setTransition,
    removeTransition,
    reorderShots,
    addVideoTrack,
    removeTrack,
  };
}

export type EditorStore = ReturnType<typeof useEditorReducer>;
