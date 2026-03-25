import { useEffect } from "react";
import WaveSurfer from "wavesurfer.js";

const CACHE_MAX_SIZE = 20;

// Module-level LRU cache: reuse instances rather than destroying and recreating.
// Keyed by audioUrl so the same file is decoded only once.
// Evicts the least-recently-used entry when the cap is reached.
// Limitation: multiple editor tabs share this map (same URL → same instance); acceptable for now.
const waveformCache = new Map<string, WaveSurfer>();

function evictOldestIfNeeded() {
  if (waveformCache.size < CACHE_MAX_SIZE) return;
  // Map iteration order is insertion order — first entry is oldest
  const oldestKey = waveformCache.keys().next().value;
  if (oldestKey === undefined) return;
  const ws = waveformCache.get(oldestKey);
  try {
    ws?.destroy();
  } catch {
    // ignore
  }
  waveformCache.delete(oldestKey);
}

function touchKey(key: string, ws: WaveSurfer) {
  // Re-insert to move to end (most-recently-used)
  waveformCache.delete(key);
  waveformCache.set(key, ws);
}

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
      touchKey(audioUrl, existing);
      try {
        existing.setOptions({ container, waveColor, height });
      } catch {
        // Instance may have been destroyed externally; remove from cache
        waveformCache.delete(audioUrl);
      }
      return;
    }

    evictOldestIfNeeded();

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
