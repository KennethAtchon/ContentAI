import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type {
  Clip,
  ClipPatch,
  EditProject,
  EditorHistorySnapshot,
  Track,
} from "../model/editor-domain";

type EditorProjectDefaults = {
  editProjectId: string | null;
  title: string;
  durationMs: number;
  fps: number;
  resolution: string;
  saveRevision: number;
  createdAt: string;
  tracks: Track[];
  clipboardClip: Clip | null;
  clipboardSourceTrackId: string | null;
  past: EditorHistorySnapshot[];
  future: EditorHistorySnapshot[];
  isReadOnly: boolean;
};

export interface EditorProjectState extends EditorProjectDefaults {
  loadProject: (project: EditProject) => void;
  updateSaveRevision: (saveRevision: number) => void;
  setReadOnly: () => void;
  setTitle: (title: string) => void;
  setResolution: (resolution: string) => void;
  setFps: (fps: number) => void;
  updateClip: (clipId: string, patch: ClipPatch) => void;
  toggleClipEnabled: (clipId: string) => void;
  removeClip: (clipId: string) => void;
  moveClip: (clipId: string, startMs: number) => void;
  toggleTrackMute: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  renameTrack: (trackId: string, name: string) => void;
  mergeTracksFromServer: (tracks: Track[]) => void;
  copyClip: (clipId: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const DEFAULT_PROJECT_STATE: EditorProjectDefaults = {
  editProjectId: null,
  title: "Untitled Edit",
  durationMs: 0,
  fps: 30,
  resolution: "1080x1920",
  saveRevision: 0,
  createdAt: "",
  tracks: [],
  clipboardClip: null,
  clipboardSourceTrackId: null,
  past: [],
  future: [],
  isReadOnly: false,
};

export const useEditorProjectStore = create<EditorProjectState>()(
  subscribeWithSelector((set, get) => ({
    ...DEFAULT_PROJECT_STATE,

    loadProject: (project) =>
      set({
        editProjectId: project.id,
        title: project.title ?? DEFAULT_PROJECT_STATE.title,
        durationMs: project.durationMs,
        fps: project.fps,
        resolution: project.resolution,
        saveRevision: project.saveRevision,
        createdAt: project.createdAt,
        tracks: project.tracks,
        clipboardClip: null,
        clipboardSourceTrackId: null,
        past: [],
        future: [],
        isReadOnly: project.status === "published",
      }),

    updateSaveRevision: (saveRevision) => set({ saveRevision }),

    setReadOnly: () => set({ isReadOnly: true }),

    setTitle: (title) => set({ title }),

    setResolution: (resolution) => set({ resolution }),

    setFps: (fps) => set({ fps }),

    updateClip: (clipId, patch) =>
      set((state) => ({
        tracks: updateClipInTracks(state.tracks, clipId, patch),
      })),

    toggleClipEnabled: (clipId) =>
      set((state) => ({
        tracks: updateClipInTracks(state.tracks, clipId, (clip) => ({
          enabled: !clip.enabled,
        })),
      })),

    removeClip: (clipId) =>
      set((state) => ({
        tracks: state.tracks.map((track) => ({
          ...track,
          clips: track.clips.filter((clip) => clip.id !== clipId),
        })),
      })),

    moveClip: (clipId, startMs) =>
      set((state) => ({
        tracks: updateClipInTracks(state.tracks, clipId, {
          startMs: Math.max(0, startMs),
        }),
      })),

    toggleTrackMute: (trackId) =>
      set((state) => ({
        tracks: state.tracks.map((track) =>
          track.id === trackId ? { ...track, muted: !track.muted } : track,
        ),
      })),

    toggleTrackLock: (trackId) =>
      set((state) => ({
        tracks: state.tracks.map((track) =>
          track.id === trackId ? { ...track, locked: !track.locked } : track,
        ),
      })),

    renameTrack: (trackId, name) =>
      set((state) => ({
        tracks: state.tracks.map((track) =>
          track.id === trackId ? { ...track, name } : track,
        ),
      })),

    mergeTracksFromServer: (tracks) =>
      set((state) => ({ tracks: mergeTracks(state.tracks, tracks) })),

    copyClip: (clipId) => {
      const { tracks } = get();
      const track = tracks.find((entry) =>
        entry.clips.some((clip) => clip.id === clipId),
      );
      const clip = track?.clips.find((entry) => entry.id === clipId) ?? null;
      if (!clip) return;

      set({
        clipboardClip: clip,
        clipboardSourceTrackId: track?.id ?? null,
      });
    },

    undo: () => undefined,

    redo: () => undefined,

    reset: () => set(DEFAULT_PROJECT_STATE),
  })),
);

function updateClipInTracks(
  tracks: Track[],
  clipId: string,
  patch: ClipPatch | ((clip: Clip) => ClipPatch),
): Track[] {
  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (clip.id !== clipId) return clip;
      const nextPatch = typeof patch === "function" ? patch(clip) : patch;
      return { ...clip, ...nextPatch } as Clip;
    }),
  }));
}

function mergeTracks(existing: Track[], fresh: Track[]): Track[] {
  const freshById = new Map(fresh.map((track) => [track.id, track]));
  const merged = existing.map((track) => freshById.get(track.id) ?? track);
  const existingIds = new Set(existing.map((track) => track.id));
  return [...merged, ...fresh.filter((track) => !existingIds.has(track.id))];
}
