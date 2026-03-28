import type { EditorState, EditorAction } from "../types/editor";
import {
  alignTracksTrimInvariant,
  computeDuration,
  DEFAULT_TRACKS,
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
      return null;
  }
}
