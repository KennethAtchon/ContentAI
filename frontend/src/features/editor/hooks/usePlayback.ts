import { useEffect, useRef, useCallback } from "react";

interface PlaybackOptions {
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number; // 1 = normal, 2 = 2× fast, -1 = reverse (JKL)
  onTick: (ms: number) => void;
  onEnd: () => void;
}

/**
 * Drives the editor playhead via requestAnimationFrame.
 * Calls onTick with the new currentTimeMs every frame while playing.
 * Calls onEnd when the playhead reaches durationMs (or 0 when playing in reverse).
 * Respects playbackRate for JKL scrubbing and per-clip speed display.
 */
export function usePlayback({
  isPlaying,
  currentTimeMs,
  durationMs,
  playbackRate,
  onTick,
  onEnd,
}: PlaybackOptions) {
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const currentTimeMsRef = useRef(currentTimeMs);
  const playbackRateRef = useRef(playbackRate);

  // Keep refs in sync so the rAF callback always uses the latest values
  currentTimeMsRef.current = currentTimeMs;
  playbackRateRef.current = playbackRate;

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimestampRef.current = null;
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      stop();
      return;
    }

    const tick = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;

      const rate = playbackRateRef.current;
      const newTimeMs = currentTimeMsRef.current + elapsed * rate;

      if (rate >= 0) {
        // Forward playback — stop at end
        if (durationMs > 0 && newTimeMs >= durationMs) {
          onTick(durationMs);
          onEnd();
          return;
        }
        onTick(newTimeMs);
      } else {
        // Reverse playback — stop at start
        if (newTimeMs <= 0) {
          onTick(0);
          onEnd();
          return;
        }
        onTick(newTimeMs);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => stop();
  }, [isPlaying, durationMs, onTick, onEnd, stop]);
}
