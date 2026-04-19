import { createContext, useContext } from "react";
import type { Clip, Track, Transition } from "../types/editor";
import type { EditorStore } from "../hooks/useEditorStore";

export interface EditorSelectionContextValue {
  selectedClipId: string | null;
  selectedClip: Clip | null;
  selectedTrack: Track | null;
  selectedTransition: Transition | null;
  selectedTransitionKey: [string, string, string] | null;
  selectClip: EditorStore["selectClip"];
  setSelectedTransitionKey: (key: [string, string, string] | null) => void;
  handleSelectTransition: (
    trackId: string,
    clipAId: string,
    clipBId: string
  ) => void;
}

export const EditorSelectionContext =
  createContext<EditorSelectionContextValue | null>(null);

export function useEditorSelection(): EditorSelectionContextValue {
  const ctx = useContext(EditorSelectionContext);
  if (!ctx) {
    throw new Error("useEditorSelection must be used inside EditorProviders");
  }
  return ctx;
}
