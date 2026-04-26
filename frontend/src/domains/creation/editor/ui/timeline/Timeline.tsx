import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { Clip } from "../../model/editor-domain";
import { useEditorProjectStore } from "../../store/editor-project-store";
import { useEditorTimelineStore } from "../../store/editor-timeline-store";
import { useEditorUIStore } from "../../store/editor-ui-store";
import { Playhead } from "./Playhead";
import { TimelineClip } from "./TimelineClip";
import { TimelineRuler } from "./TimelineRuler";
import { TrackHeader } from "./TrackHeader";

const TRACK_HEIGHT = 56;
const RULER_HEIGHT = 32;
const TIMELINE_MIN_CONTENT_WIDTH_PX = 4000;

interface Props {
  scrollRef?: RefObject<HTMLDivElement | null>;
}

export function Timeline({ scrollRef }: Props) {
  const { t } = useTranslation();
  const tracks = useEditorProjectStore((state) => state.tracks);
  const durationMs = useEditorProjectStore((state) => state.durationMs);
  const clipboardClip = useEditorProjectStore((state) => state.clipboardClip);
  const toggleTrackMute = useEditorProjectStore((state) => state.toggleTrackMute);
  const toggleTrackLock = useEditorProjectStore((state) => state.toggleTrackLock);
  const renameTrack = useEditorProjectStore((state) => state.renameTrack);
  const removeClip = useEditorProjectStore((state) => state.removeClip);
  const moveClip = useEditorProjectStore((state) => state.moveClip);
  const toggleClipEnabled = useEditorProjectStore((state) => state.toggleClipEnabled);
  const copyClip = useEditorProjectStore((state) => state.copyClip);
  const updateClip = useEditorProjectStore((state) => state.updateClip);
  const zoom = useEditorTimelineStore((state) => state.zoom);
  const currentTimeMs = useEditorTimelineStore((state) => state.currentTimeMs);
  const seekTo = useEditorTimelineStore((state) => state.seekTo);
  const selectedClipId = useEditorUIStore((state) => state.selectedClipId);
  const selectClip = useEditorUIStore((state) => state.selectClip);
  const totalWidthPx = Math.max(
    (durationMs / 1000) * zoom + 1200,
    TIMELINE_MIN_CONTENT_WIDTH_PX
  );
  const tracksContentHeight = tracks.length * TRACK_HEIGHT;

  return (
    <div className="flex flex-col h-full border-t border-overlay-sm bg-studio-surface overflow-hidden">
      <div className="flex flex-row shrink-0" style={{ height: RULER_HEIGHT }}>
        <div
          className="shrink-0 border-r border-b border-overlay-sm flex items-center px-3"
          style={{ width: 186 }}
        >
          <span className="text-[10px] uppercase tracking-widest text-dim-3 font-semibold">
            {t("editor_tracks_label")}
          </span>
        </div>
        <div className="flex-1 overflow-hidden border-b border-overlay-sm">
          <div style={{ width: totalWidthPx }}>
            <TimelineRuler
              totalWidthPx={totalWidthPx}
              zoom={zoom}
              onSeek={seekTo}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-row flex-1 min-h-0 overflow-hidden">
        <div
          className="shrink-0 flex flex-col border-r border-overlay-sm bg-studio-surface z-10 overflow-hidden"
          style={{ width: 186 }}
        >
          {tracks.map((track) => (
            <TrackHeader
              key={track.id}
              track={track}
              onToggleMute={() => toggleTrackMute(track.id)}
              onToggleLock={() => toggleTrackLock(track.id)}
              onDeleteAllClips={() => {
                track.clips.forEach((clip) => {
                  if (selectedClipId === clip.id) {
                    selectClip(null);
                  }
                  removeClip(clip.id);
                });
              }}
              onRename={(name) => renameTrack(track.id, name)}
            />
          ))}
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-auto relative"
          onClick={() => selectClip(null)}
        >
          <div
            style={{
              width: totalWidthPx,
              height: tracksContentHeight,
              position: "relative",
            }}
          >
            {tracks.map((track, trackIndex) => (
              <div
                key={track.id}
                className="absolute border-b border-dashed border-overlay-sm"
                style={{
                  top: trackIndex * TRACK_HEIGHT,
                  left: 0,
                  width: totalWidthPx,
                  height: TRACK_HEIGHT,
                }}
              >
                {track.clips.map((clip: Clip) => (
                  <TimelineClip
                    key={clip.id}
                    clip={clip}
                    track={track}
                    trackType={track.type}
                    zoom={zoom}
                    isSelected={clip.id === selectedClipId}
                    isLocked={track.locked}
                    tracks={tracks}
                    hasClipboard={clipboardClip !== null}
                    onSelect={() => selectClip(clip.id)}
                    onMove={(startMs) => moveClip(clip.id, startMs)}
                    onTrimStart={() => undefined}
                    onTrimEnd={() => undefined}
                    onSplit={() => undefined}
                    onDuplicate={() => undefined}
                    onCopy={() => copyClip(clip.id)}
                    onPaste={() => undefined}
                    onToggleEnabled={() => toggleClipEnabled(clip.id)}
                    onRippleDelete={() => {
                      if (selectedClipId === clip.id) {
                        selectClip(null);
                      }
                      removeClip(clip.id);
                    }}
                    onDelete={() => {
                      if (selectedClipId === clip.id) {
                        selectClip(null);
                      }
                      removeClip(clip.id);
                    }}
                    onSetSpeed={(speed) => updateClip(clip.id, { speed })}
                  />
                ))}
              </div>
            ))}

            <Playhead
              zoom={zoom}
              height={tracksContentHeight}
              currentTimeMs={currentTimeMs}
              onSeek={seekTo}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
