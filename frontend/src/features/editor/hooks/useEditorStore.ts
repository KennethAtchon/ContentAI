import { useReducer, useCallback } from "react";
import type {
  EditorState,
  EditorAction,
  Track,
  Clip,
  EditProject,
  ExportJobStatus,
} from "../types/editor";

const DEFAULT_TRACKS: Track[] = [
  {
    id: "video",
    type: "video",
    name: "Video",
    muted: false,
    locked: false,
    clips: [],
  },
  {
    id: "audio",
    type: "audio",
    name: "Audio",
    muted: false,
    locked: false,
    clips: [],
  },
  {
    id: "music",
    type: "music",
    name: "Music",
    muted: false,
    locked: false,
    clips: [],
  },
  {
    id: "text",
    type: "text",
    name: "Text",
    muted: false,
    locked: false,
    clips: [],
  },
];

export const INITIAL_EDITOR_STATE: EditorState = {
  editProjectId: null,
  title: "Untitled Edit",
  durationMs: 0,
  fps: 30,
  resolution: "1080p",
  currentTimeMs: 0,
  isPlaying: false,
  zoom: 40, // px/s
  tracks: DEFAULT_TRACKS,
  selectedClipId: null,
  past: [],
  future: [],
  exportJobId: null,
  exportStatus: null,
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
        title: project.title,
        durationMs: project.durationMs,
        fps: project.fps,
        resolution: project.resolution,
        tracks,
        selectedClipId: null,
        past: [],
        future: [],
      };
    }

    case "SET_TITLE":
      return { ...state, title: action.title };

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

  return {
    state,
    dispatch,
    loadProject,
    setTitle,
    setCurrentTime,
    setPlaying,
    setZoom,
    selectClip,
    addClip,
    updateClip,
    removeClip,
    toggleTrackMute,
    toggleTrackLock,
    undo,
    redo,
    setExportJob,
    setExportStatus,
  };
}

export type EditorStore = ReturnType<typeof useEditorReducer>;
