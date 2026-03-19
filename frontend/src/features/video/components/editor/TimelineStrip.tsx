import { useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";
import type { Timeline } from "../../types/composition.types";
import {
  insertVideoItemAt,
  reorderVideoItems,
  setVideoItemDurationById,
} from "../../utils/timeline-utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMsFull(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const frames = Math.floor(((ms % 1000) / 1000) * 30);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${frames.toString().padStart(2, "0")}`;
}

function formatMsLabel(ms: number): string {
  const totalSec = ms / 1000;
  if (ms === 0) return "0s";
  if (totalSec < 60) return `${Number.isInteger(totalSec) ? totalSec : totalSec.toFixed(1)}s`;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getRulerInterval(durationMs: number): number {
  const candidates = [200, 500, 1000, 2000, 5000, 10000, 30000, 60000];
  return candidates.find((c) => durationMs / c <= 14) ?? 1000;
}

// ── Interaction state machine ─────────────────────────────────────────────────

type Interaction =
  | { type: "idle" }
  | { type: "scrubbing" }
  | { type: "trimming"; clipId: string; startX: number; startDurationMs: number };

// ── Component ─────────────────────────────────────────────────────────────────

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
  const rulerRef = useRef<HTMLDivElement>(null);
  const trackAreaRef = useRef<HTMLDivElement>(null);

  // Interaction state — one active at a time
  const [interaction, setInteraction] = useState<Interaction>({ type: "idle" });

  // HTML5 drag for reorder and media-bin drops
  const [reorderFromIndex, setReorderFromIndex] = useState<number | null>(null);
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null); // gap being hovered during any drag
  const [isMediaDragOver, setIsMediaDragOver] = useState(false);

  // ── Derived data ────────────────────────────────────────────────────────────

  const totalMs = Math.max(timeline.durationMs, 1);

  const segments = useMemo(
    () =>
      timeline.tracks.video.map((item, index) => {
        const duration = Math.max(item.endMs - item.startMs, 1);
        const startPct = (item.startMs / totalMs) * 100;
        const widthPct = (duration / totalMs) * 100;
        const transitionType =
          typeof (item as Record<string, unknown>).transitionOut === "object"
            ? String(
                (
                  (item as Record<string, unknown>).transitionOut as Record<string, unknown>
                )?.type ?? "cut",
              )
            : "cut";
        return { ...item, index, duration, startPct, widthPct, transitionType };
      }),
    [timeline.tracks.video, totalMs],
  );

  const audioItems = timeline.tracks.audio;
  const textItems = timeline.tracks.text;
  const captionTrack = timeline.tracks.captions[0] as Record<string, unknown> | undefined;
  const captionsEnabled = Boolean(captionTrack?.enabled);

  const activeSegmentId = useMemo(
    () =>
      segments.find((s) => currentTimeMs >= s.startMs && currentTimeMs < s.endMs)?.id ??
      segments[segments.length - 1]?.id,
    [currentTimeMs, segments],
  );

  const playheadPct = (currentTimeMs / totalMs) * 100;

  const rulerTicks = useMemo(() => {
    const interval = getRulerInterval(totalMs);
    const ticks: number[] = [];
    for (let ms = 0; ms <= totalMs; ms += interval) {
      ticks.push(ms);
    }
    return { ticks, interval };
  }, [totalMs]);

  // ── Ruler: pointer-captured scrubbing ───────────────────────────────────────

  const seekFromRulerEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = rulerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeekToMs(Math.round(pct * totalMs));
  };

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromRulerEvent(e);
    setInteraction({ type: "scrubbing" });
  };

  const handleRulerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (interaction.type !== "scrubbing") return;
    seekFromRulerEvent(e);
  };

  const handleRulerPointerUp = () => setInteraction({ type: "idle" });

  // ── Trim: pointer-captured smooth drag ──────────────────────────────────────
  // Attaching pointer events to the trim handle div with setPointerCapture means
  // the move/up events fire even when cursor is far outside the element.

  const handleTrimPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    clipId: string,
    currentDurationMs: number,
  ) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setInteraction({
      type: "trimming",
      clipId,
      startX: e.clientX,
      startDurationMs: currentDurationMs,
    });
  };

  const handleTrimPointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
    clipId: string,
  ) => {
    if (interaction.type !== "trimming" || interaction.clipId !== clipId) return;
    const containerWidth = trackAreaRef.current?.offsetWidth ?? 1;
    const msPerPx = totalMs / containerWidth;
    const deltaPx = e.clientX - interaction.startX;
    const deltaMs = Math.round(deltaPx * msPerPx);
    const newDuration = Math.max(200, interaction.startDurationMs + deltaMs);
    onChange(setVideoItemDurationById(timeline, clipId, newDuration));
  };

  const handleTrimPointerUp = () => setInteraction({ type: "idle" });

  // ── HTML5 drag: reorder within video track ───────────────────────────────────

  const handleClipDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-contentai-clip-reorder", String(index));
    setReorderFromIndex(index);
  };

  const handleClipDragEnd = () => {
    setReorderFromIndex(null);
    setInsertionIndex(null);
  };

  // Gap drop zone: fires when hovering over a gap (before index i)
  const handleGapDragOver = (e: DragEvent<HTMLDivElement>, gapIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect =
      e.dataTransfer.types.includes("application/x-contentai-clip-reorder") ? "move" : "copy";
    setInsertionIndex(gapIndex);
    setIsMediaDragOver(e.dataTransfer.types.includes("application/x-contentai-video-asset"));
  };

  const handleGapDrop = (e: DragEvent<HTMLDivElement>, gapIndex: number) => {
    e.preventDefault();
    setInsertionIndex(null);
    setIsMediaDragOver(false);

    // Reorder: drag from within the timeline
    const reorderPayload = e.dataTransfer.getData("application/x-contentai-clip-reorder");
    if (reorderPayload) {
      const fromIndex = parseInt(reorderPayload, 10);
      if (!isNaN(fromIndex)) {
        // Convert gap index to target clip index
        const toIndex = gapIndex > fromIndex ? gapIndex - 1 : gapIndex;
        if (toIndex !== fromIndex) {
          onChange(reorderVideoItems(timeline, fromIndex, toIndex));
        }
      }
      setReorderFromIndex(null);
      return;
    }

    // Media drop: drag from media bin
    const mediaPayload = e.dataTransfer.getData("application/x-contentai-video-asset");
    if (mediaPayload) {
      try {
        const parsed = JSON.parse(mediaPayload) as { assetId?: string; durationMs?: number };
        if (!parsed.assetId) return;
        onChange(
          insertVideoItemAt(timeline, {
            assetId: parsed.assetId,
            durationMs: parsed.durationMs ?? 2000,
            insertAtIndex: gapIndex,
          }),
        );
      } catch {
        // ignore malformed payload
      }
    }
  };

  const handleGapDragLeave = () => {
    setInsertionIndex(null);
    setIsMediaDragOver(false);
  };

  const handleTrackDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("application/x-contentai-video-asset")) {
      setIsMediaDragOver(true);
    }
  };

  const handleTrackDragLeave = () => setIsMediaDragOver(false);

  // ── Render ───────────────────────────────────────────────────────────────────

  const hasTextTrack = textItems.length > 0 || captionsEnabled;

  return (
    <div className="h-full flex bg-surface-0 select-none overflow-hidden font-studio">
      {/* ── Track label column ─────────────────────────────────────────── */}
      <div className="w-[52px] shrink-0 flex flex-col border-r border-overlay-sm overflow-hidden">
        {/* Ruler stub — aligns with ruler */}
        <div className="h-6 shrink-0 border-b border-overlay-sm flex items-end pb-0.5 px-1.5">
          <span className="text-sm font-mono tabular-nums text-white/40 leading-none">
            {formatMsFull(currentTimeMs)}
          </span>
        </div>

        {/* Video label */}
        <div
          className="flex-1 flex flex-col items-center justify-center gap-0.5 border-b border-overlay-sm"
          style={{ minHeight: 60 }}
        >
          <span className="text-sm font-black uppercase tracking-[0.15em] text-blue-300/50">
            VIDEO
          </span>
          <span className="text-sm text-white/20 tabular-nums">
            {segments.length}
          </span>
        </div>

        {/* Audio label */}
        {audioItems.length > 0 && (
          <div className="h-7 shrink-0 flex items-center justify-center border-b border-overlay-sm">
            <span className="text-sm font-black uppercase tracking-[0.15em] text-purple-300/40">
              AUDIO
            </span>
          </div>
        )}

        {/* Text/Caption label */}
        {hasTextTrack && (
          <div className="h-6 shrink-0 flex items-center justify-center">
            <span className="text-sm font-black uppercase tracking-[0.15em] text-success/40">
              TEXT
            </span>
          </div>
        )}
      </div>

      {/* ── Track content area ─────────────────────────────────────────── */}
      <div ref={trackAreaRef} className="flex-1 flex flex-col min-w-0 overflow-hidden relative">

        {/* ── Ruler: click or drag to scrub ────────────────────────────── */}
        <div
          ref={rulerRef}
          className={cn(
            "h-6 shrink-0 relative border-b border-overlay-sm cursor-col-resize overflow-hidden",
            interaction.type === "scrubbing" && "bg-overlay-xs",
          )}
          onPointerDown={handleRulerPointerDown}
          onPointerMove={handleRulerPointerMove}
          onPointerUp={handleRulerPointerUp}
        >
          {/* Tick marks */}
          {rulerTicks.ticks.map((ms) => {
            const pct = (ms / totalMs) * 100;
            const isMajor = ms % (rulerTicks.interval * 2) === 0 || ms === 0;
            return (
              <div
                key={ms}
                className="absolute top-0 flex flex-col items-center pointer-events-none"
                style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
              >
                <div
                  className={cn(
                    "w-px",
                    isMajor ? "h-3 bg-white/25" : "h-1.5 bg-white/12",
                  )}
                />
                {isMajor && (
                  <span className="text-sm font-mono tabular-nums text-white/30 mt-0.5 leading-none whitespace-nowrap">
                    {formatMsLabel(ms)}
                  </span>
                )}
              </div>
            );
          })}

          {/* Playhead triangle in ruler */}
          <div
            className="absolute top-0 pointer-events-none z-10"
            style={{ left: `${playheadPct}%`, transform: "translateX(-50%)" }}
          >
            <div
              className="w-0 h-0 mx-auto"
              style={{
                borderLeft: "4px solid transparent",
                borderRight: "4px solid transparent",
                borderTop: "6px solid #f87171",
              }}
            />
          </div>
        </div>

        {/* ── Video track ──────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex-1 relative border-b border-overlay-sm transition-colors overflow-hidden",
            isMediaDragOver && reorderFromIndex === null && "bg-blue-400/[0.06]",
          )}
          style={{ minHeight: 60 }}
          onDragOver={handleTrackDragOver}
          onDragLeave={handleTrackDragLeave}
        >
          {/* Empty state */}
          {segments.length === 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              onDragOver={(e) => handleGapDragOver(e, 0)}
              onDrop={(e) => handleGapDrop(e, 0)}
              onDragLeave={handleGapDragLeave}
            >
              <div
                className={cn(
                  "rounded-lg border-2 border-dashed px-8 py-3 text-center transition-all",
                  insertionIndex === 0
                    ? "border-blue-400/60 bg-blue-400/10 text-blue-300/70"
                    : "border-overlay-md text-white/20",
                )}
              >
                <p className="text-sm font-medium">
                  {t("phase5_editor_timeline")}
                </p>
                <p className="text-sm mt-0.5 opacity-60">
                  Drag clips here
                </p>
              </div>
            </div>
          )}

          {/* Clips + insertion gaps */}
          {segments.length > 0 && (
            <>
              {/* Gap before first clip */}
              <GapZone
                    pct={0}
                active={insertionIndex === 0}
                onDragOver={(e) => handleGapDragOver(e, 0)}
                onDrop={(e) => handleGapDrop(e, 0)}
                onDragLeave={handleGapDragLeave}
              />

              {segments.map((segment) => {
                const isSelected = selectedVideoClipId === segment.id;
                const isActive = activeSegmentId === segment.id;
                const isBeingDragged = reorderFromIndex === segment.index;

                return (
                  <div key={segment.id}>
                    {/* Clip block */}
                    <div
                      className={cn(
                        "absolute top-[6px] bottom-[6px] rounded overflow-hidden cursor-pointer group",
                        "border transition-all duration-75",
                        isBeingDragged && "opacity-40",
                        isSelected
                          ? "border-blue-300/70 ring-1 ring-blue-400/40 ring-offset-0"
                          : isActive
                            ? "border-blue-400/35"
                            : "border-blue-500/20 hover:border-blue-400/40",
                      )}
                      style={{
                        left: `calc(${segment.startPct}% + 2px)`,
                        width: `calc(${segment.widthPct}% - 4px)`,
                        background: isSelected
                          ? "linear-gradient(180deg, rgba(96,165,250,0.60) 0%, rgba(59,130,246,0.40) 100%)"
                          : isActive
                            ? "linear-gradient(180deg, rgba(59,130,246,0.45) 0%, rgba(37,99,235,0.30) 100%)"
                            : "linear-gradient(180deg, rgba(59,130,246,0.32) 0%, rgba(30,64,175,0.22) 100%)",
                      }}
                      draggable
                      onClick={() => {
                        onSelectVideoClip(segment.id);
                        onSeekToMs(segment.startMs);
                      }}
                      onDragStart={(e) => handleClipDragStart(e, segment.index)}
                      onDragEnd={handleClipDragEnd}
                    >
                      {/* Film-strip texture overlay */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(90deg, transparent 0, transparent 5px, rgba(255,255,255,0.03) 5px, rgba(255,255,255,0.03) 6px)",
                        }}
                      />

                      {/* Top shine line */}
                      <div className="absolute top-0 left-0 right-0 h-px bg-white/25 pointer-events-none" />

                      {/* Clip label — top left */}
                      <span
                        className={cn(
                          "absolute top-1 left-1.5 text-sm font-bold leading-none pointer-events-none",
                          isSelected ? "text-white/90" : "text-blue-100/60",
                        )}
                      >
                        {segment.index + 1}
                      </span>

                      {/* Duration — bottom right */}
                      <span
                        className={cn(
                          "absolute bottom-1 right-1.5 text-sm font-mono tabular-nums leading-none pointer-events-none",
                          isSelected ? "text-white/70" : "text-blue-200/40",
                        )}
                      >
                        {(segment.duration / 1000).toFixed(1)}s
                      </span>

                      {/* Transition badge */}
                      {segment.transitionType !== "cut" && (
                        <span className="absolute top-1 right-1.5 text-sm text-blue-200/50 pointer-events-none">
                          {segment.transitionType.slice(0, 3).toUpperCase()}
                        </span>
                      )}

                      {/* Per-clip playhead */}
                      {isActive && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-white/60 pointer-events-none z-10"
                          style={{
                            left: `${((currentTimeMs - segment.startMs) / segment.duration) * 100}%`,
                          }}
                        />
                      )}

                      {/* Right trim handle — pointer capture, appears on hover */}
                      <div
                        className={cn(
                          "absolute right-0 top-0 bottom-0 w-[7px] cursor-ew-resize z-20",
                          "flex flex-col items-center justify-center gap-[3px]",
                          "bg-white/0 hover:bg-white/15 transition-colors",
                          "opacity-0 group-hover:opacity-100",
                          interaction.type === "trimming" &&
                            interaction.clipId === segment.id &&
                            "opacity-100 bg-white/20",
                        )}
                        onPointerDown={(e) =>
                          handleTrimPointerDown(e, segment.id, segment.duration)
                        }
                        onPointerMove={(e) => handleTrimPointerMove(e, segment.id)}
                        onPointerUp={handleTrimPointerUp}
                        onPointerCancel={handleTrimPointerUp}
                      >
                        <span className="w-px h-3 rounded-full bg-white/60" />
                        <span className="w-px h-3 rounded-full bg-white/60" />
                      </div>
                    </div>

                    {/* Gap after clip */}
                    <GapZone
                      pct={segment.startPct + segment.widthPct}
                      active={insertionIndex === segment.index + 1}
                      onDragOver={(e) => handleGapDragOver(e, segment.index + 1)}
                      onDrop={(e) => handleGapDrop(e, segment.index + 1)}
                      onDragLeave={handleGapDragLeave}
                    />
                  </div>
                );
              })}
            </>
          )}

          {/* Global playhead line through video track */}
          <div
            className="absolute top-0 bottom-0 w-px bg-error/70 pointer-events-none z-30"
            style={{ left: `${playheadPct}%` }}
          />
        </div>

        {/* ── Audio track ──────────────────────────────────────────────── */}
        {audioItems.length > 0 && (
          <div className="h-7 shrink-0 relative border-b border-overlay-sm overflow-hidden">
            {audioItems.map((item) => {
              const startPct = (item.startMs / totalMs) * 100;
              const widthPct = ((item.endMs - item.startMs) / totalMs) * 100;
              return (
                <div
                  key={item.id}
                  className="absolute top-[4px] bottom-[4px] rounded-sm overflow-hidden"
                  style={{
                    left: `${startPct}%`,
                    width: `${Math.max(widthPct, 0.5)}%`,
                    background:
                      "linear-gradient(180deg, rgba(168,85,247,0.35) 0%, rgba(126,34,206,0.25) 100%)",
                  }}
                >
                  {/* Simulated waveform bars */}
                  <div
                    className="absolute inset-0 flex items-center justify-around px-0.5"
                    style={{
                      backgroundImage: `
                        repeating-linear-gradient(
                          90deg,
                          rgba(216,180,254,0.15) 0px, rgba(216,180,254,0.15) 1px,
                          transparent 1px, transparent 3px
                        )
                      `,
                    }}
                  />
                  <div className="absolute top-px left-0 right-0 h-px bg-purple-300/30" />
                </div>
              );
            })}

            {/* Playhead through audio track */}
            <div
              className="absolute top-0 bottom-0 w-px bg-error/50 pointer-events-none z-10"
              style={{ left: `${playheadPct}%` }}
            />
          </div>
        )}

        {/* ── Text / Caption track ─────────────────────────────────────── */}
        {hasTextTrack && (
          <div className="h-6 shrink-0 relative overflow-hidden">
            {textItems.map((overlay) => {
              const row = overlay as Record<string, unknown>;
              const startMs = Number(row.startMs ?? 0);
              const endMs = Number(row.endMs ?? totalMs);
              const startPct = (startMs / totalMs) * 100;
              const widthPct = ((endMs - startMs) / totalMs) * 100;
              return (
                <div
                  key={String(row.id ?? "")}
                  className="absolute top-[3px] bottom-[3px] rounded-sm overflow-hidden"
                  style={{
                    left: `${startPct}%`,
                    width: `${Math.max(widthPct, 0.5)}%`,
                    background:
                      "linear-gradient(180deg, rgba(52,211,153,0.35) 0%, rgba(16,185,129,0.22) 100%)",
                  }}
                >
                  <div className="absolute top-px left-0 right-0 h-px bg-success/30" />
                  <span className="absolute inset-x-1 top-0 bottom-0 flex items-center text-sm text-success/60 truncate leading-none">
                    {String(row.content ?? "T")}
                  </span>
                </div>
              );
            })}

            {/* Playhead through text track */}
            <div
              className="absolute top-0 bottom-0 w-px bg-error/40 pointer-events-none z-10"
              style={{ left: `${playheadPct}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gap insertion zone ────────────────────────────────────────────────────────

function GapZone({
  pct,
  active,
  onDragOver,
  onDrop,
  onDragLeave,
}: {
  pct: number;
  active: boolean;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
}) {
  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 z-20 transition-all duration-100",
        active ? "w-[12px] -translate-x-[6px]" : "w-[8px] -translate-x-[4px]",
      )}
      style={{ left: `${pct}%` }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      {/* Insertion indicator line */}
      {active && (
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-blue-400 rounded-full shadow-[0_0_6px_1px_rgba(96,165,250,0.6)]" />
      )}
    </div>
  );
}
