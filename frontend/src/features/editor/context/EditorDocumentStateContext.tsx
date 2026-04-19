import { createContext, useContext } from "react";
import type { Clip, EditorHistorySnapshot, Track } from "../types/editor";

export interface EditorDocumentStateContextValue {
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
}

export const EditorDocumentStateContext =
  createContext<EditorDocumentStateContextValue | null>(null);

export function useEditorDocumentState(): EditorDocumentStateContextValue {
  const ctx = useContext(EditorDocumentStateContext);
  if (!ctx) {
    throw new Error("useEditorDocumentState must be used inside EditorProviders");
  }
  return ctx;
}
