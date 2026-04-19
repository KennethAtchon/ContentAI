import { createContext, useContext } from "react";
import type { Clip, ClipPatch, TrackType } from "../types/editor";

export interface EditorClipCommandsContextValue {
  handleAddClip: (trackId: string, clip: Clip) => void;
  handleUpdateClip: (clipId: string, patch: ClipPatch) => void;
  handleRemoveClip: (clipId: string) => void;
  handleDeleteAllClipsInTrack: (trackId: string) => void;
  handleClipSplit: (clipId: string) => void;
  handleClipDuplicate: (clipId: string) => void;
  handleClipCopy: (clipId: string) => void;
  handleClipPaste: (trackId: string, startMs: number) => void;
  handleClipToggleEnabled: (clipId: string) => void;
  handleClipRippleDelete: (clipId: string) => void;
  handleClipSetSpeed: (clipId: string, speed: number) => void;
  handleFocusMediaForTrack: (
    trackType: TrackType,
    trackId: string,
    startMs: number
  ) => void;
}

export const EditorClipCommandsContext =
  createContext<EditorClipCommandsContextValue | null>(null);

export function useEditorClipCommands(): EditorClipCommandsContextValue {
  const ctx = useContext(EditorClipCommandsContext);
  if (!ctx) {
    throw new Error("useEditorClipCommands must be used inside EditorProviders");
  }
  return ctx;
}
