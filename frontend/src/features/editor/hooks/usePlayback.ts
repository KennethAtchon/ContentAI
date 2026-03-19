import { useEffect, useRef, useCallback } from "react";

interface PlaybackOptions {
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  onTick: (ms: number) => void;
  onEnd: () => void;
}

/**
 * Drives the editor playhead via requestAnimationFrame.
 * Calls onTick with the new currentTimeMs every frame while playing.
 * Calls onEnd when the playhead reaches durationMs.
 */
export function usePlayback({
  isPlaying,
  currentTimeMs,
  durationMs,
  onTick,
  onEnd,
}: PlaybackOptions) {
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const currentTimeMsRef = useRef(currentTimeMs);

  // Keep ref in sync so the rAF callback uses the latest value
  currentTimeMsRef.current = currentTimeMs;

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

      const newTimeMs = currentTimeMsRef.current + elapsed;

      if (durationMs > 0 && newTimeMs >= durationMs) {
        onTick(durationMs);
        onEnd();
        return;
      }

      onTick(newTimeMs);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => stop();
  }, [isPlaying, durationMs, onTick, onEnd, stop]);
}
