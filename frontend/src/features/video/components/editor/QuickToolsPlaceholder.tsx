import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { cn } from "@/shared/utils/helpers/utils";
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
  const [_ioMarkers, setIoMarkers] = useState<{ inMs: number | null; outMs: number | null }>({
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
    onChange({
      ...timeline,
      tracks: {
        ...timeline.tracks,
        text: [
          ...timeline.tracks.text,
          {
            id: overlayId,
            content: t("phase5_editor_text_default"),
            startMs: 0,
            endMs: Math.min(2000, timeline.durationMs),
            position: "center",
          },
        ],
      },
    });
    onSelectTextOverlay(overlayId);
  };

  const updateTextOverlay = (
    overlayId: string,
    field: "content" | "startMs" | "endMs",
    value: string | number,
  ) => {
    onChange({
      ...timeline,
      tracks: {
        ...timeline.tracks,
        text: timeline.tracks.text.map((overlay) => {
          const row = overlay as Record<string, unknown>;
          if (String(row.id ?? "") !== overlayId) return overlay;
          if (field === "content") return { ...row, content: String(value) };
          return { ...row, [field]: Number(value) };
        }),
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
    if (overlayId === selectedTextOverlayId) onSelectTextOverlay(null);
  };

  const toggleCaptions = () => {
    const currentTrack = timeline.tracks.captions[0] as Record<string, unknown> | undefined;
    const enabled = Boolean(currentTrack?.enabled);
    onChange({
      ...timeline,
      tracks: {
        ...timeline.tracks,
        captions: [
          {
            id: "caption-track-main",
            enabled: !enabled,
            stylePreset: "default",
            segments: [],
          },
        ],
      },
    });
  };

  const cycleCaptionStyle = () => {
    const currentTrack = timeline.tracks.captions[0] as Record<string, unknown> | undefined;
    const styles = ["default", "tiktok-highlight", "bold-impact"] as const;
    const currentStyle =
      typeof currentTrack?.stylePreset === "string" ? currentTrack.stylePreset : "default";
    const idx = styles.findIndex((s) => s === currentStyle);
    const nextStyle = styles[(idx + 1) % styles.length];
    onChange({
      ...timeline,
      tracks: {
        ...timeline.tracks,
        captions: [
          {
            id: String(currentTrack?.id ?? "caption-track-main"),
            enabled: Boolean(currentTrack?.enabled),
            stylePreset: nextStyle,
            segments: Array.isArray(currentTrack?.segments) ? currentTrack.segments : [],
          },
        ],
      },
    });
  };

  const cycleClipTransition = (clipId: string) => {
    const types = ["cut", "crossfade", "swipe", "fade"] as const;
    const nextVideo = timeline.tracks.video.map((item) => {
      if (item.id !== clipId) return item;
      const row = item as Record<string, unknown>;
      const currentType =
        typeof (row.transitionOut as Record<string, unknown> | undefined)?.type === "string"
          ? String((row.transitionOut as Record<string, unknown>).type)
          : "cut";
      const idx = types.findIndex((v) => v === currentType);
      const nextType = types[(idx + 1) % types.length];
      return {
        ...item,
        transitionOut: { type: nextType, durationMs: nextType === "cut" ? 0 : 250 },
      };
    });
    onChange({ ...timeline, tracks: { ...timeline.tracks, video: nextVideo } });
  };

  const formatTimecode = (ms: number) => {
    const totalFrames = Math.floor((ms / 1000) * timeline.fps);
    const frame = totalFrames % timeline.fps;
    const totalSeconds = Math.floor(totalFrames / timeline.fps);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frame.toString().padStart(2, "0")}`;
  };

  const timelineRows = useMemo(
    () => [
      { id: "video", label: t("phase5_editor_precision_lane_video"), count: timeline.tracks.video.length },
      { id: "audio", label: t("phase5_editor_precision_lane_audio"), count: timeline.tracks.audio.length },
      { id: "text", label: t("phase5_editor_precision_lane_text"), count: timeline.tracks.text.length },
      { id: "captions", label: t("phase5_editor_precision_lane_captions"), count: timeline.tracks.captions.length },
    ],
    [t, timeline.tracks.audio.length, timeline.tracks.captions.length, timeline.tracks.text.length, timeline.tracks.video.length],
  );

  const selectedClip = videoItems[selectedClipIndex];
  const selectedClipDuration = selectedClip
    ? selectedClip.endMs - selectedClip.startMs
    : 0;
  const captionTrack = timeline.tracks.captions[0] as Record<string, unknown> | undefined;
  const captionsEnabled = Boolean(captionTrack?.enabled);
  const captionStyle = String(captionTrack?.stylePreset ?? "default");

  const panelBtn =
    "px-2.5 py-1.5 rounded text-[10px] font-medium text-dim-2 hover:text-dim-1 hover:bg-overlay-sm transition-colors border border-overlay-md disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    // No outer border — the right column border in EditorShell provides separation
    <div className="flex flex-col">
      {/* Panel header */}
      <div className="px-3 py-2.5 border-b border-overlay-sm shrink-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-dim-3">
          {t("phase5_editor_tools")}
        </p>
      </div>

      {/* Precision mode controls */}
      {editMode === "precision" && (
        <div className="border-b border-overlay-sm px-3 py-3 space-y-3">
          <p className="text-[10px] font-semibold text-dim-2">
            {t("phase5_editor_precision_title")}
          </p>

          {/* Timecode + transport */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono text-[10px] text-dim-2 tabular-nums bg-overlay-sm px-2 py-1 rounded">
              {formatTimecode(precisionPlayheadMs)}
            </span>
            <button
              onClick={() => setTransportSpeed(transportSpeed === 0 ? 1 : 0)}
              className={panelBtn}
            >
              {transportSpeed === 0 ? "L" : "K"}
            </button>
            <button onClick={() => setTransportSpeed(2)} className={panelBtn}>
              J
            </button>
            <button
              onClick={() => setIoMarkers((prev) => ({ ...prev, inMs: precisionPlayheadMs }))}
              className={panelBtn}
            >
              I
            </button>
            <button
              onClick={() => setIoMarkers((prev) => ({ ...prev, outMs: precisionPlayheadMs }))}
              className={panelBtn}
            >
              O
            </button>
          </div>

          {/* Playhead slider */}
          <input
            type="range"
            min={0}
            max={Math.max(timeline.durationMs, 1)}
            value={Math.min(precisionPlayheadMs, timeline.durationMs)}
            onChange={(e) => setPrecisionPlayheadMs(Number(e.currentTarget.value))}
            className="w-full accent-blue-400"
          />

          {/* Zoom */}
          <div className="flex items-center gap-2 text-[9px] text-dim-3">
            <span>{t("phase5_editor_precision_zoom")}</span>
            <input
              type="range"
              min={1}
              max={8}
              step={0.5}
              value={precisionZoom}
              onChange={(e) => setPrecisionZoom(Number(e.currentTarget.value))}
              className="flex-1 accent-blue-400"
            />
            <span className="tabular-nums font-mono">×{precisionZoom.toFixed(1)}</span>
          </div>

          {/* Lane overview */}
          <div className="space-y-1">
            {timelineRows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between text-[9px] text-dim-2 py-0.5"
              >
                <span>{row.label}</span>
                <span className="tabular-nums text-dim-3">
                  {t("phase5_editor_precision_items", { count: row.count })}
                </span>
              </div>
            ))}
          </div>

          {/* Drop zone */}
          <div
            className="rounded border border-dashed border-overlay-lg px-2 py-2 text-[9px] text-dim-3 text-center hover:border-blue-400/30 hover:bg-blue-400/5 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const payload = e.dataTransfer.getData("application/x-contentai-video-asset");
              if (!payload) return;
              try {
                const parsed = JSON.parse(payload) as { assetId?: string; durationMs?: number };
                if (!parsed.assetId) return;
                onChange(
                  insertVideoItemAt(timeline, {
                    assetId: parsed.assetId,
                    durationMs: parsed.durationMs ?? 2000,
                    insertAtIndex: videoItems.length,
                  }),
                );
              } catch {
                // ignore
              }
            }}
          >
            {t("phase5_editor_precision_bring_in")}
          </div>
        </div>
      )}

      {/* Selected clip controls */}
      {videoItems.length > 0 && (
        <div className="border-b border-overlay-sm px-3 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-dim-2">
              {t("phase5_editor_selected_clip", { index: selectedClipIndex + 1 })}
            </p>
            {/* Duration input */}
            <input
              type="number"
              min={500}
              step={100}
              value={selectedClipDuration}
              onChange={(e) =>
                setClipDuration(
                  Math.min(selectedClipIndex, videoItems.length - 1),
                  Number(e.currentTarget.value),
                )
              }
              className="w-20 rounded bg-overlay-sm border border-overlay-md px-2 py-1 text-[10px] text-dim-1 font-mono tabular-nums text-right focus:outline-none focus:border-blue-400/50"
            />
          </div>

          {/* Clip navigator slider */}
          <input
            type="range"
            min={0}
            max={Math.max(videoItems.length - 1, 0)}
            step={1}
            value={Math.min(selectedClipIndex, videoItems.length - 1)}
            onChange={(e) => {
              const idx = Number(e.currentTarget.value);
              const clip = videoItems[idx];
              if (clip) onSelectVideoClip(clip.id);
            }}
            className="w-full accent-blue-400"
          />

          {/* Action buttons */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => moveClip(selectedClipIndex, -1)}
              disabled={selectedClipIndex === 0}
              className={panelBtn}
            >
              {t("phase5_editor_move_up")}
            </button>
            <button
              onClick={() => moveClip(selectedClipIndex, 1)}
              disabled={selectedClipIndex === videoItems.length - 1}
              className={panelBtn}
            >
              {t("phase5_editor_move_down")}
            </button>
            <button
              onClick={() => trimClipBy(selectedClipIndex, -500)}
              className={panelBtn}
            >
              {t("phase5_editor_trim_shorter")}
            </button>
            <button
              onClick={() => trimClipBy(selectedClipIndex, 500)}
              className={panelBtn}
            >
              {t("phase5_editor_trim_longer")}
            </button>
          </div>
        </div>
      )}

      {/* Clip list */}
      {videoItems.length > 0 && (
        <div className="border-b border-overlay-sm px-3 py-2 space-y-1 max-h-48 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {videoItems.map((item, index) => {
            const isSelected = selectedVideoClipId === item.id;
            const transition = String(
              ((item as Record<string, unknown>).transitionOut as Record<string, unknown> | undefined)?.type ?? "cut",
            );
            return (
              <div
                key={item.id}
                onClick={() => onSelectVideoClip(item.id)}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors",
                  isSelected
                    ? "bg-blue-500/15 text-primary"
                    : "hover:bg-overlay-xs text-dim-2",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "text-[9px] font-bold shrink-0",
                      isSelected ? "text-blue-300" : "text-dim-3",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="text-[10px] truncate">
                    {t("phase5_editor_clip_duration", { ms: item.endMs - item.startMs })}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleClipTransition(item.id);
                    }}
                    className="text-[8px] px-1.5 py-0.5 rounded text-dim-3 hover:text-dim-1 hover:bg-overlay-sm transition-colors"
                    title={t("phase5_editor_transition_cycle")}
                  >
                    {transition === "cut" ? "CUT" : transition.slice(0, 3).toUpperCase()}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Text & captions tools */}
      <div className="px-3 py-3 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={addTextOverlay} className={panelBtn}>
            {t("phase5_editor_add_text")}
          </button>
          <button
            onClick={toggleCaptions}
            className={cn(panelBtn, captionsEnabled && "border-warning/30 text-warning/70")}
          >
            {t("phase5_editor_toggle_captions")}
          </button>
          {captionsEnabled && (
            <button onClick={cycleCaptionStyle} className={panelBtn}>
              {captionStyle}
            </button>
          )}
        </div>

        {/* Text overlays */}
        {timeline.tracks.text.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-dim-3">
              {t("phase5_editor_text_overlays")}
            </p>
            {timeline.tracks.text.map((overlay) => {
              const row = overlay as Record<string, unknown>;
              const overlayId = String(row.id ?? "");
              const startMs = Number(row.startMs ?? 0);
              const endMs = Number(row.endMs ?? Math.min(2000, timeline.durationMs));
              const isSelected = selectedTextOverlayId === overlayId;
              return (
                <div
                  key={overlayId}
                  onClick={() => onSelectTextOverlay(overlayId)}
                  className={cn(
                    "rounded px-2 py-2 space-y-2 cursor-pointer border transition-colors",
                    isSelected
                      ? "border-blue-400/30 bg-blue-500/10"
                      : "border-overlay-sm bg-overlay-xs hover:bg-overlay-xs",
                  )}
                >
                  <input
                    value={String(row.content ?? "")}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateTextOverlay(overlayId, "content", e.currentTarget.value)}
                    className="w-full rounded bg-overlay-sm border border-overlay-md px-2 py-1 text-[10px] text-dim-1 focus:outline-none focus:border-blue-400/50"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="number"
                      min={0}
                      value={startMs}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateTextOverlay(overlayId, "startMs", Number(e.currentTarget.value))
                      }
                      className="rounded bg-overlay-sm border border-overlay-md px-2 py-1 text-[9px] text-dim-1 font-mono focus:outline-none focus:border-blue-400/50"
                    />
                    <input
                      type="number"
                      min={0}
                      value={endMs}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateTextOverlay(overlayId, "endMs", Number(e.currentTarget.value))
                      }
                      className="rounded bg-overlay-sm border border-overlay-md px-2 py-1 text-[9px] text-dim-1 font-mono focus:outline-none focus:border-blue-400/50"
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTextOverlay(overlayId);
                    }}
                    className="text-[9px] text-error/50 hover:text-error transition-colors"
                  >
                    {t("phase5_editor_remove_text")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
