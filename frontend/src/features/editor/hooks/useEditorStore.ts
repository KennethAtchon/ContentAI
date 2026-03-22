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
  zoom: 40, // px/s
  tracks: DEFAULT_TRACKS,
  selectedClipId: null,
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

    case "SET_ZOOM":
      return { ...state, zoom: Math.max(5, Math.min(200, action.zoom)) };

    case "SELECT_CLIP":
      return { ...state, selectedClipId: action.clipId };

    case "ADD_CLIP": {
      const newTracks = state.tracks.map((t) =>
        t.id === action.trackId ? { ...t, clips: [...t.clips, action.clip] } : t
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
      const newTracks = updateClipInTracks(
        state.tracks,
        action.clipId,
        action.patch
      );
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

    case "SPLIT_CLIP": {
      let newTracks = state.tracks;
      for (const track of state.tracks) {
        const idx = track.clips.findIndex((c) => c.id === action.clipId);
        if (idx === -1) continue;
        const result = splitClip(track.clips[idx], action.atMs);
        if (!result) break; // atMs not inside clip — no-op
        const newClips = [
          ...track.clips.slice(0, idx),
          result[0],
          result[1],
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
        const copy: Clip = {
          ...clip,
          id: crypto.randomUUID(),
          startMs: clip.startMs + clip.durationMs,
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
      });
      return {
        ...state,
        past: [...state.past, state.tracks].slice(-50),
        future: [],
        tracks: newTracks,
        durationMs: computeDuration(newTracks),
      };
    }

    case "TOGGLE_TRACK_MUTE":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.trackId ? { ...t, muted: !t.muted } : t
        ),
      };

    case "TOGGLE_TRACK_LOCK":
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.trackId ? { ...t, locked: !t.locked } : t
        ),
      };

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
        reorderedClips.push({ ...clip, startMs: cursor });
        cursor += clip.durationMs;
      }

      const newTracks = state.tracks.map((t) =>
        t.type === "video" ? { ...t, clips: reorderedClips } : t
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

  return {
    state,
    dispatch,
    loadProject,
    setTitle,
    setResolution,
    setCurrentTime,
    setPlaying,
    setZoom,
    selectClip,
    addClip,
    updateClip,
    removeClip,
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
  };
}

export type EditorStore = ReturnType<typeof useEditorReducer>;
