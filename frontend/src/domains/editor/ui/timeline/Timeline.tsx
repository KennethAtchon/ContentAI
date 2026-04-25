import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { Clip, Track } from "../../model/editor";
import { Playhead } from "./Playhead";
import { TimelineClip } from "./TimelineClip";
import { TimelineRuler } from "./TimelineRuler";
import { TrackHeader } from "./TrackHeader";

const TRACK_HEIGHT = 56;
const RULER_HEIGHT = 32;
const TIMELINE_MIN_CONTENT_WIDTH_PX = 4000;

const previewTracks: Track[] = [
  {
    id: "video",
    type: "video",
    name: "Video 1",
    muted: false,
    locked: false,
    transitions: [],
    clips: [
      {
        id: "clip-video",
        type: "video",
        label: "Opening shot",
        startMs: 0,
        durationMs: 5200,
        locallyModified: false,
        enabled: true,
        speed: 1,
        opacity: 1,
        warmth: 0,
        contrast: 0,
        positionX: 0,
        positionY: 0,
        scale: 1,
        rotation: 0,
        assetId: null,
        trimStartMs: 0,
        trimEndMs: 0,
        volume: 1,
        muted: false,
      },
    ],
  },
  {
    id: "audio",
    type: "audio",
    name: "Voiceover",
    muted: false,
    locked: false,
    transitions: [],
    clips: [
      {
        id: "clip-audio",
        type: "audio",
        label: "Narration",
        startMs: 600,
        durationMs: 4200,
        locallyModified: false,
        enabled: true,
        speed: 1,
        opacity: 1,
        warmth: 0,
        contrast: 0,
        positionX: 0,
        positionY: 0,
        scale: 1,
        rotation: 0,
        assetId: null,
        trimStartMs: 0,
        trimEndMs: 0,
        volume: 1,
        muted: false,
      },
    ],
  },
  {
    id: "music",
    type: "music",
    name: "Music",
    muted: false,
    locked: false,
    transitions: [],
    clips: [],
  },
];

interface Props {
  tracks?: Track[];
  durationMs?: number;
  zoom?: number;
  scrollRef?: RefObject<HTMLDivElement | null>;
}

export function Timeline({
  tracks = previewTracks,
  durationMs = 12_000,
  zoom = 80,
  scrollRef,
}: Props) {
  const { t } = useTranslation();
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
              onSeek={() => undefined}
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
              onToggleMute={() => undefined}
              onToggleLock={() => undefined}
              onDeleteAllClips={() => undefined}
              onRename={() => undefined}
            />
          ))}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto relative">
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
                    isSelected={false}
                    isLocked={track.locked}
                    tracks={tracks}
                    hasClipboard={false}
                    onSelect={() => undefined}
                    onMove={() => undefined}
                    onTrimStart={() => undefined}
                    onTrimEnd={() => undefined}
                    onSplit={() => undefined}
                    onDuplicate={() => undefined}
                    onCopy={() => undefined}
                    onPaste={() => undefined}
                    onToggleEnabled={() => undefined}
                    onRippleDelete={() => undefined}
                    onDelete={() => undefined}
                    onSetSpeed={() => undefined}
                  />
                ))}
              </div>
            ))}

            <Playhead zoom={zoom} height={tracksContentHeight} />
          </div>
        </div>
      </div>
    </div>
  );
}
