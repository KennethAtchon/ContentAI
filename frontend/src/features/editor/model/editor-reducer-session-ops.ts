import type { EditorState, EditorAction } from "../types/editor";
import {
  alignTracksTrimInvariant,
  computeDuration,
  DEFAULT_TRACKS,
  snapshotEditorState,
} from "./editor-reducer-helpers";

export function reduceSessionOps(
  state: EditorState,
  action: EditorAction
): EditorState | null {
  switch (action.type) {
    case "LOAD_PROJECT": {
      const { project } = action;
      const rawTracks =
        project.tracks && project.tracks.length > 0
          ? project.tracks
          : DEFAULT_TRACKS;
      const tracks = alignTracksTrimInvariant(rawTracks);
      const computedDuration = computeDuration(tracks);
      return {
        ...state,
        editProjectId: project.id,
        title: project.title ?? "Untitled Edit",
        durationMs: Math.max(project.durationMs ?? 0, computedDuration),
        fps: project.fps,
        resolution: project.resolution,
        tracks,
        currentTimeMs: 0,
        selectedClipId: null,
        clipboardClip: null,
        clipboardSourceTrackId: null,
        past: [],
        future: [],
        isReadOnly: project.status === "published",
      };
    }

    case "SET_TITLE":
      return {
        ...state,
        title: action.title,
        past: [...state.past, snapshotEditorState(state)].slice(-50),
        future: [],
      };

    case "SET_RESOLUTION":
      return {
        ...state,
        resolution: action.resolution,
        past: [...state.past, snapshotEditorState(state)].slice(-50),
        future: [],
      };

    case "SET_CURRENT_TIME":
      return { ...state, currentTimeMs: Math.min(Math.max(0, action.ms), state.durationMs) };

    case "SET_PLAYING":
      return { ...state, isPlaying: action.playing };

    case "SET_PLAYBACK_RATE":
      return {
        ...state,
        playbackRate: action.rate,
        past: [...state.past, snapshotEditorState(state)].slice(-50),
        future: [],
      };

    case "SET_ZOOM":
      return { ...state, zoom: Math.max(5, Math.min(200, action.zoom)) };

    case "SELECT_CLIP":
      return { ...state, selectedClipId: action.clipId };

    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        future: [snapshotEditorState(state), ...state.future].slice(0, 50),
        tracks: previous.tracks,
        resolution: previous.resolution,
        title: previous.title,
        playbackRate: previous.playbackRate,
        durationMs: computeDuration(previous.tracks),
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        past: [...state.past, snapshotEditorState(state)].slice(-50),
        future: state.future.slice(1),
        tracks: next.tracks,
        resolution: next.resolution,
        title: next.title,
        playbackRate: next.playbackRate,
        durationMs: computeDuration(next.tracks),
      };
    }

    case "SET_EXPORT_JOB":
      return { ...state, exportJobId: action.jobId };

    case "SET_EXPORT_STATUS":
      return { ...state, exportStatus: action.status };

    default:
      return null;
  }
}
