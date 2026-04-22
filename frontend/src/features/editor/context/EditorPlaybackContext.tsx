import { createContext, useContext } from "react";
import type { RefObject } from "react";

export interface EditorPlaybackContextValue {
  currentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
  zoom: number;
  pixelsPerMs: number;
  setCurrentTime: (ms: number) => void;
  setPlaying: (playing: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setZoom: (zoom: number) => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  rewind: () => void;
  fastForward: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
  saveNow: () => void;
  handleConfirmPublish: () => Promise<void>;
  handleBack: () => Promise<void>;
  timelineContainerRef: RefObject<HTMLDivElement | null>;
  timelineScrollRef: RefObject<HTMLDivElement | null>;
}

export const EditorPlaybackContext = createContext<EditorPlaybackContextValue | null>(null);

export function useEditorPlaybackContext(): EditorPlaybackContextValue {
  const ctx = useContext(EditorPlaybackContext);
  if (!ctx) throw new Error("useEditorPlaybackContext must be used inside EditorProviders");
  return ctx;
}
