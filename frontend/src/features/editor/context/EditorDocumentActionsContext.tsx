import { createContext, useContext } from "react";
import type { EditorStore } from "../hooks/useEditorStore";

export interface EditorDocumentActionsContextValue {
  dispatch: EditorStore["dispatch"];
  loadProject: EditorStore["loadProject"];
  setTitle: EditorStore["setTitle"];
  setResolution: EditorStore["setResolution"];
  setFps: EditorStore["setFps"];
  addClip: EditorStore["addClip"];
  updateClip: EditorStore["updateClip"];
  removeClip: EditorStore["removeClip"];
  rippleDeleteClip: EditorStore["rippleDeleteClip"];
  toggleClipEnabled: EditorStore["toggleClipEnabled"];
  copyClip: EditorStore["copyClip"];
  pasteClip: EditorStore["pasteClip"];
  splitClip: EditorStore["splitClip"];
  duplicateClip: EditorStore["duplicateClip"];
  moveClip: EditorStore["moveClip"];
  toggleTrackMute: EditorStore["toggleTrackMute"];
  toggleTrackLock: EditorStore["toggleTrackLock"];
  undo: EditorStore["undo"];
  redo: EditorStore["redo"];
  setExportJob: EditorStore["setExportJob"];
  setExportStatus: EditorStore["setExportStatus"];
  setTransition: EditorStore["setTransition"];
  removeTransition: EditorStore["removeTransition"];
  reorderShots: EditorStore["reorderShots"];
  addClipAutoPromote: EditorStore["addClipAutoPromote"];
  addCaptionClip: EditorStore["addCaptionClip"];
  updateCaptionStyle: EditorStore["updateCaptionStyle"];
  addVideoTrack: EditorStore["addVideoTrack"];
  removeTrack: EditorStore["removeTrack"];
  renameTrack: EditorStore["renameTrack"];
  reorderTracks: EditorStore["reorderTracks"];
}

export const EditorDocumentActionsContext =
  createContext<EditorDocumentActionsContextValue | null>(null);

export function useEditorDocumentActions(): EditorDocumentActionsContextValue {
  const ctx = useContext(EditorDocumentActionsContext);
  if (!ctx) {
    throw new Error("useEditorDocumentActions must be used inside EditorProviders");
  }
  return ctx;
}
