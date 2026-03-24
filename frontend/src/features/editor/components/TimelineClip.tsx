import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Clock, CircleAlert } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { TRACK_COLORS } from "../types/editor";
import type { Clip, Track, TrackType } from "../types/editor";
import { useWaveform } from "../hooks/use-waveform";
import { useAssetUrlMap } from "../contexts/asset-url-map-context";
import {
  collectSnapTargets,
  findNearestSnap,
  SNAP_THRESHOLD_PX,
} from "../utils/snap-targets";

interface Props {
  clip: Clip;
  trackType: TrackType;
  zoom: number; // px/s
  isSelected: boolean;
  isLocked: boolean;
  tracks: Track[];
  playheadMs: number;
  onSelect: () => void;
  onMove: (newStartMs: number) => void;
  onTrimStart: (newTrimStartMs: number, newDurationMs: number) => void;
  onTrimEnd: (newDurationMs: number) => void;
}

export function TimelineClip({
  clip,
  trackType,
  zoom,
  isSelected,
  isLocked,
  tracks,
  playheadMs,
  onSelect,
  onMove,
  onTrimStart,
  onTrimEnd,
}: Props) {
  const { t } = useTranslation();
  const left = (clip.startMs / 1000) * zoom;
  const width = Math.max((clip.durationMs / 1000) * zoom, 4);
  const color = TRACK_COLORS[trackType];
  const clipRef = useRef<HTMLDivElement>(null);
  const dragCurrentMs = useRef(0);
  const assetUrlMap = useAssetUrlMap();
  const isAudioTrack = trackType === "audio" || trackType === "music";
  const waveformContainerRef = useRef<HTMLDivElement>(null);

  useWaveform({
    audioUrl: isAudioTrack
      ? (assetUrlMap.get(clip.assetId ?? "") ?? undefined)
      : undefined,
    container: waveformContainerRef.current,
    waveColor: color,
    height: 32,
  });

  const handleDragStart = (e: React.MouseEvent) => {
    if (isLocked || clip.isPlaceholder) return;
    e.stopPropagation();
    const dragStartX = e.clientX;
    const dragStartMs = clip.startMs;
    dragCurrentMs.current = dragStartMs;

    const snapTargets = collectSnapTargets(tracks, clip.id, playheadMs);

    const onMove_ = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStartX;
      const deltaMs = (dx / zoom) * 1000;
      let newStart = Math.max(0, dragStartMs + deltaMs);

      if (!ev.shiftKey) {
        const thresholdMs = (SNAP_THRESHOLD_PX / zoom) * 1000;
        const snapped = findNearestSnap(newStart, snapTargets, thresholdMs);
        if (snapped !== null) newStart = snapped;
      }

      dragCurrentMs.current = newStart;
      // Update DOM directly — no dispatch during drag
      if (clipRef.current) {
        clipRef.current.style.left = `${(newStart / 1000) * zoom}px`;
      }
    };

    const onUp = () => {
      // Commit position to store on mouseUp only
      onMove(dragCurrentMs.current);
      window.removeEventListener("mousemove", onMove_);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove_);
    window.addEventListener("mouseup", onUp);
  };

  const handleTrimLeft = (e: React.MouseEvent) => {
    if (isLocked || clip.isPlaceholder) return;
    e.stopPropagation();
    const startX = e.clientX;
    const origStart = clip.startMs;
    const origDuration = clip.durationMs;
    const origTrimStart = clip.trimStartMs;

    const onMove_ = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const deltaMs = (dx / zoom) * 1000;
      const newStart = Math.max(0, origStart + deltaMs);
      const used = newStart - origStart;
      const newDuration = Math.max(100, origDuration - used);
      const newTrimStart = Math.max(0, origTrimStart + used);
      onTrimStart(newTrimStart, newDuration);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove_);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove_);
    window.addEventListener("mouseup", onUp);
  };

  const handleTrimRight = (e: React.MouseEvent) => {
    if (isLocked || clip.isPlaceholder) return;
    e.stopPropagation();
    const startX = e.clientX;
    const origDuration = clip.durationMs;

    const onMove_ = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const deltaMs = (dx / zoom) * 1000;
      const newDuration = Math.max(100, origDuration + deltaMs);
      onTrimEnd(newDuration);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove_);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove_);
    window.addEventListener("mouseup", onUp);
  };

  if (clip.isPlaceholder) {
    const st = clip.placeholderStatus ?? "pending";
    return (
      <div
        ref={clipRef}
        className={cn(
          "absolute top-[7px] rounded select-none overflow-hidden flex flex-col justify-center",
          "border-2 border-dashed border-studio-fg/25 bg-studio-bg/80",
          isSelected ? "ring-2 ring-studio-accent" : "",
        )}
        style={{
          left,
          width,
          height: 42,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        <div className="flex items-center gap-1 px-1.5 min-w-0">
          {st === "generating" ? (
            <Loader2
              className="h-3 w-3 shrink-0 animate-spin text-dim-3"
              aria-hidden
            />
          ) : st === "failed" ? (
            <CircleAlert
              className="h-3 w-3 shrink-0 text-error"
              aria-hidden
            />
          ) : (
            <Clock className="h-3 w-3 shrink-0 text-dim-3" aria-hidden />
          )}
          <span className="text-[10px] font-medium text-dim-2 truncate">
            {clip.placeholderLabel ?? clip.label}
          </span>
        </div>
        <span className="text-[9px] px-1.5 text-dim-4">
          {st === "generating"
            ? t("timeline_placeholder_generating")
            : st === "failed"
              ? t("timeline_placeholder_failed")
              : t("timeline_placeholder_queued")}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={clipRef}
      className={[
        "absolute top-[7px] rounded select-none cursor-grab active:cursor-grabbing",
        "overflow-hidden flex flex-col justify-between",
        isSelected ? "ring-2 ring-studio-accent" : "",
      ].join(" ")}
      style={{
        left,
        width,
        height: 42,
        backgroundColor: color + "33",
        borderLeft: `3px solid ${color}`,
        borderTop: `1px solid ${color}44`,
        borderBottom: `1px solid ${color}44`,
      }}
      onMouseDown={handleDragStart}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Waveform overlay (audio tracks) or dashed pattern (video/text) */}
      {isAudioTrack ? (
        <div
          ref={waveformContainerRef}
          className="absolute inset-0 opacity-30 pointer-events-none"
        />
      ) : (
        <svg
          className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
          preserveAspectRatio="none"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <line
              key={i}
              x1={0}
              y1={8 + i * 9}
              x2={width}
              y2={8 + i * 9}
              stroke={color}
              strokeDasharray="4 4"
            />
          ))}
        </svg>
      )}

      {/* Clip name */}
      <span
        className="text-[10px] font-medium px-1.5 pt-1 truncate pointer-events-none"
        style={{ color }}
      >
        {clip.label}
      </span>

      {/* Duration */}
      <span
        className="text-[9px] px-1.5 pb-0.5 opacity-50 pointer-events-none"
        style={{ color }}
      >
        {(clip.durationMs / 1000).toFixed(1)}s
      </span>

      {/* Trim handle left */}
      <div
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10"
        style={{ backgroundColor: color + "66" }}
        onMouseDown={handleTrimLeft}
      >
        <div className="w-px h-4 bg-studio-fg/70 rounded" />
      </div>

      {/* Trim handle right */}
      <div
        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10"
        style={{ backgroundColor: color + "66" }}
        onMouseDown={handleTrimRight}
      >
        <div className="w-px h-4 bg-studio-fg/70 rounded" />
      </div>
    </div>
  );
}
