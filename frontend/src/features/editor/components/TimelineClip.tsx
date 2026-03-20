import { useRef, useState } from "react";
import { TRACK_COLORS } from "../types/editor";
import type { Clip, TrackType } from "../types/editor";

interface Props {
  clip: Clip;
  trackType: TrackType;
  zoom: number; // px/s
  isSelected: boolean;
  isLocked: boolean;
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
  onSelect,
  onMove,
  onTrimStart,
  onTrimEnd,
}: Props) {
  const left = (clip.startMs / 1000) * zoom;
  const width = Math.max((clip.durationMs / 1000) * zoom, 4);
  const color = TRACK_COLORS[trackType];
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartMs = useRef(0);
  const [, forceUpdate] = useState(0);

  const handleDragStart = (e: React.MouseEvent) => {
    if (isLocked) return;
    e.stopPropagation();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartMs.current = clip.startMs;

    const onMove_ = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStartX.current;
      const deltaMs = (dx / zoom) * 1000;
      const newStart = Math.max(0, dragStartMs.current + deltaMs);
      onMove(newStart);
    };

    const onUp = () => {
      isDragging.current = false;
      forceUpdate((n) => n + 1);
      window.removeEventListener("mousemove", onMove_);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove_);
    window.addEventListener("mouseup", onUp);
  };

  const handleTrimLeft = (e: React.MouseEvent) => {
    if (isLocked) return;
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
    if (isLocked) return;
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

  const isAudioTrack = trackType === "audio" || trackType === "music";

  return (
    <div
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
      {/* Waveform overlay */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        preserveAspectRatio="none"
      >
        {isAudioTrack
          ? // Vertical bar waveform
            Array.from({ length: Math.ceil(width / 4) }).map((_, i) => (
              <rect
                key={i}
                x={i * 4 + 1}
                y={10 + Math.sin(i * 0.8) * 8}
                width={2}
                height={Math.abs(Math.sin(i * 1.3) * 20) + 2}
                fill={color}
              />
            ))
          : // Horizontal dashed line
            Array.from({ length: 4 }).map((_, i) => (
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
