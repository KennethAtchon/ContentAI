import { useEffect, useRef, type RefObject } from "react";
import type { Clip, Track, VideoClip } from "../types/editor";
import type { PreviewCanvasHandle } from "../components/preview/PreviewCanvas";
import {
  PreviewEngine,
  type EffectPreviewPatch,
} from "../engine/PreviewEngine";

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
  onPlayheadUpdate?: (ms: number) => void;
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
  onPlayheadUpdate,
  onRenderPlayheadUpdate,
  onPlaybackEnd,
}: UsePreviewEngineOptions): void {
  const engineRef = useRef<PreviewEngine | null>(null);
  const skipNextSeekRef = useRef(false);
  const lastExternalTimeRef = useRef<number | null>(null);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onPlayheadUpdateRef = useRef(onPlayheadUpdate);
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
    onPlayheadUpdateRef.current = onPlayheadUpdate;
    onRenderPlayheadUpdateRef.current = onRenderPlayheadUpdate;
    onPlaybackEndRef.current = onPlaybackEnd;
  }, [onPlaybackEnd, onPlayheadUpdate, onRenderPlayheadUpdate, onTimeUpdate]);

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

    void PreviewEngine.create(
      {
        onTimeUpdate(ms) {
          skipNextSeekRef.current = true;
          onPlayheadUpdateRef.current?.(ms);
          onTimeUpdateRef.current(ms);
        },
        onPlaybackEnd() {
          onPlaybackEndRef.current();
        },
        onFrame(frame, timestampUs, clipId) {
          previewRef.current?.receiveFrame(frame, timestampUs, clipId);
        },
        onTick(playheadMs, clips, textObjects, captionFrame) {
          previewRef.current?.tick(
            playheadMs,
            clips,
            textObjects,
            captionFrame
          );
        },
        onRenderTick(playheadMs) {
          // Caption renders are driven exclusively from the RAF loop via this
          // callback. Keeping it out of onTick prevents the re-entrant loop:
          // renderCurrentFrame -> onTick -> onRenderPlayheadUpdate ->
          // renderCaptionAtTime -> setCaptionBitmapVersion -> renderCurrentFrame
          onRenderPlayheadUpdateRef.current?.(playheadMs);
        },
        onClearFrames(clipIds) {
          previewRef.current?.clearFrames(clipIds);
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
        const latest = latestUpdateRef.current;
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
      engine?.destroy();
      engineRef.current = null;
    };
  }, [canvasHeight, canvasWidth, fps, previewRef]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

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

    const pendingUpdates = queuedBitmaps.splice(0, queuedBitmaps.length);
    const nextBitmap = pendingUpdates[pendingUpdates.length - 1] ?? null;
    for (const bitmap of pendingUpdates.slice(0, -1)) {
      bitmap?.close();
    }

    if (!nextBitmap) {
      engine.setCaptionFrame(null);
      if (!isPlaying) {
        engine.renderCurrentFrame();
      }
      return;
    }

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
      engine.setCurrentTime(currentTimeMs);
      return;
    }

    if (lastExternalTimeRef.current === currentTimeMs) {
      return;
    }
    lastExternalTimeRef.current = currentTimeMs;

    if (skipNextSeekRef.current) {
      skipNextSeekRef.current = false;
      engine.setCurrentTime(currentTimeMs);
      return;
    }

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
