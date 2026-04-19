import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useCaptionCanvas } from "../../caption/hooks/useCaptionCanvas";
import { useCaptionDoc } from "../../caption/hooks/useCaptionDoc";
import { useCaptionPresets } from "../../caption/hooks/useCaptionPresets";
import { applyCaptionStyleOverrides } from "../../caption/apply-style-overrides";
import { isCaptionClip } from "../../utils/clip-types";
import { isClipActiveAtTimelineTime } from "../../utils/editor-composition";
import type { CaptionClip } from "../../types/editor";
import { useEditorDocumentState } from "../../context/EditorDocumentStateContext";
import { useEditorPlaybackContext } from "../../context/EditorPlaybackContext";

export interface CaptionLayerHandle {
  syncPlayback(timelineMs: number): void;
}

interface CaptionLayerProps {
  onBitmapReady: (bitmap: ImageBitmap | null) => void;
}

export const CaptionLayer = forwardRef<CaptionLayerHandle, CaptionLayerProps>(
  function CaptionLayer({ onBitmapReady }, ref) {
    const { tracks, resolution } = useEditorDocumentState();
    const { playheadMs } = useEditorPlaybackContext();

    const [canvasWidth, canvasHeight] = useMemo(
      () => (resolution || "1080x1920").split("x").map(Number),
      [resolution]
    );

    const textTrack = useMemo(
      () => tracks.find((track) => track.type === "text"),
      [tracks]
    );
    const captionClips = useMemo(
      () => (textTrack?.clips ?? []).filter(isCaptionClip),
      [textTrack?.clips]
    );

    const [activeCaptionClipId, setActiveCaptionClipId] = useState<string | null>(null);
    const activeCaptionClipIdRef = useRef<string | null>(null);
    const pendingCaptionRenderTimeRef = useRef<number | null>(null);

    const getActiveCaptionClipAt = useCallback(
      (timelineMs: number): CaptionClip | null => {
        const activeClips = captionClips.filter((clip) =>
          isClipActiveAtTimelineTime(clip, timelineMs)
        );
        return activeClips[activeClips.length - 1] ?? null;
      },
      [captionClips]
    );

    const activeCaptionClip = useMemo(
      () => captionClips.find((clip) => clip.id === activeCaptionClipId) ?? null,
      [activeCaptionClipId, captionClips]
    );

    const { data: captionPresets } = useCaptionPresets();
    const { data: activeCaptionDoc } = useCaptionDoc(activeCaptionClip?.captionDocId ?? null);
    const activeCaptionPreset = useMemo(() => {
      const preset = captionPresets?.find((item) => item.id === activeCaptionClip?.stylePresetId);
      if (!preset || !activeCaptionClip) return null;
      return applyCaptionStyleOverrides(preset, activeCaptionClip.styleOverrides);
    }, [captionPresets, activeCaptionClip]);

    const { canvasRef: captionCanvasRef, renderAtTime: renderCaptionAtTime } = useCaptionCanvas({
      clip: activeCaptionClip,
      doc: activeCaptionDoc ?? null,
      preset: activeCaptionPreset,
      canvasW: Math.max(1, Math.round(canvasWidth || 1080)),
      canvasH: Math.max(1, Math.round(canvasHeight || 1920)),
      onBitmapReady,
    });

    useEffect(() => {
      activeCaptionClipIdRef.current = activeCaptionClipId;
    }, [activeCaptionClipId]);

    const syncPlayback = useCallback(
      (timelineMs: number) => {
        const nextClipId = getActiveCaptionClipAt(timelineMs)?.id ?? null;
        if (nextClipId !== activeCaptionClipIdRef.current) {
          pendingCaptionRenderTimeRef.current = timelineMs;
          activeCaptionClipIdRef.current = nextClipId;
          setActiveCaptionClipId(nextClipId);
          return;
        }
        renderCaptionAtTime(timelineMs);
      },
      [getActiveCaptionClipAt, renderCaptionAtTime]
    );

    useEffect(() => {
      syncPlayback(playheadMs);
    }, [playheadMs, syncPlayback]);

    useEffect(() => {
      const pendingRenderTime = pendingCaptionRenderTimeRef.current;
      if (pendingRenderTime == null) return;
      pendingCaptionRenderTimeRef.current = null;
      renderCaptionAtTime(pendingRenderTime);
    }, [activeCaptionClipId, renderCaptionAtTime]);

    useImperativeHandle(ref, () => ({ syncPlayback }), [syncPlayback]);

    return (
      <canvas
        ref={captionCanvasRef}
        width={Math.max(1, Math.round(canvasWidth || 1080))}
        height={Math.max(1, Math.round(canvasHeight || 1920))}
        className="hidden"
        aria-hidden="true"
      />
    );
  }
);
