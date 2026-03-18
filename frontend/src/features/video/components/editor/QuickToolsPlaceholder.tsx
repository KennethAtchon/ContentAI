import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import type { CompositionMode, Timeline } from "../../types/composition.types";
import {
  clampDuration,
  insertVideoItemAt,
  reorderVideoItems,
  setVideoItemDuration,
} from "../../utils/timeline-utils";

export function QuickToolsPlaceholder({
  timeline,
  onChange,
  selectedVideoClipId,
  selectedTextOverlayId,
  onSelectVideoClip,
  onSelectTextOverlay,
  editMode,
}: {
  timeline: Timeline;
  onChange: (nextTimeline: Timeline) => void;
  selectedVideoClipId: string | null;
  selectedTextOverlayId: string | null;
  onSelectVideoClip: (clipId: string) => void;
  onSelectTextOverlay: (overlayId: string | null) => void;
  editMode: CompositionMode;
}) {
  const { t } = useTranslation();
  const [precisionZoom, setPrecisionZoom] = useState(1);
  const [precisionPlayheadMs, setPrecisionPlayheadMs] = useState(0);
  const [ioMarkers, setIoMarkers] = useState<{ inMs: number | null; outMs: number | null }>({
    inMs: null,
    outMs: null,
  });
  const [transportSpeed, setTransportSpeed] = useState<0 | 1 | 2 | 4>(0);
  const videoItems = timeline.tracks.video;
  const selectedClipIndex = Math.max(
    0,
    videoItems.findIndex((item) => item.id === selectedVideoClipId),
  );

  const moveClip = (index: number, direction: -1 | 1) => {
    const to = index + direction;
    if (to < 0 || to >= videoItems.length) return;
    onChange(reorderVideoItems(timeline, index, to));
  };

  const setClipDuration = (index: number, durationMs: number) => {
    if (!Number.isFinite(durationMs)) return;
    onChange(setVideoItemDuration(timeline, index, durationMs));
  };

  const trimClipBy = (index: number, deltaMs: number) => {
    const current = videoItems[index];
    const duration = clampDuration(current.endMs - current.startMs + deltaMs);
    onChange(setVideoItemDuration(timeline, index, duration));
  };

  const addTextOverlay = () => {
    const overlayId = `text-${Date.now()}`;
    const nextText = [
      ...timeline.tracks.text,
      {
        id: overlayId,
        content: t("phase5_editor_text_default"),
        startMs: 0,
        endMs: Math.min(2000, timeline.durationMs),
        position: "center",
      },
    ];
    onChange({
      ...timeline,
      tracks: {
        ...timeline.tracks,
        text: nextText,
      },
    });
    onSelectTextOverlay(overlayId);
  };

  const updateTextOverlay = (
    overlayId: string,
    field: "content" | "startMs" | "endMs",
    value: string | number,
  ) => {
    const nextText = timeline.tracks.text.map((overlay) => {
      const row = overlay as Record<string, unknown>;
      if (String(row.id ?? "") !== overlayId) return overlay;
      if (field === "content") {
        return {
          ...row,
          content: String(value),
        };
      }
      return {
        ...row,
        [field]: Number(value),
      };
    });

    onChange({
      ...timeline,
      tracks: {
        ...timeline.tracks,
        text: nextText,
      },
    });
  };

  const removeTextOverlay = (overlayId: string) => {
    onChange({
      ...timeline,
      tracks: {
        ...timeline.tracks,
        text: timeline.tracks.text.filter((overlay) => {
          const row = overlay as Record<string, unknown>;
          return String(row.id ?? "") !== overlayId;
        }),
      },
    });
    if (overlayId === selectedTextOverlayId) {
      onSelectTextOverlay(null);
    }
  };

  const toggleCaptions = () => {
    const currentTrack = timeline.tracks.captions[0] as
      | Record<string, unknown>
      | undefined;
    const enabled = Boolean(currentTrack?.enabled);
    const nextTrack = {
      id: "caption-track-main",
      enabled: !enabled,
      stylePreset: "default",
      segments: [],
    };
    onChange({
      ...timeline,
      tracks: {
        ...timeline.tracks,
        captions: [nextTrack],
      },
    });
  };

  const cycleCaptionStyle = () => {
    const currentTrack = timeline.tracks.captions[0] as
      | Record<string, unknown>
      | undefined;
    const styles = ["default", "tiktok-highlight", "bold-impact"] as const;
    const currentStyle =
      typeof currentTrack?.stylePreset === "string"
        ? currentTrack.stylePreset
        : "default";
    const idx = styles.findIndex((style) => style === currentStyle);
    const nextStyle = styles[(idx + 1) % styles.length];
    const nextTrack = {
      id: String(currentTrack?.id ?? "caption-track-main"),
      enabled: Boolean(currentTrack?.enabled),
      stylePreset: nextStyle,
      segments: Array.isArray(currentTrack?.segments) ? currentTrack?.segments : [],
    };

    onChange({
      ...timeline,
      tracks: {
        ...timeline.tracks,
        captions: [nextTrack],
      },
    });
  };

  const cycleClipTransition = (clipId: string) => {
    const types = ["cut", "crossfade", "swipe", "fade"] as const;
    const nextVideo = timeline.tracks.video.map((item) => {
      if (item.id !== clipId) return item;
      const row = item as Record<string, unknown>;
      const currentType =
        typeof (row.transitionOut as Record<string, unknown> | undefined)?.type ===
        "string"
          ? String((row.transitionOut as Record<string, unknown>).type)
          : "cut";
      const idx = types.findIndex((value) => value === currentType);
      const nextType = types[(idx + 1) % types.length];
      return {
        ...item,
        transitionOut: {
          type: nextType,
          durationMs: nextType === "cut" ? 0 : 250,
        },
      };
    });

    onChange({
      ...timeline,
      tracks: {
        ...timeline.tracks,
        video: nextVideo,
      },
    });
  };

  const timelineRows = useMemo(
    () => [
      { id: "video", label: t("phase5_editor_precision_lane_video"), count: timeline.tracks.video.length },
      { id: "audio", label: t("phase5_editor_precision_lane_audio"), count: timeline.tracks.audio.length },
      { id: "text", label: t("phase5_editor_precision_lane_text"), count: timeline.tracks.text.length },
      {
        id: "captions",
        label: t("phase5_editor_precision_lane_captions"),
        count: timeline.tracks.captions.length,
      },
    ],
    [t, timeline.tracks.audio.length, timeline.tracks.captions.length, timeline.tracks.text.length, timeline.tracks.video.length],
  );

  const formatTimecode = (ms: number) => {
    const totalFrames = Math.floor((ms / 1000) * timeline.fps);
    const frame = totalFrames % timeline.fps;
    const totalSeconds = Math.floor(totalFrames / timeline.fps);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frame
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <section className="rounded-lg border border-border/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {t("phase5_editor_tools")}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("phase5_editor_tools_help")}
      </p>
      {editMode === "precision" ? (
        <div className="mt-3 space-y-2 rounded border border-border/60 bg-muted/20 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-medium text-foreground/90">
              {t("phase5_editor_precision_title")}
            </p>
            <span className="rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {formatTimecode(precisionPlayheadMs)}
            </span>
            <button
              onClick={() => setTransportSpeed(transportSpeed === 0 ? 1 : 0)}
              className="rounded border border-border/60 px-2 py-1 text-[10px] hover:bg-muted"
            >
              {transportSpeed === 0 ? "L" : "K"}
            </button>
            <button
              onClick={() => setTransportSpeed(2)}
              className="rounded border border-border/60 px-2 py-1 text-[10px] hover:bg-muted"
            >
              J
            </button>
            <button
              onClick={() =>
                setIoMarkers((prev) => ({
                  ...prev,
                  inMs: precisionPlayheadMs,
                }))
              }
              className="rounded border border-border/60 px-2 py-1 text-[10px] hover:bg-muted"
            >
              I
            </button>
            <button
              onClick={() =>
                setIoMarkers((prev) => ({
                  ...prev,
                  outMs: precisionPlayheadMs,
                }))
              }
              className="rounded border border-border/60 px-2 py-1 text-[10px] hover:bg-muted"
            >
              O
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(timeline.durationMs, 1)}
            value={Math.min(precisionPlayheadMs, timeline.durationMs)}
            onChange={(event) => setPrecisionPlayheadMs(Number(event.currentTarget.value))}
            className="w-full"
          />
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{t("phase5_editor_precision_zoom")}</span>
            <input
              type="range"
              min={1}
              max={8}
              step={0.5}
              value={precisionZoom}
              onChange={(event) => setPrecisionZoom(Number(event.currentTarget.value))}
              className="w-32"
            />
            <span>x{precisionZoom.toFixed(1)}</span>
            <span>{t("phase5_editor_precision_snapping")}</span>
          </div>
          <div className="max-h-44 space-y-1 overflow-auto rounded border border-border/60 bg-background/40 p-2">
            {timelineRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between rounded border border-border/50 px-2 py-1 text-[10px]"
              >
                <span>{row.label}</span>
                <span>{t("phase5_editor_precision_items", { count: row.count })}</span>
              </div>
            ))}
            <div
              className="rounded border border-dashed border-border/60 px-2 py-1 text-[10px] text-muted-foreground"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const payload = event.dataTransfer.getData(
                  "application/x-contentai-video-asset",
                );
                if (!payload) return;
                try {
                  const parsed = JSON.parse(payload) as {
                    assetId?: string;
                    durationMs?: number;
                  };
                  if (!parsed.assetId) return;
                  onChange(
                    insertVideoItemAt(timeline, {
                      assetId: parsed.assetId,
                      durationMs: parsed.durationMs ?? 2000,
                      insertAtIndex: videoItems.length,
                    }),
                  );
                } catch {
                  // Ignore invalid payload.
                }
              }}
            >
              {t("phase5_editor_precision_bring_in")}
            </div>
            <div className="rounded border border-border/50 px-2 py-1 text-[10px] text-muted-foreground">
              {t("phase5_editor_precision_keyframes")}
            </div>
            <div className="rounded border border-border/50 px-2 py-1 text-[10px] text-muted-foreground">
              {t("phase5_editor_precision_split_marker", {
                from: ioMarkers.inMs ?? "-",
                to: ioMarkers.outMs ?? "-",
              })}
            </div>
          </div>
        </div>
      ) : null}
      <div className="mt-3 space-y-2">
        {videoItems.length > 0 && (
          <div className="rounded border border-border/60 bg-muted/20 p-2">
            <p className="text-[11px] text-foreground/80">
              {t("phase5_editor_selected_clip", {
                index: selectedClipIndex + 1,
              })}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={Math.max(videoItems.length - 1, 0)}
                step={1}
                value={Math.min(selectedClipIndex, videoItems.length - 1)}
                onChange={(event) => {
                  const idx = Number(event.currentTarget.value);
                  const clip = videoItems[idx];
                  if (clip) onSelectVideoClip(clip.id);
                }}
                className="flex-1"
              />
              <input
                type="number"
                min={500}
                step={100}
                value={
                  (videoItems[Math.min(selectedClipIndex, videoItems.length - 1)]
                    ?.endMs ?? 1000) -
                  (videoItems[Math.min(selectedClipIndex, videoItems.length - 1)]
                    ?.startMs ?? 0)
                }
                onChange={(event) =>
                  setClipDuration(
                    Math.min(selectedClipIndex, videoItems.length - 1),
                    Number(event.currentTarget.value),
                  )
                }
                className="w-24 rounded border border-border/60 bg-background px-2 py-1 text-[11px]"
              />
            </div>
          </div>
        )}
        {videoItems.map((item, index) => (
          <div
            key={item.id}
            className={`rounded border p-2 ${
              selectedVideoClipId === item.id
                ? "border-blue-400/60 bg-blue-500/10"
                : "border-border/60 bg-muted/20"
            }`}
            onClick={() => onSelectVideoClip(item.id)}
          >
            <p className="text-[11px] text-foreground/80">
              {t("phase5_editor_clip_label", { index: index + 1 })}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("phase5_editor_clip_duration", {
                ms: item.endMs - item.startMs,
              })}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => moveClip(index, -1)}
                disabled={index === 0}
                aria-disabled={index === 0}
                className="min-h-9 rounded border border-border/60 px-2.5 py-1 text-[11px] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
              >
                {t("phase5_editor_move_up")}
              </button>
              <button
                onClick={() => moveClip(index, 1)}
                disabled={index === videoItems.length - 1}
                aria-disabled={index === videoItems.length - 1}
                className="min-h-9 rounded border border-border/60 px-2.5 py-1 text-[11px] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
              >
                {t("phase5_editor_move_down")}
              </button>
              <button
                onClick={() => trimClipBy(index, -500)}
                className="min-h-9 rounded border border-border/60 px-2.5 py-1 text-[11px] hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
              >
                {t("phase5_editor_trim_shorter")}
              </button>
              <button
                onClick={() => trimClipBy(index, 500)}
                className="min-h-9 rounded border border-border/60 px-2.5 py-1 text-[11px] hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
              >
                {t("phase5_editor_trim_longer")}
              </button>
              <button
                onClick={() => cycleClipTransition(item.id)}
                className="min-h-9 rounded border border-border/60 px-2.5 py-1 text-[11px] hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
              >
                {t("phase5_editor_transition_cycle")}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {t("phase5_editor_transition_current", {
                value: String(
                  ((item as Record<string, unknown>).transitionOut as
                    | Record<string, unknown>
                    | undefined)?.type ?? "cut",
                ),
              })}
            </p>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={addTextOverlay}
            className="min-h-9 rounded border border-border/60 px-2.5 py-1 text-[11px] hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
          >
            {t("phase5_editor_add_text")}
          </button>
          <button
            onClick={toggleCaptions}
            className="min-h-9 rounded border border-border/60 px-2.5 py-1 text-[11px] hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
          >
            {t("phase5_editor_toggle_captions")}
          </button>
          <button
            onClick={cycleCaptionStyle}
            className="min-h-9 rounded border border-border/60 px-2.5 py-1 text-[11px] hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
          >
            {t("phase5_editor_cycle_caption_style")}
          </button>
        </div>
        {timeline.tracks.text.length > 0 && (
          <div className="space-y-2 rounded border border-border/60 bg-muted/20 p-2">
            <p className="text-[11px] font-medium text-foreground/80">
              {t("phase5_editor_text_overlays")}
            </p>
            {timeline.tracks.text.map((overlay) => {
              const row = overlay as Record<string, unknown>;
              const overlayId = String(row.id ?? "");
              const startMs = Number(row.startMs ?? 0);
              const endMs = Number(row.endMs ?? Math.min(2000, timeline.durationMs));
              return (
                <div
                  key={overlayId}
                  className={`rounded border p-2 ${
                    selectedTextOverlayId === overlayId
                      ? "border-blue-400/60 bg-blue-500/10"
                      : "border-border/60 bg-background/40"
                  }`}
                  onClick={() => onSelectTextOverlay(overlayId)}
                >
                  <input
                    value={String(row.content ?? "")}
                    onChange={(event) =>
                      updateTextOverlay(
                        overlayId,
                        "content",
                        event.currentTarget.value,
                      )
                    }
                    className="w-full rounded border border-border/60 bg-background px-2 py-1 text-[11px]"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      value={startMs}
                      onChange={(event) =>
                        updateTextOverlay(
                          overlayId,
                          "startMs",
                          Number(event.currentTarget.value),
                        )
                      }
                      className="rounded border border-border/60 bg-background px-2 py-1 text-[11px]"
                    />
                    <input
                      type="number"
                      min={0}
                      value={endMs}
                      onChange={(event) =>
                        updateTextOverlay(
                          overlayId,
                          "endMs",
                          Number(event.currentTarget.value),
                        )
                      }
                      className="rounded border border-border/60 bg-background px-2 py-1 text-[11px]"
                    />
                  </div>
                  <button
                    onClick={() => removeTextOverlay(overlayId)}
                    className="mt-2 rounded border border-red-300/40 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/20"
                  >
                    {t("phase5_editor_remove_text")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
