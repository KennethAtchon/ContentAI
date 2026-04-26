import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export interface EditorTimelineState {
  currentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
  zoom: number;
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  seekTo: (ms: number) => void;
  seekToStart: () => void;
  seekToEnd: (durationMs: number) => void;
  setPlaybackRate: (rate: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (zoom: number) => void;
  zoomToFit: (durationMs: number, viewportWidthPx: number) => void;
  reset: () => void;
}

const ZOOM_MIN = 20;
const ZOOM_MAX = 400;
const ZOOM_DEFAULT = 80;

export const useEditorTimelineStore = create<EditorTimelineState>()(
  subscribeWithSelector((set) => ({
    currentTimeMs: 0,
    isPlaying: false,
    playbackRate: 1,
    zoom: ZOOM_DEFAULT,

    play: () => set({ isPlaying: true }),

    pause: () => set({ isPlaying: false }),

    togglePlayback: () => set((state) => ({ isPlaying: !state.isPlaying })),

    seekTo: (ms) => set({ currentTimeMs: Math.max(0, ms) }),

    seekToStart: () => set({ currentTimeMs: 0 }),

    seekToEnd: (durationMs) => set({ currentTimeMs: Math.max(0, durationMs) }),

    setPlaybackRate: (rate) =>
      set({ playbackRate: Math.max(0.1, Math.min(4, rate)) }),

    zoomIn: () =>
      set((state) => ({ zoom: Math.min(state.zoom * 1.25, ZOOM_MAX) })),

    zoomOut: () =>
      set((state) => ({ zoom: Math.max(state.zoom / 1.25, ZOOM_MIN) })),

    setZoom: (zoom) =>
      set({ zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)) }),

    zoomToFit: (durationMs, viewportWidthPx) => {
      if (durationMs <= 0 || viewportWidthPx <= 0) return;

      const nextZoom = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, (viewportWidthPx - 100) / (durationMs / 1000)),
      );

      set({ zoom: nextZoom });
    },

    reset: () =>
      set({
        currentTimeMs: 0,
        isPlaying: false,
        playbackRate: 1,
        zoom: ZOOM_DEFAULT,
      }),
  })),
);
