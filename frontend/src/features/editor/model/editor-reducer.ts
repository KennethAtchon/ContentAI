import type { EditorState, EditorAction } from "../types/editor";
import { reduceClipOps } from "./editor-reducer-clip-ops";
import { reduceSessionOps } from "./editor-reducer-session-ops";
import { reduceTrackOps } from "./editor-reducer-track-ops";
import {
  computeDuration,
  sanitizeTracksNoOverlap,
} from "./editor-reducer-helpers";

/**
 * Composed editor document reducer: session (playback/UI/load) → clip ops → track layout.
 * Split across modules to limit merge conflict surface and enable targeted tests.
 */
export function editorReducer(
  state: EditorState,
  action: EditorAction
): EditorState {
  const fromSession = reduceSessionOps(state, action);
  if (fromSession !== null) {
    return finalizeEditorState(state, fromSession);
  }

  const fromClips = reduceClipOps(state, action);
  if (fromClips !== null) {
    return finalizeEditorState(state, fromClips);
  }

  const fromTracks = reduceTrackOps(state, action);
  if (fromTracks !== null) {
    return finalizeEditorState(state, fromTracks);
  }

  return state;
}

function finalizeEditorState(
  previous: EditorState,
  next: EditorState
): EditorState {
  if (next.tracks === previous.tracks) {
    return next;
  }

  const tracks = sanitizeTracksNoOverlap(next.tracks);
  return {
    ...next,
    tracks,
    durationMs: computeDuration(tracks),
  };
}
