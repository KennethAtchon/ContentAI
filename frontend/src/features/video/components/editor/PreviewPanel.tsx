import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useContentAssets } from "@/features/audio/hooks/use-content-assets";
import type { CompositionRecord, Timeline } from "../../types/composition.types";
import { TimelineStrip } from "./TimelineStrip";

export type PreviewPanelProps = {
  generatedContentId: number;
  composition: CompositionRecord;
  onTimelineChange: (nextTimeline: Timeline) => void;
  selectedVideoClipId: string | null;
  selectedTextOverlayId: string | null;
  onSelectVideoClip: (clipId: string) => void;
};

export function PreviewPanel({
  generatedContentId,
  composition,
  onTimelineChange,
  selectedVideoClipId,
  selectedTextOverlayId,
  onSelectVideoClip,
}: PreviewPanelProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
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

  const clipCount = composition.timeline.tracks.video.length;
  const audioCount = composition.timeline.tracks.audio.length;
  const textCount = composition.timeline.tracks.text.length;
  const captionsEnabled = Boolean(
    (composition.timeline.tracks.captions[0] as Record<string, unknown> | undefined)
      ?.enabled,
  );

  return (
    <section className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {t("phase5_editor_preview")}
      </p>
      <div className="mt-2 space-y-1 text-xs text-foreground/80">
        <p>{t("phase5_editor_duration", { ms: composition.timeline.durationMs })}</p>
        <p>{t("phase5_editor_clip_count", { count: clipCount })}</p>
        <p>{t("phase5_editor_audio_count", { count: audioCount })}</p>
        <p>{t("phase5_editor_text_count", { count: textCount })}</p>
        <p>
          {captionsEnabled
            ? t("phase5_editor_captions_on")
            : t("phase5_editor_captions_off")}
        </p>
      </div>
      <div className="mt-3 rounded border border-border/60 bg-black/30 p-2">
        {previewVideoUrl ? (
          <>
            <div className="relative">
              <video
                ref={videoRef}
                src={previewVideoUrl}
                controls
                preload="metadata"
                onTimeUpdate={(event) =>
                  setCurrentTimeMs(Math.floor(event.currentTarget.currentTime * 1000))
                }
                className="aspect-[9/16] max-h-[420px] w-full rounded border border-border/60 bg-black object-contain"
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                <div className="p-2">
                  <p className="inline-flex rounded bg-black/50 px-2 py-0.5 text-[10px] text-white">
                    {t("phase5_editor_active_clip_overlay", {
                      index:
                        composition.timeline.tracks.video.findIndex(
                          (clip) => clip.id === activeClip?.id,
                        ) + 1,
                    })}
                  </p>
                  {activeClip?.id === selectedVideoClipId ? (
                    <p className="mt-1 inline-flex rounded bg-blue-500/60 px-2 py-0.5 text-[10px] text-white">
                      {t("phase5_editor_selected_clip_overlay")}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1 p-2">
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
                    <p className="rounded bg-amber-500/80 px-2 py-1 text-center text-xs font-semibold text-black">
                      {String(activeCaptionSegment.text ?? "")}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={Math.max(composition.timeline.durationMs, 1)}
                value={Math.min(currentTimeMs, composition.timeline.durationMs)}
                onChange={(event) => {
                  const nextMs = Number(event.currentTarget.value);
                  setCurrentTimeMs(nextMs);
                  if (videoRef.current) {
                    videoRef.current.currentTime = nextMs / 1000;
                  }
                }}
                className="flex-1"
              />
              <span className="w-28 text-right text-[10px] text-muted-foreground">
                {t("phase5_editor_playhead", {
                  current: Math.floor(currentTimeMs / 1000),
                  total: Math.floor(composition.timeline.durationMs / 1000),
                })}
              </span>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {t("phase5_editor_preview_unavailable")}
          </p>
        )}
      </div>
      <TimelineStrip
        timeline={composition.timeline}
        onChange={onTimelineChange}
        selectedVideoClipId={selectedVideoClipId}
        onSelectVideoClip={onSelectVideoClip}
        currentTimeMs={currentTimeMs}
        onSeekToMs={(nextMs) => {
          setCurrentTimeMs(nextMs);
          if (videoRef.current) {
            videoRef.current.currentTime = nextMs / 1000;
          }
        }}
      />
    </section>
  );
}
