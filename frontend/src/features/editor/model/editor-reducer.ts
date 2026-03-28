import type { EditorState, EditorAction } from "../types/editor";
import { reduceClipOps } from "./editor-reducer-clip-ops";
import { reduceSessionOps } from "./editor-reducer-session-ops";
import { reduceTrackOps } from "./editor-reducer-track-ops";

/**
 * Composed editor document reducer: session (playback/UI/load) → clip ops → track layout.
 * Split across modules to limit merge conflict surface and enable targeted tests.
 */
export function editorReducer(
  state: EditorState,
  action: EditorAction
): EditorState {
  const fromSession = reduceSessionOps(state, action);
  if (fromSession !== null) return fromSession;

  const fromClips = reduceClipOps(state, action);
  if (fromClips !== null) return fromClips;

  const fromTracks = reduceTrackOps(state, action);
  if (fromTracks !== null) return fromTracks;

  return state;
}
