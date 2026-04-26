import { create } from "zustand";

type AudioPlaybackState = {
  currentPlayerId: string | null;
  play: (playerId: string) => void;
  stop: () => void;
};

export const useAudioPlaybackStore = create<AudioPlaybackState>((set) => ({
  currentPlayerId: null,
  play: (playerId) => set({ currentPlayerId: playerId }),
  stop: () => set({ currentPlayerId: null }),
}));
