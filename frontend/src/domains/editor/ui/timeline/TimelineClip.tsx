import { memo } from "react";
import { Clock, CircleAlert, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TRACK_COLORS } from "../../model/editor";
import type { Clip, Track, TrackType } from "../../model/editor";
import { isMediaClip, isVideoClip } from "../../lib/clip-types";
import { ClipContextMenu, PlaceholderContextMenu } from "./ClipContextMenu";

interface Props {
  clip: Clip;
  trackType: TrackType;
  track: Track;
  zoom: number;
  isSelected: boolean;
  isLocked: boolean;
  tracks: Track[];
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
  onSnapChange?: (snapMs: number | null) => void;
}

function TimelineClipInner({
  clip,
  trackType,
  track,
  zoom,
  isSelected,
  hasClipboard,
  onSelect,
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
  const mediaClip = isMediaClip(clip) ? clip : null;
  const videoClip = isVideoClip(clip) ? clip : null;
  const isDisabled = mediaClip?.enabled === false;

  if (videoClip?.isPlaceholder) {
    const status = videoClip.placeholderStatus ?? "pending";
    return (
      <PlaceholderContextMenu onDelete={onDelete}>
        <div
          className={[
            "absolute top-[7px] rounded select-none overflow-hidden flex flex-col justify-center",
            "border-2 border-dashed border-studio-fg/25 bg-studio-bg/80",
            isSelected ? "ring-2 ring-studio-accent" : "",
          ].join(" ")}
          style={{ left, width, height: 42 }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          <div className="flex items-center gap-1 px-1.5 min-w-0">
            {status === "generating" ? (
              <Loader2
                className="h-3 w-3 shrink-0 animate-spin text-dim-3"
                aria-hidden
              />
            ) : status === "failed" ? (
              <CircleAlert
                className="h-3 w-3 shrink-0 text-error"
                aria-hidden
              />
            ) : (
              <Clock className="h-3 w-3 shrink-0 text-dim-3" aria-hidden />
            )}
            <span className="text-[10px] font-medium text-dim-2 truncate">
              {videoClip.placeholderLabel ?? videoClip.label}
            </span>
          </div>
          <span className="text-[9px] px-1.5 text-dim-4">
            {status === "generating"
              ? t("timeline_placeholder_generating")
              : status === "failed"
                ? t("timeline_placeholder_failed")
                : t("timeline_placeholder_queued")}
          </span>
        </div>
      </PlaceholderContextMenu>
    );
  }

  return (
    <ClipContextMenu
      clip={mediaClip ?? clip}
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
        className={[
          "absolute top-[7px] rounded select-none overflow-hidden flex flex-col justify-between",
          isSelected ? "ring-2 ring-studio-accent" : "",
          isDisabled ? "opacity-40" : "",
        ].join(" ")}
        style={{
          left,
          width,
          height: 42,
          backgroundColor: `${color}33`,
          borderLeft: `3px solid ${color}`,
          borderTop: `1px solid ${color}44`,
          borderBottom: `1px solid ${color}44`,
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
          preserveAspectRatio="none"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <line
              key={index}
              x1={0}
              y1={8 + index * 9}
              x2={width}
              y2={8 + index * 9}
              stroke={color}
              strokeDasharray="4 4"
            />
          ))}
        </svg>

        <span
          className="text-[10px] font-medium px-1.5 pt-1 truncate pointer-events-none"
          style={{ color }}
        >
          {isDisabled ? "Disabled " : ""}
          {clip.type === "caption"
            ? "Caption"
            : "label" in clip
              ? clip.label
              : "Clip"}
        </span>

        <span
          className="text-[9px] px-1.5 pb-0.5 opacity-50 pointer-events-none"
          style={{ color }}
        >
          {(clip.durationMs / 1000).toFixed(1)}s
        </span>
      </div>
    </ClipContextMenu>
  );
}

export const TimelineClip = memo(TimelineClipInner);
