import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineClip } from "./TimelineClip";
import { TrackHeader } from "./TrackHeader";
import { Playhead } from "./Playhead";
import type { Track, Clip, TrackType } from "../types/editor";
import { TransitionDiamond } from "./TransitionDiamond";
import { TrackAreaContextMenu } from "./ClipContextMenu";

const TRACK_HEIGHT = 56; // px per track
const RULER_HEIGHT = 32; // px

const ASSET_TYPE_TO_TRACK: Record<string, TrackType> = {
  video_clip: "video",
  assembled_video: "video",
  image: "video",
  voiceover: "audio",
  music: "music",
};

// Thin sortable wrapper — keeps dnd-kit logic out of TrackHeader itself
function SortableTrackHeader(props: React.ComponentProps<typeof TrackHeader>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.track.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <TrackHeader {...props} isDragging={isDragging} gripProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

interface Props {
  tracks: Track[];
  durationMs: number;
  currentTimeMs: number;
  zoom: number;
  selectedClipId: string | null;
  hasClipboard: boolean;
  onSeek: (ms: number) => void;
  onSelectClip: (clipId: string | null) => void;
  onUpdateClip: (clipId: string, patch: Partial<Clip>) => void;
  onAddClip: (trackId: string, clip: Clip) => void;
  onToggleMute: (trackId: string) => void;
  onToggleLock: (trackId: string) => void;
  onDeleteAllClipsInTrack: (trackId: string) => void;
  selectedTransitionId: string | null;
  onSelectTransition: (trackId: string, clipAId: string, clipBId: string) => void;
  onRemoveTransition: (trackId: string, transitionId: string) => void;
  onClipSplit: (clipId: string) => void;
  onClipDuplicate: (clipId: string) => void;
  onClipCopy: (clipId: string) => void;
  onClipPaste: (trackId: string, startMs: number) => void;
  onClipToggleEnabled: (clipId: string) => void;
  onClipRippleDelete: (clipId: string) => void;
  onClipDelete: (clipId: string) => void;
  onClipSetSpeed: (clipId: string, speed: number) => void;
  onAddVideoTrack: (trackId: string) => void;
  onRemoveTrack: (trackId: string) => void;
  onRenameTrack: (trackId: string, name: string) => void;
  onReorderTracks: (trackIds: string[]) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onFocusMediaForTrack: (trackType: TrackType, trackId: string, startMs: number) => void;
}

export function Timeline({
  tracks,
  durationMs,
  currentTimeMs,
  zoom,
  selectedClipId,
  hasClipboard,
  onSeek,
  onSelectClip,
  onUpdateClip,
  onAddClip,
  onToggleMute,
  onToggleLock,
  onDeleteAllClipsInTrack,
  selectedTransitionId: _selectedTransitionId,
  onSelectTransition,
  onRemoveTransition,
  onClipSplit,
  onClipDuplicate,
  onClipCopy,
  onClipPaste,
  onClipToggleEnabled,
  onClipRippleDelete,
  onClipDelete,
  onClipSetSpeed,
  onAddVideoTrack,
  onRemoveTrack,
  onRenameTrack,
  onReorderTracks,
  scrollRef,
  onFocusMediaForTrack,
}: Props) {
  const { t } = useTranslation();
  const [dropTargetTrackId, setDropTargetTrackId] = useState<string | null>(null);
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const headersRef = useRef<HTMLDivElement>(null);

  const videoTracks = tracks.filter((t) => t.type === "video");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleTrackDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = tracks.map((t) => t.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    onReorderTracks(arrayMove(ids, oldIndex, newIndex));
  };
  const totalWidthPx = Math.max((durationMs / 1000) * zoom + 4000, 4000);
  const tracksContentHeight = tracks.length * TRACK_HEIGHT;

  // Auto-scroll to follow playhead during playback (horizontal only)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const playheadPx = (currentTimeMs / 1000) * zoom;
    const { scrollLeft, clientWidth } = el;
    const margin = 80;
    if (playheadPx > scrollLeft + clientWidth - margin) {
      el.scrollLeft = playheadPx - margin;
    } else if (playheadPx < scrollLeft + margin) {
      el.scrollLeft = Math.max(0, playheadPx - margin);
    }
  }, [currentTimeMs, zoom, scrollRef]);

  const handleDragOver = (e: React.DragEvent, track: Track) => {
    if (!e.dataTransfer.types.includes("application/x-contentai-asset")) return;
    if (track.locked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropTargetTrackId(track.id);
  };

  const handleDragLeave = () => setDropTargetTrackId(null);

  const handleDrop = (e: React.DragEvent, track: Track) => {
    setDropTargetTrackId(null);
    if (!e.dataTransfer.types.includes("application/x-contentai-asset")) return;
    if (track.locked) return;
    e.preventDefault();

    const raw = e.dataTransfer.getData("application/x-contentai-asset");
    if (!raw) return;

    let asset: { assetId: string; type: string; durationMs: number | null; label: string };
    try {
      asset = JSON.parse(raw);
    } catch {
      return;
    }

    const expectedTrack = ASSET_TYPE_TO_TRACK[asset.type];
    if (expectedTrack && expectedTrack !== track.type) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
    const startMs = Math.max(0, ((e.clientX - rect.left + scrollLeft) / zoom) * 1000);

    const clip: Clip = {
      id: crypto.randomUUID(),
      assetId: asset.assetId,
      label: asset.label,
      startMs,
      durationMs: asset.durationMs ?? 5000,
      sourceMaxDurationMs: asset.durationMs ?? undefined,
      trimStartMs: 0,
      trimEndMs: 0,
      speed: 1,
      opacity: 1,
      warmth: 0,
      contrast: 0,
      positionX: 0,
      positionY: 0,
      scale: 1,
      rotation: 0,
      volume: track.type === "music" ? 0.3 : 1,
      muted: false,
    };

    onAddClip(track.id, clip);
  };

  // Capture right-click position for paste/add
  const pastePositionRef = useRef<number>(0);

  return (
    <div
      className="flex flex-col h-full border-t border-overlay-sm bg-studio-surface overflow-hidden"
      onClick={() => onSelectClip(null)}
    >
      {/* ── Fixed ruler row (no vertical scroll) ─────────────────────────── */}
      <div className="flex flex-row shrink-0" style={{ height: RULER_HEIGHT }}>
        {/* Corner cell — aligns with the header column */}
        <div
          className="shrink-0 border-r border-b border-overlay-sm flex items-center px-3"
          style={{ width: 186 }}
        >
          <span className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold">
            {t("editor_tracks_label")}
          </span>
        </div>
        {/* Ruler — syncs horizontally with content scroll */}
        <div
          ref={rulerScrollRef}
          className="flex-1 overflow-x-hidden overflow-y-hidden border-b border-overlay-sm"
        >
          <div style={{ width: totalWidthPx }}>
            <TimelineRuler
              totalWidthPx={totalWidthPx}
              zoom={zoom}
              onSeek={onSeek}
            />
          </div>
        </div>
      </div>

      {/* ── Track rows: headers sync vertically via JS; content handles both axes ── */}
      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">

        {/* Track headers — dnd-kit sortable list */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleTrackDragEnd}
        >
          <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div
              ref={headersRef}
              className="shrink-0 flex flex-col border-r border-overlay-sm bg-studio-surface z-10 overflow-hidden"
              style={{ width: 186 }}
              onWheel={(e) => {
                if (scrollRef.current) scrollRef.current.scrollTop += e.deltaY;
              }}
            >
              {tracks.map((track) => (
                <SortableTrackHeader
                  key={track.id}
                  track={track}
                  onToggleMute={() => onToggleMute(track.id)}
                  onToggleLock={() => onToggleLock(track.id)}
                  onDeleteAllClips={() => onDeleteAllClipsInTrack(track.id)}
                  onRename={(name) => onRenameTrack(track.id, name)}
                  canRemove={track.type === "video" && videoTracks.length > 1}
                  onRemove={() => onRemoveTrack(track.id)}
                  onAddVideoTrack={track.type === "video" ? () => onAddVideoTrack(track.id) : undefined}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Track content — handles both horizontal and vertical scroll */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto relative"
          onScroll={(e) => {
            if (rulerScrollRef.current) {
              rulerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
            if (headersRef.current) {
              headersRef.current.scrollTop = e.currentTarget.scrollTop;
            }
          }}
        >
          <div
            style={{ width: totalWidthPx, height: tracksContentHeight, position: "relative" }}
          >
            {tracks.map((track, trackIndex) => {
              const handleAddClipAtPosition = () => {
                if (track.locked) return;

                if (track.type === "text") {
                  const clip: Clip = {
                    id: crypto.randomUUID(),
                    assetId: null,
                    label: t("editor_clip_default_label"),
                    startMs: pastePositionRef.current,
                    durationMs: 3000,
                    trimStartMs: 0,
                    trimEndMs: 0,
                    speed: 1,
                    enabled: true,
                    opacity: 1,
                    warmth: 0,
                    contrast: 0,
                    positionX: 0,
                    positionY: 0,
                    scale: 1,
                    rotation: 0,
                    volume: 1,
                    muted: false,
                    textContent: "",
                  };
                  onAddClip(track.id, clip);
                  onSelectClip(clip.id);
                  return;
                }

                onFocusMediaForTrack(track.type, track.id, pastePositionRef.current);
              };

              return (
                <TrackAreaContextMenu
                  key={track.id}
                  trackType={track.type}
                  hasClipboard={hasClipboard}
                  onAddClip={handleAddClipAtPosition}
                  onPaste={() => onClipPaste(track.id, pastePositionRef.current)}
                >
                  <div
                    className="absolute border-b border-dashed border-overlay-sm transition-colors"
                    style={{
                      top: trackIndex * TRACK_HEIGHT,
                      left: 0,
                      width: totalWidthPx,
                      height: TRACK_HEIGHT,
                      backgroundColor:
                        dropTargetTrackId === track.id
                          ? "rgba(139,92,246,0.08)"
                          : undefined,
                    }}
                    onDragOver={(e) => handleDragOver(e, track)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, track)}
                    onContextMenu={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
                      pastePositionRef.current = Math.max(
                        0,
                        ((e.clientX - rect.left + scrollLeft) / zoom) * 1000
                      );
                    }}
                  >
                    {track.clips.map((clip) => (
                      <TimelineClip
                        key={clip.id}
                        clip={clip}
                        track={track}
                        trackType={track.type}
                        zoom={zoom}
                        isSelected={selectedClipId === clip.id}
                        isLocked={track.locked}
                        tracks={tracks}
                        playheadMs={currentTimeMs}
                        hasClipboard={hasClipboard}
                        onSelect={() => onSelectClip(clip.id)}
                        onMove={(newStartMs) =>
                          onUpdateClip(clip.id, { startMs: newStartMs })
                        }
                        onTrimStart={(newTrimStartMs, newDurationMs) =>
                          onUpdateClip(clip.id, {
                            trimStartMs: newTrimStartMs,
                            startMs: clip.startMs + (newTrimStartMs - clip.trimStartMs),
                            durationMs: newDurationMs,
                          })
                        }
                        onTrimEnd={(newDurationMs) =>
                          onUpdateClip(clip.id, {
                            durationMs: newDurationMs,
                            // Maintain invariant: trimStartMs + durationMs + trimEndMs = sourceDuration.
                            // Shrinking adds to the cut buffer; expanding consumes from it.
                            trimEndMs: Math.max(
                              0,
                              (clip.trimEndMs ?? 0) + clip.durationMs - newDurationMs
                            ),
                          })
                        }
                        onSplit={() => onClipSplit(clip.id)}
                        onDuplicate={() => onClipDuplicate(clip.id)}
                        onCopy={() => onClipCopy(clip.id)}
                        onPaste={() => onClipPaste(track.id, clip.startMs + clip.durationMs)}
                        onToggleEnabled={() => onClipToggleEnabled(clip.id)}
                        onRippleDelete={() => onClipRippleDelete(clip.id)}
                        onDelete={() => onClipDelete(clip.id)}
                        onSetSpeed={(speed) => onClipSetSpeed(clip.id, speed)}
                      />
                    ))}

                    {track.type === "video" &&
                      track.clips.slice(0, -1).map((clipA, idx) => {
                        const clipB = track.clips[idx + 1];
                        const gapMs = clipB.startMs - (clipA.startMs + clipA.durationMs);
                        if (gapMs > 500) return null;
                        const transition = (track.transitions ?? []).find(
                          (t) => t.clipAId === clipA.id && t.clipBId === clipB.id
                        );
                        return (
                          <TransitionDiamond
                            key={`td-${clipA.id}-${clipB.id}`}
                            clipA={clipA}
                            clipB={clipB}
                            transition={transition}
                            zoom={zoom}
                            onSelect={() => onSelectTransition(track.id, clipA.id, clipB.id)}
                            onRemoveTransition={() => {
                              if (transition) onRemoveTransition(track.id, transition.id);
                            }}
                          />
                        );
                      })}
                  </div>
                </TrackAreaContextMenu>
              );
            })}

            <Playhead
              currentTimeMs={currentTimeMs}
              zoom={zoom}
              height={tracksContentHeight}
              onSeek={onSeek}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
