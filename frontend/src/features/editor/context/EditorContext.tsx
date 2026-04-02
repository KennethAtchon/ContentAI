import { createContext, useContext, useMemo, ReactNode } from "react";
import type { Clip, Track } from "../types/editor";
import type { EditorStore } from "../hooks/useEditorStore";

interface EditorContextValue extends EditorStore {
  /** The clip currently selected, derived from state.selectedClipId */
  selectedClip: Clip | null;
  /** The track that contains the selected clip */
  selectedTrack: Track | null;
  /** Timeline pixels per millisecond, derived from state.zoom */
  pixelsPerMs: number;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditorContext must be used inside EditorProvider");
  return ctx;
}

interface EditorProviderProps {
  store: EditorStore;
  children: ReactNode;
}

export function EditorProvider({ store, children }: EditorProviderProps) {
  const { state } = store;

  const selectedClip = useMemo((): Clip | null => {
    if (!state.selectedClipId) return null;
    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === state.selectedClipId);
      if (clip) return clip;
    }
    return null;
  }, [state.selectedClipId, state.tracks]);

  const selectedTrack = useMemo((): Track | null => {
    if (!state.selectedClipId) return null;
    return (
      state.tracks.find((t) =>
        t.clips.some((c) => c.id === state.selectedClipId)
      ) ?? null
    );
  }, [state.selectedClipId, state.tracks]);

  // pixels per millisecond — state.zoom is pixels per second
  const pixelsPerMs = useMemo(() => state.zoom / 1000, [state.zoom]);

  const value = useMemo(
    () => ({ ...store, selectedClip, selectedTrack, pixelsPerMs }),
    [store, selectedClip, selectedTrack, pixelsPerMs]
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}
