import { useEffect, useRef, type RefObject } from "react";
import type { Clip, Track, VideoClip } from "../types/editor";
import type { PreviewCanvasHandle } from "../components/preview/PreviewCanvas";
import {
  PreviewEngine,
  type EffectPreviewPatch,
} from "../engine/PreviewEngine";
import { usePlayheadClock } from "../context/PlayheadClockContext";
import { debugLog } from "@/shared/utils/debug";

const LOG_COMPONENT = "usePreviewEngine";

function logDebug(
  message: string,
  context?: Record<string, unknown>,
  data?: unknown
): void {
  debugLog.debug(message, { component: LOG_COMPONENT, ...context }, data);
}

interface UsePreviewEngineOptions {
  previewRef: RefObject<PreviewCanvasHandle | null>;
  tracks: Track[];
  assetUrlMap: Map<string, string>;
  currentTimeMs: number;
  isPlaying: boolean;
  durationMs: number;
  fps: number;
  canvasWidth: number;
  canvasHeight: number;
  effectPreview: { clipId: string; patch: Partial<Clip> } | null;
  captionBitmapQueueRef: RefObject<Array<ImageBitmap | null>>;
  captionBitmapVersion: number;
  onTimeUpdate: (ms: number) => void;
  onRenderPlayheadUpdate?: (ms: number) => void;
  onPlaybackEnd: () => void;
}

function asVideoEffectPreview(
  effectPreview: { clipId: string; patch: Partial<Clip> } | null
): EffectPreviewPatch | null {
  if (!effectPreview) return null;
  return {
    clipId: effectPreview.clipId,
    patch: effectPreview.patch as Partial<VideoClip>,
  };
}

export function usePreviewEngine({
  previewRef,
  tracks,
  assetUrlMap,
  currentTimeMs,
  isPlaying,
  durationMs,
  fps,
  canvasWidth,
  canvasHeight,
  effectPreview,
  captionBitmapQueueRef,
  captionBitmapVersion,
  onTimeUpdate,
  onRenderPlayheadUpdate,
  onPlaybackEnd,
}: UsePreviewEngineOptions): void {
  const clock = usePlayheadClock();
  const engineRef = useRef<PreviewEngine | null>(null);
  const skipNextSeekRef = useRef(false);
  const lastExternalTimeRef = useRef<number | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onRenderPlayheadUpdateRef = useRef(onRenderPlayheadUpdate);
  const onPlaybackEndRef = useRef(onPlaybackEnd);
  const latestUpdateRef = useRef({
    tracks,
    assetUrlMap,
    durationMs,
    effectPreview,
    canvasWidth,
    canvasHeight,
    fps,
  });

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onRenderPlayheadUpdateRef.current = onRenderPlayheadUpdate;
    onPlaybackEndRef.current = onPlaybackEnd;
  }, [onPlaybackEnd, onRenderPlayheadUpdate, onTimeUpdate]);

  useEffect(() => {
    latestUpdateRef.current = {
      tracks,
      assetUrlMap,
      durationMs,
      effectPreview,
      canvasWidth,
      canvasHeight,
      fps,
    };
  }, [
    tracks,
    assetUrlMap,
    durationMs,
    effectPreview,
    canvasWidth,
    canvasHeight,
    fps,
  ]);

  useEffect(() => {
    let disposed = false;
    let engine: PreviewEngine | null = null;

    logDebug("Initializing preview engine hook", {
      canvasWidth,
      canvasHeight,
      fps,
      trackCount: tracks.length,
      assetUrlCount: assetUrlMap.size,
      durationMs,
    });

    void PreviewEngine.create(
      {
        onTimeUpdate(ms, reason) {
          // Always push the live time to the imperative clock (used by Playhead,
          // timecodes, auto-scroll etc without any React re-renders).
          clock.update(ms);

          // React state only updates on meaningful stops — not every RAF tick.
          // This is what eliminates the ~100 re-renders/sec during playback.
          if (reason !== "raf") {
            skipNextSeekRef.current = true;
            onTimeUpdateRef.current(ms);
          }
        },
        onPlaybackEnd() {
          logDebug("Received playback end callback from preview engine");
          onPlaybackEndRef.current();
        },
        onFrame(frame, timestampUs, clipId) {
          const previewHandle = previewRef.current;
          logDebug("Forwarding decoded frame to preview canvas", {
            clipId,
            timestampUs,
            frameTimestampUs: frame.timestamp,
            frameDisplayWidth: frame.displayWidth,
            frameDisplayHeight: frame.displayHeight,
            hasPreviewHandle: Boolean(previewHandle),
          });
          previewHandle?.receiveFrame(frame, timestampUs, clipId);
        },
        onTick(playheadMs, clips, textObjects, quality, captionFrame) {
          const previewHandle = previewRef.current;
          logDebug("Forwarding compositor tick to preview canvas", {
            playheadMs,
            clipCount: clips.length,
            clipIds: clips.map((clip) => clip.clipId),
            textObjectCount: textObjects.length,
            hasCaptionFrame:
              captionFrame === undefined
                ? "unchanged"
                : Boolean(captionFrame),
            previewQualityLevel: quality.level,
            previewQualityScale: quality.scale,
            hasPreviewHandle: Boolean(previewHandle),
          });
          previewHandle?.tick(
            playheadMs,
            clips,
            textObjects,
            captionFrame,
            quality
          );
        },
        onRenderTick(playheadMs) {
          logDebug("Received render tick from preview engine", { playheadMs });
          onRenderPlayheadUpdateRef.current?.(playheadMs);
        },
        onClearFrames(clipIds) {
          const previewHandle = previewRef.current;
          logDebug("Forwarding clear-frames request to preview canvas", {
            clipCount: clipIds.length,
            clipIds,
            hasPreviewHandle: Boolean(previewHandle),
          });
          previewHandle?.clearFrames(clipIds);
        },
      },
      { canvasWidth, canvasHeight, fps }
    )
      .then((createdEngine) => {
        if (disposed) {
          createdEngine.destroy();
          return;
        }
        engine = createdEngine;
        engineRef.current = createdEngine;
        logDebug("Preview engine created", {
          canvasWidth,
          canvasHeight,
          fps,
        });
        const latest = latestUpdateRef.current;
        logDebug("Applying initial preview engine state", {
          trackCount: latest.tracks.length,
          assetUrlCount: latest.assetUrlMap.size,
          durationMs: latest.durationMs,
          canvasWidth: latest.canvasWidth,
          canvasHeight: latest.canvasHeight,
          fps: latest.fps,
        });
        createdEngine.update(
          latest.tracks,
          latest.assetUrlMap,
          latest.durationMs,
          asVideoEffectPreview(latest.effectPreview),
          {
            canvasWidth: latest.canvasWidth,
            canvasHeight: latest.canvasHeight,
            fps: latest.fps,
          }
        );
      })
      .catch((error: unknown) => {
        if (disposed) return;
        // eslint-disable-next-line no-console -- initialization failures need a visible local signal
        console.error("Failed to initialize preview engine.", error);
      });

    const unlockAudio = () => {
      void engineRef.current?.primeAudioContext();
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    return () => {
      disposed = true;
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      logDebug("Disposing preview engine hook");
      engine?.destroy();
      engineRef.current = null;
    };
  }, [canvasHeight, canvasWidth, clock, fps, previewRef]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    logDebug("Applying preview engine update from React state", {
      trackCount: tracks.length,
      assetUrlCount: assetUrlMap.size,
      durationMs,
      canvasWidth,
      canvasHeight,
      fps,
      hasEffectPreview: Boolean(effectPreview),
    });
    engine.update(
      tracks,
      assetUrlMap,
      durationMs,
      asVideoEffectPreview(effectPreview),
      { canvasWidth, canvasHeight, fps }
    );
  }, [
    tracks,
    assetUrlMap,
    durationMs,
    effectPreview,
    canvasWidth,
    canvasHeight,
    fps,
  ]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const queuedBitmaps = captionBitmapQueueRef.current;
    if (!queuedBitmaps || queuedBitmaps.length === 0) {
      return;
    }

    logDebug("Processing queued caption bitmaps", {
      queuedBitmapCount: queuedBitmaps.length,
      captionBitmapVersion,
      isPlaying,
    });
    const pendingUpdates = queuedBitmaps.splice(0, queuedBitmaps.length);
    const nextBitmap = pendingUpdates[pendingUpdates.length - 1] ?? null;
    for (const bitmap of pendingUpdates.slice(0, -1)) {
      bitmap?.close();
    }

    if (!nextBitmap) {
      logDebug("Clearing caption frame on preview engine");
      engine.setCaptionFrame(null);
      if (!isPlaying) {
        engine.renderCurrentFrame();
      }
      return;
    }

    logDebug("Setting caption frame on preview engine");
    engine.setCaptionFrame({ bitmap: nextBitmap });
    if (!isPlaying) {
      engine.renderCurrentFrame();
    }
  }, [captionBitmapQueueRef, captionBitmapVersion, isPlaying]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (lastExternalTimeRef.current == null) {
      lastExternalTimeRef.current = currentTimeMs;
      logDebug("Setting initial current time on preview engine", {
        currentTimeMs,
      });
      engine.setCurrentTime(currentTimeMs);
      return;
    }

    if (lastExternalTimeRef.current === currentTimeMs) {
      return;
    }
    lastExternalTimeRef.current = currentTimeMs;

    if (skipNextSeekRef.current) {
      skipNextSeekRef.current = false;
      logDebug("Skipping explicit seek after engine-originated time update", {
        currentTimeMs,
      });
      engine.setCurrentTime(currentTimeMs);
      return;
    }

    logDebug("Forwarding external seek request to preview engine", {
      currentTimeMs,
    });
    void engine.seek(currentTimeMs);
  }, [currentTimeMs]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (isPlaying) {
      void engine.play();
      return;
    }

    engine.pause();
  }, [isPlaying]);
}
