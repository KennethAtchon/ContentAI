import { useRef, useState, type RefObject } from "react";
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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { TimelineRuler } from "./TimelineRuler";
import { TimelineClip } from "./TimelineClip";
import { Playhead } from "./Playhead";
import { SortableTrackHeader } from "./SortableTrackHeader";
import type {
  TextClip,
  TimelineClip as EditorTimelineClip,
  TrackType,
} from "../types/editor";
import { TransitionDiamond } from "./TransitionDiamond";
import { TrackAreaContextMenu } from "./ClipContextMenu";
import { useEditorContext } from "../context/EditorContext";
import {
  TRACK_HEIGHT,
  RULER_HEIGHT,
  TIMELINE_SCROLL_PADDING_PX,
  TIMELINE_MIN_CONTENT_WIDTH_PX,
} from "../constants/timeline-layout";
import { useTimelinePlayheadScroll } from "../hooks/use-timeline-playhead-scroll";
import { useTimelineAssetDrop } from "../hooks/use-timeline-asset-drop";
import { isMediaClip, isVideoClip } from "../utils/clip-types";

interface Props {
  onAddClip: (trackId: string, clip: EditorTimelineClip) => void;
  onDeleteAllClipsInTrack: (trackId: string) => void;
  onSelectTransition: (trackId: string, clipAId: string, clipBId: string) => void;
  onClipSplit: (clipId: string) => void;
  onClipDuplicate: (clipId: string) => void;
  onClipCopy: (clipId: string) => void;
  onClipPaste: (trackId: string, startMs: number) => void;
  onClipToggleEnabled: (clipId: string) => void;
  onClipRippleDelete: (clipId: string) => void;
  onClipDelete: (clipId: string) => void;
  onClipSetSpeed: (clipId: string, speed: number) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  onFocusMediaForTrack: (trackType: TrackType, trackId: string, startMs: number) => void;
}

export function Timeline({
  onAddClip,
  onDeleteAllClipsInTrack,
  onSelectTransition,
  onClipSplit,
  onClipDuplicate,
  onClipCopy,
  onClipPaste,
  onClipToggleEnabled,
  onClipRippleDelete,
  onClipDelete,
  onClipSetSpeed,
  scrollRef,
  onFocusMediaForTrack,
}: Props) {
  const {
    state,
    setCurrentTime: onSeek,
    selectClip: onSelectClip,
    updateClip: onUpdateClip,
    toggleTrackMute: onToggleMute,
    toggleTrackLock: onToggleLock,
    removeTransition: onRemoveTransition,
    addVideoTrack: onAddVideoTrack,
    removeTrack: onRemoveTrack,
    renameTrack: onRenameTrack,
    reorderTracks: onReorderTracks,
  } = useEditorContext();

  const tracks = state.tracks;
  const durationMs = state.durationMs;
  const currentTimeMs = state.currentTimeMs;
  const zoom = state.zoom;
  const selectedClipId = state.selectedClipId;
  const hasClipboard = !!state.clipboardClip;
  const { t } = useTranslation();
  const [activeSnapMs, setActiveSnapMs] = useState<number | null>(null);
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const headersRef = useRef<HTMLDivElement>(null);

  const {
    dropTargetTrackId,
    rejectTargetTrackId,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useTimelineAssetDrop({ scrollRef, zoom, onAddClip });

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
  const totalWidthPx = Math.max(
    (durationMs / 1000) * zoom + TIMELINE_SCROLL_PADDING_PX,
    TIMELINE_MIN_CONTENT_WIDTH_PX
  );
  const tracksContentHeight = tracks.length * TRACK_HEIGHT;

  useTimelinePlayheadScroll(scrollRef, currentTimeMs, zoom);

  const pastePositionRef = useRef<number>(0);

  return (
    <div
      className="flex flex-col h-full border-t border-overlay-sm bg-studio-surface overflow-hidden"
      onClick={() => onSelectClip(null)}
    >
      <div className="flex flex-row shrink-0" style={{ height: RULER_HEIGHT }}>
        <div
          className="shrink-0 border-r border-b border-overlay-sm flex items-center px-3"
          style={{ width: 186 }}
        >
          <span className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold">
            {t("editor_tracks_label")}
          </span>
        </div>
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

      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
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
                  const clip: TextClip = {
                    id: crypto.randomUUID(),
                    type: "text",
                    label: t("editor_clip_default_label"),
                    startMs: pastePositionRef.current,
                    durationMs: 3000,
                    speed: 1,
                    enabled: true,
                    opacity: 1,
                    warmth: 0,
                    contrast: 0,
                    positionX: 0,
                    positionY: 0,
                    scale: 1,
                    rotation: 0,
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
                          : rejectTargetTrackId === track.id
                            ? "rgba(239,68,68,0.08)"
                            : undefined,
                      boxShadow:
                        rejectTargetTrackId === track.id
                          ? "inset 0 0 0 1px rgba(239,68,68,0.3)"
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
                        onSnapChange={setActiveSnapMs}
                        onMove={(newStartMs) =>
                          onUpdateClip(clip.id, { startMs: newStartMs })
                        }
                        onTrimStart={(newTrimStartMs, newDurationMs) =>
                          isMediaClip(clip)
                            ? onUpdateClip(clip.id, {
                                trimStartMs: newTrimStartMs,
                                startMs:
                                  clip.startMs + (newTrimStartMs - clip.trimStartMs),
                                durationMs: newDurationMs,
                              })
                            : undefined
                        }
                        onTrimEnd={(newDurationMs) =>
                          isMediaClip(clip)
                            ? onUpdateClip(clip.id, {
                                durationMs: newDurationMs,
                                trimEndMs: Math.max(
                                  0,
                                  (clip.trimEndMs ?? 0) + clip.durationMs - newDurationMs
                                ),
                              })
                            : undefined
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
                      track.clips.filter(isVideoClip).slice(0, -1).map((clipA, idx, mediaClips) => {
                        const clipB = mediaClips[idx + 1];
                        const gapMs = clipB.startMs - (clipA.startMs + clipA.durationMs);
                        if (gapMs > 500) return null;
                        const transition = (track.transitions ?? []).find(
                          (tr) => tr.clipAId === clipA.id && tr.clipBId === clipB.id
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

            {activeSnapMs !== null && (
              <div
                className="absolute top-0 bottom-0 w-px bg-studio-accent/80 pointer-events-none z-20"
                style={{ left: (activeSnapMs / 1000) * zoom }}
              />
            )}

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
