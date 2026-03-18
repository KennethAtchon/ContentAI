import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useContentAssets } from "@/features/audio/hooks/use-content-assets";
import type { CompositionRecord, Timeline } from "../../types/composition.types";

export type PreviewPanelProps = {
  generatedContentId: number;
  composition: CompositionRecord;
  onTimelineChange: (nextTimeline: Timeline) => void;
  selectedVideoClipId: string | null;
  selectedTextOverlayId: string | null;
  onSelectVideoClip: (clipId: string) => void;
  // Playhead state is now lifted to EditorShell and shared with TimelineStrip
  currentTimeMs: number;
  onCurrentTimeChange: (ms: number) => void;
};

export function PreviewPanel({
  generatedContentId,
  composition,
  selectedVideoClipId,
  selectedTextOverlayId,
  currentTimeMs,
  onCurrentTimeChange,
}: PreviewPanelProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { data: assetsData } = useContentAssets(generatedContentId);
  const assets = assetsData?.assets ?? [];

  const assembledAsset = useMemo(
    () =>
      assets
        .filter((asset) => asset.type === "assembled_video" && asset.mediaUrl)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
    [assets],
  );
  const selectedVideoTrack = composition.timeline.tracks.video.find(
    (clip) => clip.id === selectedVideoClipId,
  );
  const selectedClipAsset = useMemo(
    () =>
      assets.find(
        (asset) =>
          asset.type === "video_clip" &&
          asset.id === selectedVideoTrack?.assetId &&
          asset.mediaUrl,
      ) ?? null,
    [assets, selectedVideoTrack?.assetId],
  );
  const firstClipAsset = useMemo(
    () => assets.find((asset) => asset.type === "video_clip" && asset.mediaUrl) ?? null,
    [assets],
  );
  const previewVideoUrl =
    selectedClipAsset?.mediaUrl ?? assembledAsset?.mediaUrl ?? firstClipAsset?.mediaUrl ?? null;

  const activeTextOverlays = useMemo(
    () =>
      composition.timeline.tracks.text.filter((overlay) => {
        const row = overlay as Record<string, unknown>;
        const startMs = Number(row.startMs ?? 0);
        const endMs = Number(row.endMs ?? composition.timeline.durationMs);
        return currentTimeMs >= startMs && currentTimeMs <= endMs;
      }),
    [composition.timeline.durationMs, composition.timeline.tracks.text, currentTimeMs],
  );
  const captionTrack = (composition.timeline.tracks.captions[0] ??
    null) as Record<string, unknown> | null;
  const activeCaptionSegment = useMemo(() => {
    const segments = Array.isArray(captionTrack?.segments)
      ? (captionTrack?.segments as Array<Record<string, unknown>>)
      : [];
    return (
      segments.find((segment) => {
        const startMs = Number(segment.startMs ?? 0);
        const endMs = Number(segment.endMs ?? composition.timeline.durationMs);
        return currentTimeMs >= startMs && currentTimeMs <= endMs;
      }) ?? null
    );
  }, [captionTrack?.segments, composition.timeline.durationMs, currentTimeMs]);

  const activeClip = useMemo(
    () =>
      composition.timeline.tracks.video.find(
        (clip) => currentTimeMs >= clip.startMs && currentTimeMs < clip.endMs,
      ) ?? composition.timeline.tracks.video[0],
    [composition.timeline.tracks.video, currentTimeMs],
  );

  // Sync video element when currentTimeMs changes externally (e.g. timeline click)
  useEffect(() => {
    if (!videoRef.current) return;
    const videoMs = Math.floor(videoRef.current.currentTime * 1000);
    // Only seek if the delta is large (external seek), not drifting from natural playback
    if (Math.abs(videoMs - currentTimeMs) > 200) {
      videoRef.current.currentTime = currentTimeMs / 1000;
    }
  }, [currentTimeMs]);

  const activeClipIndex =
    composition.timeline.tracks.video.findIndex((clip) => clip.id === activeClip?.id) + 1;

  return (
    // Fills the black center area completely — no outer border box
    <div className="h-full w-full flex flex-col items-center justify-center relative">
      {previewVideoUrl ? (
        <>
          {/* Video — centered, constrained to 9:16 */}
          <div className="relative flex-1 flex items-center justify-center w-full overflow-hidden">
            <video
              ref={videoRef}
              src={previewVideoUrl}
              controls
              preload="metadata"
              onTimeUpdate={(event) => {
                const ms = Math.floor(event.currentTarget.currentTime * 1000);
                onCurrentTimeChange(ms);
              }}
              className="h-full w-auto max-w-full aspect-[9/16] object-contain rounded"
            />

            {/* Floating overlays on the video */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
              {/* Top: clip indicator */}
              <div className="flex items-start gap-2">
                <span className="rounded bg-black/60 px-2 py-0.5 text-[10px] text-white/80">
                  {t("phase5_editor_active_clip_overlay", { index: activeClipIndex })}
                </span>
                {activeClip?.id === selectedVideoClipId && (
                  <span className="rounded bg-blue-500/70 px-2 py-0.5 text-[10px] text-white">
                    {t("phase5_editor_selected_clip_overlay")}
                  </span>
                )}
              </div>

              {/* Bottom: text overlays + captions */}
              <div className="space-y-1">
                {activeTextOverlays.map((overlay) => {
                  const row = overlay as Record<string, unknown>;
                  const id = String(row.id ?? "");
                  return (
                    <p
                      key={id}
                      className={`rounded px-2 py-1 text-center text-xs text-white shadow ${
                        id === selectedTextOverlayId
                          ? "border border-blue-300 bg-blue-500/60"
                          : "bg-black/60"
                      }`}
                    >
                      {String(row.content ?? "")}
                    </p>
                  );
                })}
                {captionTrack?.enabled && activeCaptionSegment ? (
                  <p className="rounded bg-warning/80 px-2 py-1 text-center text-xs font-semibold text-black">
                    {String(activeCaptionSegment.text ?? "")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Playhead scrubber — below video, inside the preview area */}
          <div className="w-full flex items-center gap-2 px-4 py-2 shrink-0 border-t border-overlay-sm">
            <input
              type="range"
              min={0}
              max={Math.max(composition.timeline.durationMs, 1)}
              value={Math.min(currentTimeMs, composition.timeline.durationMs)}
              onChange={(event) => {
                const nextMs = Number(event.currentTarget.value);
                // Immediately seek the video for responsiveness
                if (videoRef.current) {
                  videoRef.current.currentTime = nextMs / 1000;
                }
                onCurrentTimeChange(nextMs);
              }}
              className="flex-1 accent-blue-400"
            />
            <span className="text-[10px] text-dim-2 font-mono tabular-nums shrink-0">
              {t("phase5_editor_playhead", {
                current: Math.floor(currentTimeMs / 1000),
                total: Math.floor(composition.timeline.durationMs / 1000),
              })}
            </span>
          </div>
        </>
      ) : (
        <div className="text-center space-y-2">
          <p className="text-[13px] text-dim-3">{t("phase5_editor_preview_unavailable")}</p>
          <p className="text-[10px] text-dim-3">{t("phase5_editor_duration", { ms: composition.timeline.durationMs })}</p>
        </div>
      )}
    </div>
  );
}
