import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ClipPatch, Track } from "../types/editor";
import { useAssetUrlMap } from "../contexts/asset-url-map-context";
import { useCaptionCanvas } from "../caption/hooks/useCaptionCanvas";
import { useCaptionDoc } from "../caption/hooks/useCaptionDoc";
import { useCaptionPresets } from "../caption/hooks/useCaptionPresets";
import { applyCaptionStyleOverrides } from "../caption/apply-style-overrides";
import { derivePreviewScene, collectMountedMediaClips } from "../scene/preview-scene";
import { PreviewStageSurface } from "../renderers/PreviewStageSurface";
import { usePreviewMediaRegistry } from "../runtime/usePreviewMediaRegistry";
import { usePreviewMediaSync } from "../runtime/usePreviewMediaSync";
import { usePreviewSurfaceSize } from "../runtime/usePreviewSurfaceSize";

interface PreviewStageRootProps {
  currentTimeMs: number;
  durationMs: number;
  effectPreviewOverride?: { clipId: string; patch: ClipPatch } | null;
  isPlaying: boolean;
  playbackRate: number;
  resolution: string;
  tracks: Track[];
}

/**
 * Thin composition shell for the modular preview system.
 *
 * This replaces the old `PreviewArea` role as the preview entrypoint, but
 * intentionally does much less itself. Its job is to compose explicit
 * subsystems:
 * - surface sizing
 * - pure scene derivation
 * - caption document/preset resolution
 * - media element registration
 * - imperative media sync
 *
 * Keeping the root thin prevents preview rendering, playback, interaction
 * state, and media lifecycle logic from turning back into a single god object.
 */
export function PreviewStageRoot({
  currentTimeMs,
  durationMs,
  effectPreviewOverride,
  isPlaying,
  playbackRate,
  resolution,
  tracks,
}: PreviewStageRootProps) {
  const { t } = useTranslation();
  const outerRef = useRef<HTMLDivElement>(null);
  const assetUrlMap = useAssetUrlMap();
  const { previewSize, resolutionHeight, resolutionWidth } =
    usePreviewSurfaceSize(outerRef, resolution);

  const scene = useMemo(
    () =>
      derivePreviewScene({
        assetUrlMap,
        currentTimeMs,
        effectPreviewOverride,
        tracks,
      }),
    [assetUrlMap, currentTimeMs, effectPreviewOverride, tracks]
  );

  const activeCaptionClip = useMemo(
    () =>
      tracks
        .find((track) => track.type === "text")
        ?.clips.find((clip) => clip.id === scene.activeCaptionClipId) ?? null,
    [scene.activeCaptionClipId, tracks]
  );
  const { data: captionPresets } = useCaptionPresets();
  const { data: activeCaptionDoc } = useCaptionDoc(
    activeCaptionClip?.type === "caption" ? activeCaptionClip.captionDocId : null
  );
  const activeCaptionPreset = useMemo(() => {
    if (!activeCaptionClip || activeCaptionClip.type !== "caption") return null;
    const preset = captionPresets?.find(
      (item) => item.id === activeCaptionClip.stylePresetId
    );
    if (!preset) return null;
    return applyCaptionStyleOverrides(preset, activeCaptionClip.styleOverrides);
  }, [activeCaptionClip, captionPresets]);

  const captionCanvasRef = useCaptionCanvas({
    clip: activeCaptionClip?.type === "caption" ? activeCaptionClip : null,
    doc: activeCaptionDoc ?? null,
    preset: activeCaptionPreset,
    currentTimeMs,
    canvasW: Math.max(1, Math.round(previewSize?.w ?? resolutionWidth)),
    canvasH: Math.max(1, Math.round(previewSize?.h ?? resolutionHeight)),
  });

  const { audioClips, videoClips } = useMemo(
    () => collectMountedMediaClips(tracks),
    [tracks]
  );
  const { audioRefs, registerAudioRef, registerVideoRef, videoRefs } =
    usePreviewMediaRegistry(
      videoClips.map((clip) => clip.id),
      audioClips.map((clip) => clip.id)
    );

  usePreviewMediaSync({
    audioRefs,
    currentTimeMs,
    isPlaying,
    playbackRate,
    tracks,
    videoRefs,
  });

  return (
    <div
      ref={outerRef}
      className="flex-1 flex flex-col items-center justify-center bg-studio-bg overflow-hidden px-2 py-2 min-w-0"
    >
      <p className="text-[10px] font-semibold text-dim-3 mb-2 tracking-widest uppercase">
        {t("editor_preview_label")}
      </p>

      <PreviewStageSurface
        captionCanvasRef={captionCanvasRef}
        currentTimeMs={currentTimeMs}
        previewSize={previewSize}
        registerAudioRef={registerAudioRef}
        registerVideoRef={registerVideoRef}
        resolution={resolution}
        resolutionHeight={resolutionHeight}
        resolutionWidth={resolutionWidth}
        scene={scene}
        t={t}
        totalDurationMs={durationMs}
      />
    </div>
  );
}
