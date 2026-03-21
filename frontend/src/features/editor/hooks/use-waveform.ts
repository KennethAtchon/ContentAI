import { useEffect } from "react";
import WaveSurfer from "wavesurfer.js";

// Module-level cache: reuse instances rather than destroying and recreating.
// Keyed by audioUrl so the same file is decoded only once.
const waveformCache = new Map<string, WaveSurfer>();

interface UseWaveformOptions {
  audioUrl: string | undefined;
  container: HTMLElement | null;
  waveColor: string;
  height?: number;
}

export function useWaveform({
  audioUrl,
  container,
  waveColor,
  height = 32,
}: UseWaveformOptions) {
  useEffect(() => {
    if (!audioUrl || !container) return;

    const existing = waveformCache.get(audioUrl);

    if (existing) {
      // Re-mount cached instance into this container
      try {
        existing.setOptions({ container, waveColor, height });
      } catch {
        // Instance may have been destroyed externally; remove from cache
        waveformCache.delete(audioUrl);
      }
      return;
    }

    const ws = WaveSurfer.create({
      container,
      url: audioUrl,
      waveColor,
      progressColor: "transparent",
      height,
      interact: false,
      cursorWidth: 0,
      normalize: true,
    });

    waveformCache.set(audioUrl, ws);

    return () => {
      // Do NOT destroy — keep in cache for reuse.
      // Only detach from the container by creating a hidden detached div.
      try {
        ws.setOptions({ container: document.createElement("div") });
      } catch {
        // ignore
      }
    };
  }, [audioUrl, container, waveColor, height]);
}
