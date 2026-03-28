import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Clock, CircleAlert } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { TRACK_COLORS } from "../types/editor";
import type { Clip, Track, TrackType } from "../types/editor";
import { useWaveformData } from "../hooks/useWaveformData";
import { WaveformBars } from "./WaveformBars";
import { useAssetUrlMap } from "../contexts/asset-url-map-context";
import {
  collectSnapTargets,
  findNearestSnap,
  SNAP_THRESHOLD_PX,
} from "../utils/snap-targets";
import {
  clampMoveToFreeSpace,
  clampTrimEnd,
  clampTrimStart,
} from "../utils/clip-constraints";
import { slicePeaksForClipTrim } from "../utils/waveform-trim";
import {
  ClipContextMenu,
  PlaceholderContextMenu,
} from "./ClipContextMenu";
import { isClipActiveAtTimelineTime } from "../utils/editor-composition";

interface Props {
  clip: Clip;
  trackType: TrackType;
  track: Track;
  zoom: number; // px/s
  isSelected: boolean;
  isLocked: boolean;
  tracks: Track[];
  playheadMs: number;
  hasClipboard: boolean;
  onSelect: () => void;
  onMove: (newStartMs: number) => void;
  onTrimStart: (newTrimStartMs: number, newDurationMs: number) => void;
  onTrimEnd: (newDurationMs: number) => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onToggleEnabled: () => void;
  onRippleDelete: () => void;
  onDelete: () => void;
  onSetSpeed: (speed: number) => void;
}

export function TimelineClip({
  clip,
  trackType,
  track,
  zoom,
  isSelected,
  isLocked,
  tracks,
  playheadMs,
  hasClipboard,
  onSelect,
  onMove,
  onTrimStart,
  onTrimEnd,
  onSplit,
  onDuplicate,
  onCopy,
  onPaste,
  onToggleEnabled,
  onRippleDelete,
  onDelete,
  onSetSpeed,
}: Props) {
  const { t } = useTranslation();
  const left = (clip.startMs / 1000) * zoom;
  const width = Math.max((clip.durationMs / 1000) * zoom, 4);
  const color = TRACK_COLORS[trackType];
  const clipRef = useRef<HTMLDivElement>(null);
  const dragCurrentMs = useRef(0);
  const assetUrlMap = useAssetUrlMap();
  const isAudioTrack = trackType === "audio" || trackType === "music";
  const hasWaveform = isAudioTrack || trackType === "video";
  const isDisabled = clip.enabled === false;
  const playheadInsideClip = isClipActiveAtTimelineTime(clip, playheadMs);

  const waveformUrl = hasWaveform
    ? (assetUrlMap.get(clip.assetId ?? "") ?? undefined)
    : undefined;
  const { peaks, loading: waveformLoading } = useWaveformData(
    hasWaveform ? (clip.assetId ?? undefined) : undefined,
    waveformUrl
  );

  const trimmedPeaks = useMemo(
    () => slicePeaksForClipTrim(peaks, clip),
    [
      peaks,
      clip.trimStartMs,
      clip.durationMs,
      clip.trimEndMs,
      clip.sourceMaxDurationMs,
      clip.speed,
    ]
  );

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
      if (clipRef.current) {
        clipRef.current.style.left = `${(newStart / 1000) * zoom}px`;
      }
    };

    const onUp = () => {
      const finalMs = clampMoveToFreeSpace(track, clip.id, dragCurrentMs.current, clip.durationMs);
      onMove(finalMs);
      if (clipRef.current) {
        clipRef.current.style.left = `${(finalMs / 1000) * zoom}px`;
      }
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

    let pendingStart = origStart;
    let pendingDuration = origDuration;
    let pendingTrimStart = origTrimStart;

    const onMove_ = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const deltaMs = (dx / zoom) * 1000;
      let newStart = Math.max(0, origStart + deltaMs);
      newStart = clampTrimStart(track, clip, newStart);

      const requestedUsed = newStart - origStart;
      pendingTrimStart = Math.max(0, origTrimStart + requestedUsed);
      // Derive actual movement from clamped trimStart so we never expand left
      // past the source start boundary (trimStart can't go below 0).
      const effectiveUsed = pendingTrimStart - origTrimStart;
      pendingStart = origStart + effectiveUsed;
      pendingDuration = Math.max(100, origDuration - effectiveUsed);

      if (clipRef.current) {
        clipRef.current.style.left = `${(pendingStart / 1000) * zoom}px`;
        clipRef.current.style.width = `${Math.max((pendingDuration / 1000) * zoom, 4)}px`;
      }
    };

    const onUp = () => {
      onTrimStart(pendingTrimStart, pendingDuration);
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
    let pendingDuration = origDuration;

    // Hard cap: cannot stretch past source end.
    // Primary source: sourceMaxDurationMs (persisted, accounts for trimStartMs offset).
    // Fallback: trimEndMs buffer derived from invariant trimStartMs+durationMs+trimEndMs=sourceDuration.
    const maxDuration: number | undefined =
      clip.sourceMaxDurationMs !== undefined
        ? clip.sourceMaxDurationMs - (clip.trimStartMs ?? 0)
        : (clip.trimEndMs ?? 0) > 0
          ? origDuration + (clip.trimEndMs ?? 0)
          : undefined;

    const onMove_ = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const deltaMs = (dx / zoom) * 1000;
      let newDuration = Math.max(100, origDuration + deltaMs);
      newDuration = clampTrimEnd(track, clip, newDuration);
      if (maxDuration !== undefined) {
        newDuration = Math.min(newDuration, maxDuration);
      }
      pendingDuration = newDuration;

      if (clipRef.current) {
        clipRef.current.style.width = `${Math.max((pendingDuration / 1000) * zoom, 4)}px`;
      }
    };

    const onUp = () => {
      onTrimEnd(pendingDuration);
      window.removeEventListener("mousemove", onMove_);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove_);
    window.addEventListener("mouseup", onUp);
  };

  if (clip.isPlaceholder) {
    const st = clip.placeholderStatus ?? "pending";
    return (
      <PlaceholderContextMenu onDelete={onDelete}>
        <div
          ref={clipRef}
          className={cn(
            "absolute top-[7px] rounded select-none overflow-hidden flex flex-col justify-center",
            "border-2 border-dashed border-studio-fg/25 bg-studio-bg/80",
            isSelected ? "ring-2 ring-studio-accent" : "",
          )}
          style={{ left, width, height: 42 }}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
          <div className="flex items-center gap-1 px-1.5 min-w-0">
            {st === "generating" ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin text-dim-3" aria-hidden />
            ) : st === "failed" ? (
              <CircleAlert className="h-3 w-3 shrink-0 text-error" aria-hidden />
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
      </PlaceholderContextMenu>
    );
  }

  return (
    <ClipContextMenu
      clip={clip}
      track={track}
      hasClipboard={hasClipboard}
      onSplit={onSplit}
      onDuplicate={onDuplicate}
      onCopy={onCopy}
      onPaste={onPaste}
      onToggleEnabled={onToggleEnabled}
      onRippleDelete={onRippleDelete}
      onDelete={onDelete}
      onSetSpeed={onSetSpeed}
    >
      <div
        ref={clipRef}
        className={[
          "absolute top-[7px] rounded select-none cursor-grab active:cursor-grabbing",
          "overflow-hidden flex flex-col justify-between",
          isSelected ? "ring-2 ring-studio-accent" : "",
          playheadInsideClip && !isSelected ? "ring-1 ring-white/35" : "",
          isDisabled ? "opacity-40" : "",
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
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        {hasWaveform ? (
          <WaveformBars
            peaks={trimmedPeaks}
            loading={waveformLoading}
            color={color}
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

        <span
          className="text-[10px] font-medium px-1.5 pt-1 truncate pointer-events-none"
          style={{ color }}
        >
          {isDisabled ? "⊘ " : ""}{clip.label}
        </span>

        <span
          className="text-[9px] px-1.5 pb-0.5 opacity-50 pointer-events-none"
          style={{ color }}
        >
          {(clip.durationMs / 1000).toFixed(1)}s
        </span>

        <div
          className="absolute left-0 top-0 h-full w-2 cursor-ew-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10"
          style={{ backgroundColor: color + "66" }}
          onMouseDown={handleTrimLeft}
        >
          <div className="w-px h-4 bg-studio-fg/70 rounded" />
        </div>

        <div
          className="absolute right-0 top-0 h-full w-2 cursor-ew-resize flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-10"
          style={{ backgroundColor: color + "66" }}
          onMouseDown={handleTrimRight}
        >
          <div className="w-px h-4 bg-studio-fg/70 rounded" />
        </div>
      </div>
    </ClipContextMenu>
  );
}
