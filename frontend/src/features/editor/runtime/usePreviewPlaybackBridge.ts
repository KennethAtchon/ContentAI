import { useCallback, useEffect, useRef, useState } from "react";

const PLAYHEAD_PUBLISH_INTERVAL_MS = 150;
const PLAYHEAD_RESYNC_THRESHOLD_MS = 300;

interface UsePreviewPlaybackBridgeParams {
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  onPlaybackEnd: () => void;
  onPublishCurrentTime: (ms: number) => void;
  playbackRate: number;
}

/**
 * Drives the editor playhead via requestAnimationFrame, while publishing
 * periodic checkpoints to the reducer for the rest of the editor UI.
 *
 * A preview-local ref tracks the running position between ticks so the rAF
 * closure always reads the latest value without relying on React state lag.
 * The reducer is the single source of truth; `previewCurrentTimeMs` is derived
 * from it and kept in sync via the resync effect for explicit seeks.
 */
export function usePreviewPlaybackBridge({
  currentTimeMs,
  durationMs,
  isPlaying,
  onPlaybackEnd,
  onPublishCurrentTime,
  playbackRate,
}: UsePreviewPlaybackBridgeParams) {
  const [previewCurrentTimeMs, setPreviewCurrentTimeMs] = useState(currentTimeMs);
  const previewCurrentTimeRef = useRef(currentTimeMs);
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastPublishedAtRef = useRef(currentTimeMs);
  const wasPlayingRef = useRef(isPlaying);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimestampRef.current = null;
  }, []);

  useEffect(() => {
    previewCurrentTimeRef.current = previewCurrentTimeMs;
  }, [previewCurrentTimeMs]);

  // Snap preview time to reducer time on explicit seeks or when paused.
  useEffect(() => {
    const diff = Math.abs(currentTimeMs - previewCurrentTimeRef.current);
    if (!isPlaying || diff > PLAYHEAD_RESYNC_THRESHOLD_MS) {
      previewCurrentTimeRef.current = currentTimeMs;
      setPreviewCurrentTimeMs(currentTimeMs);
      lastPublishedAtRef.current = currentTimeMs;
    }
  }, [currentTimeMs, isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      if (wasPlayingRef.current) {
        onPublishCurrentTime(previewCurrentTimeRef.current);
      }
      wasPlayingRef.current = false;
      stop();
      return;
    }

    if (durationMs <= 0) return;

    wasPlayingRef.current = true;
    const tick = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;
      const nextTimeMs = previewCurrentTimeRef.current + elapsed * playbackRate;
      const clampedTimeMs =
        playbackRate >= 0
          ? Math.min(durationMs, nextTimeMs)
          : Math.max(0, nextTimeMs);

      previewCurrentTimeRef.current = clampedTimeMs;
      setPreviewCurrentTimeMs(clampedTimeMs);
      if (
        Math.abs(clampedTimeMs - lastPublishedAtRef.current) >=
        PLAYHEAD_PUBLISH_INTERVAL_MS
      ) {
        lastPublishedAtRef.current = clampedTimeMs;
        onPublishCurrentTime(clampedTimeMs);
      }

      const reachedEnd =
        (playbackRate >= 0 && clampedTimeMs >= durationMs) ||
        (playbackRate < 0 && clampedTimeMs <= 0);
      if (reachedEnd) {
        onPublishCurrentTime(clampedTimeMs);
        onPlaybackEnd();
        stop();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => stop();
  }, [
    durationMs,
    isPlaying,
    onPlaybackEnd,
    onPublishCurrentTime,
    playbackRate,
    stop,
  ]);

  return { previewCurrentTimeMs };
}
