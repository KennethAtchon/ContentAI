import { createContext, useContext } from "react";
import type {
  Clip,
  Track,
  Transition,
  ExportJobStatus,
  EditProject,
  EditorHistorySnapshot,
  TrackType,
  ClipPatch,
  CaptionStyleOverrides,
  ExportJobStatus as _ExportJobStatus,
} from "../types/editor";
import type { EditorStore } from "../hooks/useEditorStore";
import type { QueryClient } from "@tanstack/react-query";

export interface EditorDocumentContextValue {
  // EditorDocumentState
  editProjectId: string | null;
  title: string;
  durationMs: number;
  fps: number;
  resolution: string;
  tracks: Track[];
  clipboardClip: Clip | null;
  clipboardSourceTrackId: string | null;
  past: EditorHistorySnapshot[];
  future: EditorHistorySnapshot[];
  isReadOnly: boolean;
  // EditorUIState
  selectedClipId: string | null;
  exportJobId: string | null;
  exportStatus: ExportJobStatus | null;
  // Derived
  selectedClip: Clip | null;
  selectedTrack: Track | null;
  // Store actions
  dispatch: EditorStore["dispatch"];
  loadProject: EditorStore["loadProject"];
  setTitle: EditorStore["setTitle"];
  setResolution: EditorStore["setResolution"];
  setFps: EditorStore["setFps"];
  selectClip: EditorStore["selectClip"];
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
  // Higher-level clip actions
  handleAddClip: (trackId: string, clip: Clip) => void;
  handleDeleteAllClipsInTrack: (trackId: string) => void;
  handleClipSplit: (clipId: string) => void;
  handleClipDuplicate: (clipId: string) => void;
  handleClipCopy: (clipId: string) => void;
  handleClipPaste: (trackId: string, startMs: number) => void;
  handleClipToggleEnabled: (clipId: string) => void;
  handleClipRippleDelete: (clipId: string) => void;
  handleClipSetSpeed: (clipId: string, speed: number) => void;
  handleFocusMediaForTrack: (trackType: TrackType, trackId: string, startMs: number) => void;
  handleSelectTransition: (trackId: string, clipAId: string, clipBId: string) => void;
  selectedTransition: Transition | null;
  queryClient: QueryClient;
}

export const EditorDocumentContext = createContext<EditorDocumentContextValue | null>(null);

export function useEditorDocumentContext(): EditorDocumentContextValue {
  const ctx = useContext(EditorDocumentContext);
  if (!ctx) throw new Error("useEditorDocumentContext must be used inside EditorProviders");
  return ctx;
}
