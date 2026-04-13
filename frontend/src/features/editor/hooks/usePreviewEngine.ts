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
  effectPreview: { clipId: string; patch: Partial<Clip> } | null;
  onTimeUpdate: (ms: number) => void;
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
  effectPreview,
  onTimeUpdate,
  onPlaybackEnd,
}: UsePreviewEngineOptions): void {
  const engineRef = useRef<PreviewEngine | null>(null);
  const skipNextSeekRef = useRef(false);
  const lastExternalTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const engine = new PreviewEngine({
      onTimeUpdate(ms) {
        skipNextSeekRef.current = true;
        onTimeUpdate(ms);
      },
      onPlaybackEnd() {
        onPlaybackEnd();
      },
      onFrame(frame, timestampUs, clipId) {
        previewRef.current?.receiveFrame(frame, timestampUs, clipId);
      },
      onTick(playheadMs, clips) {
        previewRef.current?.tick(playheadMs, clips, [], null);
      },
      onClearFrames(clipIds) {
        previewRef.current?.clearFrames(clipIds);
      },
    });

    engineRef.current = engine;

    const unlockAudio = () => {
      void engine.primeAudioContext();
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      engine.destroy();
      engineRef.current = null;
    };
  }, [onPlaybackEnd, onTimeUpdate, previewRef]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.update(
      tracks,
      assetUrlMap,
      durationMs,
      asVideoEffectPreview(effectPreview)
    );
  }, [tracks, assetUrlMap, durationMs, effectPreview]);

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
