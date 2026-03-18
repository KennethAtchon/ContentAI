import { useMemo, useState } from "react";
import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import type { Timeline } from "../../types/composition.types";
import {
  insertVideoItemAt,
  reorderVideoItems,
  setVideoItemDuration,
  setVideoItemDurationById,
} from "../../utils/timeline-utils";

export function TimelineStrip({
  timeline,
  onChange,
  selectedVideoClipId,
  onSelectVideoClip,
  currentTimeMs,
  onSeekToMs,
}: {
  timeline: Timeline;
  onChange: (nextTimeline: Timeline) => void;
  selectedVideoClipId: string | null;
  onSelectVideoClip: (clipId: string) => void;
  currentTimeMs: number;
  onSeekToMs: (ms: number) => void;
}) {
  const { t } = useTranslation();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [trimDrag, setTrimDrag] = useState<{
    clipId: string;
    startX: number;
    startDurationMs: number;
  } | null>(null);
  const segments = useMemo(() => {
    const total = Math.max(timeline.durationMs, 1);
    return timeline.tracks.video.map((item, index) => {
      const duration = Math.max(item.endMs - item.startMs, 1);
      return {
        ...item,
        id: item.id,
        index,
        duration,
        sourceType: item.assetId ? item.assetId.split("_")[0] ?? "asset" : "manual",
        transitionType: item.transitionOut?.type ?? "cut",
        transitionDurationMs: item.transitionOut?.durationMs ?? 0,
        widthPct: (duration / total) * 100,
      };
    });
  }, [timeline]);

  const trimSegment = (index: number, deltaMs: number) => {
    const current = segments[index];
    if (!current) return;
    onChange(setVideoItemDuration(timeline, index, current.duration + deltaMs));
  };

  const handleDropInsert = (
    event: DragEvent,
    insertAtIndex: number,
  ) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData("application/x-contentai-video-asset");
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
          insertAtIndex,
        }),
      );
    } catch {
      // Ignore invalid drag payloads
    }
  };

  const activeSegmentId = useMemo(
    () =>
      segments.find(
        (segment) =>
          currentTimeMs >= segment.startMs && currentTimeMs < segment.endMs,
      )?.id ?? segments[segments.length - 1]?.id,
    [currentTimeMs, segments],
  );

  if (segments.length === 0) return null;

  const transitionIcon = (type: string) => {
    if (type === "crossfade") return "⤿";
    if (type === "swipe") return "↦";
    if (type === "fade") return "◌";
    return "│";
  };

  return (
    <div className="mt-3">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {t("phase5_editor_timeline")}
      </p>
      <div className="flex w-full overflow-hidden rounded border border-border/60 bg-muted/20">
        <div
          className="w-1.5 border-r border-dashed border-border/60"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => handleDropInsert(event, 0)}
        />
        {segments.map((segment) => (
          <div key={segment.id} className="group flex min-w-0" style={{ width: `${segment.widthPct}%` }}>
            <div
              style={{ width: "100%" }}
              className={`relative min-h-14 border-r border-border/60 px-1.5 py-1 last:border-r-0 ${
                selectedVideoClipId === segment.id
                  ? "bg-blue-500/30"
                  : activeSegmentId === segment.id
                    ? "bg-blue-500/25"
                    : "bg-blue-500/15"
              }`}
              draggable
              onClick={() => {
                onSelectVideoClip(segment.id);
                onSeekToMs(segment.startMs);
              }}
              onDragStart={() => setDragIndex(segment.index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragIndex === null) return;
                onChange(reorderVideoItems(timeline, dragIndex, segment.index));
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <button
                className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-sm bg-white/20 opacity-70 transition group-hover:opacity-100"
                aria-label={t("phase5_editor_trim_handle")}
                onMouseDown={(event) =>
                  setTrimDrag({
                    clipId: segment.id,
                    startX: event.clientX,
                    startDurationMs: segment.duration,
                  })
                }
                onMouseMove={(event) => {
                  if (!trimDrag || trimDrag.clipId !== segment.id) return;
                  const deltaPx = event.clientX - trimDrag.startX;
                  const deltaMs = Math.round((deltaPx / 8) * 100);
                  onChange(
                    setVideoItemDurationById(
                      timeline,
                      segment.id,
                      trimDrag.startDurationMs + deltaMs,
                    ),
                  );
                }}
                onMouseUp={() => setTrimDrag(null)}
                onMouseLeave={() => {
                  if (trimDrag?.clipId === segment.id) setTrimDrag(null);
                }}
              />
              <p className="truncate text-[10px] text-foreground/80">
                {segment.index + 1} · {segment.sourceType}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {Math.round(segment.duration / 100) / 10}s
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {transitionIcon(segment.transitionType)} {segment.transitionType}
                {segment.transitionDurationMs > 0
                  ? ` ${Math.round(segment.transitionDurationMs)}ms`
                  : ""}
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
            <div
              className="w-1.5 border-r border-dashed border-border/60"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDropInsert(event, segment.index + 1)}
            />
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {t("phase5_editor_timeline_hint")}
      </p>
    </div>
  );
}
