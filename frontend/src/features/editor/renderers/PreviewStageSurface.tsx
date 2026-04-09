import { useCallback } from "react";
import { Play } from "lucide-react";
import { formatHHMMSSd, formatMMSS } from "../utils/timecode";
import { getTextClipPreviewDisplay } from "../utils/text-segments";
import type { PreviewScene, PreviewVideoObject, PreviewAudioObject } from "../scene/preview-scene";

interface PreviewStageSurfaceProps {
  captionCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  currentTimeMs: number;
  previewSize: { h: number; w: number } | null;
  registerAudioRef: (clipId: string, element: HTMLAudioElement | null) => void;
  registerVideoRef: (clipId: string, element: HTMLVideoElement | null) => void;
  resolution: string;
  resolutionHeight: number;
  resolutionWidth: number;
  scene: PreviewScene;
  t: (key: string) => string;
  totalDurationMs: number;
}

/**
 * Stable video element wrapper. Using a component with useCallback keeps the
 * ref callback identity fixed across parent rerenders, preventing React from
 * calling the old ref with null and the new ref with the element on every frame.
 */
function VideoClipElement({
  clip,
  registerVideoRef,
}: {
  clip: PreviewVideoObject;
  registerVideoRef: (clipId: string, element: HTMLVideoElement | null) => void;
}) {
  const ref = useCallback(
    (el: HTMLVideoElement | null) => registerVideoRef(clip.id, el),
    [clip.id, registerVideoRef]
  );
  return (
    <div className="absolute inset-0">
      <video
        ref={ref}
        {...(clip.src ? { src: clip.src } : {})}
        className="absolute inset-0 w-full h-full object-contain"
        style={clip.style}
        playsInline
        preload={clip.preload}
      />
      {!clip.src && (
        <div className="absolute inset-0 bg-overlay-sm animate-pulse rounded" />
      )}
    </div>
  );
}

/**
 * Stable audio element wrapper — same ref-stability rationale as VideoClipElement.
 */
function AudioClipElement({
  clip,
  registerAudioRef,
}: {
  clip: PreviewAudioObject;
  registerAudioRef: (clipId: string, element: HTMLAudioElement | null) => void;
}) {
  const ref = useCallback(
    (el: HTMLAudioElement | null) => registerAudioRef(clip.id, el),
    [clip.id, registerAudioRef]
  );
  return <audio ref={ref} src={clip.src} preload={clip.preload} />;
}

/**
 * Renders the visual preview stage from a pre-derived scene model.
 *
 * This component is deliberately dumb: it receives already-computed stage
 * objects, mount decisions, and media registration callbacks, then focuses on
 * DOM output only. That separation keeps rendering distinct from scene
 * derivation and imperative playback/media runtime concerns.
 */
export function PreviewStageSurface({
  captionCanvasRef,
  currentTimeMs,
  previewSize,
  registerAudioRef,
  registerVideoRef,
  resolution,
  resolutionHeight,
  resolutionWidth,
  scene,
  t,
  totalDurationMs,
}: PreviewStageSurfaceProps) {
  const timecode = formatHHMMSSd(currentTimeMs);
  const position = formatMMSS(currentTimeMs);
  const total = formatMMSS(totalDurationMs);

  return (
    <>
      <div
        className="relative"
        style={{
          width: previewSize?.w ?? 0,
          height: previewSize?.h ?? 0,
        }}
      >
        <div
          className="absolute inset-0 bg-black overflow-hidden flex items-center justify-center"
          data-preview-mounted-audio-count={
            scene.audioObjects.filter((clip) => clip.shouldMount).length
          }
          data-preview-mounted-video-count={
            scene.videoObjects.filter((clip) => clip.shouldMount).length
          }
          data-preview-mount-window-ms={scene.adaptiveMountWindowMs}
        >
          {scene.videoObjects
            .filter((clip) => clip.shouldMount)
            .map((clip) => (
              <VideoClipElement
                key={clip.id}
                clip={clip}
                registerVideoRef={registerVideoRef}
              />
            ))}

          {scene.audioObjects
            .filter((clip) => clip.shouldMount)
            .map((clip) => (
              <AudioClipElement
                key={clip.id}
                clip={clip}
                registerAudioRef={registerAudioRef}
              />
            ))}

          {scene.textObjects.map(({ clip }) => {
            if (!clip.textContent) return null;

            const elapsed = currentTimeMs - clip.startMs;
            const displayText = getTextClipPreviewDisplay(
              clip.textContent,
              clip.durationMs,
              elapsed,
              clip.textAutoChunk
            );

            return (
              <div
                key={clip.id}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(calc(-50% + ${clip.positionX ?? 0}px), calc(-50% + ${clip.positionY ?? 0}px)) scale(${clip.scale ?? 1}) rotate(${clip.rotation ?? 0}deg)`,
                  fontSize: clip.textStyle?.fontSize ?? 32,
                  fontWeight: clip.textStyle?.fontWeight ?? "normal",
                  color: clip.textStyle?.color ?? "#fff",
                  textAlign: clip.textStyle?.align ?? "center",
                  opacity: clip.opacity ?? 1,
                  pointerEvents: "none",
                  userSelect: "none",
                  textShadow: "0 2px 8px rgba(0,0,0,0.8)",
                  whiteSpace: "pre-wrap",
                  width: "80%",
                  maxWidth: "80%",
                  zIndex: 10,
                  lineHeight: 1.2,
                }}
              >
                {displayText}
              </div>
            );
          })}

          <canvas
            ref={captionCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden="true"
          />

          {!scene.hasContent && (
            <div className="flex flex-col items-center gap-2">
              <Play size={32} className="text-white/40" />
              <span className="text-xs text-white/70">
                {t("editor_preview_empty")}
              </span>
            </div>
          )}

          <div className="absolute bottom-2 left-3 font-mono text-xs italic text-white/70 select-none">
            {timecode}
          </div>

          <div className="absolute top-2 right-3 text-[10px] bg-black/60 text-white/60 px-1.5 py-0.5 rounded">
            {resolution}
          </div>
        </div>
      </div>

      <div className="w-full flex justify-between mt-1 px-3">
        <span className="text-xs text-dim-3">
          {position} / {total}
        </span>
        <span className="text-xs text-dim-3">
          {resolutionWidth} × {resolutionHeight}
        </span>
      </div>
    </>
  );
}
