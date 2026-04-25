import React, { createContext, useContext, useState } from "react";

interface AudioPlaybackContextValue {
  currentPlayerId: string | null;
  play: (playerId: string) => void;
  stop: () => void;
}

const AudioPlaybackContext = createContext<AudioPlaybackContextValue>({
  currentPlayerId: null,
  play: () => {},
  stop: () => {},
});

export function AudioPlaybackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  return (
    <AudioPlaybackContext.Provider
      value={{
        currentPlayerId,
        play: setCurrentPlayerId,
        stop: () => setCurrentPlayerId(null),
      }}
    >
      {children}
    </AudioPlaybackContext.Provider>
  );
}

export function useAudioPlayback() {
  return useContext(AudioPlaybackContext);
}
