import { useAudioPlaybackStore } from "./audio-playback-store";
import { useShallow } from "zustand/react/shallow";

export function useAudioPlayback() {
  return useAudioPlaybackStore(
    useShallow((state) => ({
      currentPlayerId: state.currentPlayerId,
      play: state.play,
      stop: state.stop,
    }))
  );
}
