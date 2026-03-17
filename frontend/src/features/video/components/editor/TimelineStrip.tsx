import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Timeline } from "../../types/composition.types";
import { reorderVideoItems, setVideoItemDuration } from "../../utils/timeline-utils";

export function TimelineStrip({
  timeline,
  onChange,
  selectedVideoClipId,
  onSelectVideoClip,
}: {
  timeline: Timeline;
  onChange: (nextTimeline: Timeline) => void;
  selectedVideoClipId: string | null;
  onSelectVideoClip: (clipId: string) => void;
}) {
  const { t } = useTranslation();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const segments = useMemo(() => {
    const total = Math.max(timeline.durationMs, 1);
    return timeline.tracks.video.map((item, index) => {
      const duration = Math.max(item.endMs - item.startMs, 1);
      return {
        id: item.id,
        index,
        duration,
        widthPct: (duration / total) * 100,
      };
    });
  }, [timeline]);

  if (segments.length === 0) return null;

  const trimSegment = (index: number, deltaMs: number) => {
    const current = segments[index];
    if (!current) return;
    onChange(setVideoItemDuration(timeline, index, current.duration + deltaMs));
  };

  return (
    <div className="mt-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {t("phase5_editor_timeline")}
      </p>
      <div className="flex w-full overflow-hidden rounded border border-border/60 bg-muted/20">
        {segments.map((segment) => (
          <div
            key={segment.id}
            style={{ width: `${segment.widthPct}%` }}
            className={`min-h-10 border-r border-border/60 px-1.5 py-1 last:border-r-0 ${
              selectedVideoClipId === segment.id ? "bg-blue-500/30" : "bg-blue-500/15"
            }`}
            draggable
            onClick={() => onSelectVideoClip(segment.id)}
            onDragStart={() => setDragIndex(segment.index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragIndex === null) return;
              onChange(reorderVideoItems(timeline, dragIndex, segment.index));
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
          >
            <p className="truncate text-[10px] text-foreground/80">
              {segment.index + 1}
            </p>
            <div className="mt-1 flex items-center gap-1">
              <button
                onClick={() => trimSegment(segment.index, -500)}
                className="rounded border border-border/60 px-1 py-0.5 text-[10px] hover:bg-muted"
              >
                -
              </button>
              <button
                onClick={() => trimSegment(segment.index, 500)}
                className="rounded border border-border/60 px-1 py-0.5 text-[10px] hover:bg-muted"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {t("phase5_editor_timeline_hint")}
      </p>
    </div>
  );
}
