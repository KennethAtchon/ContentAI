import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SkipBack,
  Rewind,
  Play,
  Pause,
  FastForward,
  SkipForward,
  Volume2,
  Scissors,
} from "lucide-react";
import { useEditorContext } from "../../context/EditorContext";
import { formatHHMMSSFF, parseTimecode } from "../../utils/timecode";

interface PlaybackBarProps {
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  fps: number;
  onJumpToStart: () => void;
  onRewind: () => void;
  onTogglePlaying: () => void;
  onFastForward: () => void;
  onJumpToEnd: () => void;
  onSetCurrentTime: (ms: number) => void;
}

export function PlaybackBar({
  isPlaying,
  currentTimeMs,
  durationMs,
  fps,
  onJumpToStart,
  onRewind,
  onTogglePlaying,
  onFastForward,
  onJumpToEnd,
  onSetCurrentTime,
}: PlaybackBarProps) {
  const { t } = useTranslation();
  const { state, splitClip } = useEditorContext();
  const [volume, setVolume] = useState(1);
  const [timecodeEditing, setTimecodeEditing] = useState(false);
  const [timecodeInput, setTimecodeInput] = useState("");

  const timecode = formatHHMMSSFF(currentTimeMs, fps);
  const duration = formatHHMMSSFF(durationMs, fps);

  const handleSplit = () => {
    if (state.selectedClipId) {
      splitClip(state.selectedClipId, currentTimeMs);
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-4 bg-studio-surface border-t border-overlay-sm shrink-0"
      style={{ height: 56 }}
    >
      {/* Transport buttons */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onJumpToStart}
          title={t("editor_transport_jump_start")}
          className="transport-btn"
        >
          <SkipBack size={14} />
        </button>
        <button
          onClick={onRewind}
          title={t("editor_transport_rewind")}
          className="transport-btn"
        >
          <Rewind size={14} />
        </button>
        <button
          onClick={onTogglePlaying}
          title={isPlaying ? t("editor_transport_pause") : t("editor_transport_play")}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-studio-accent text-white cursor-pointer border-0 hover:opacity-90 transition-opacity shrink-0"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={onFastForward}
          title={t("editor_transport_forward")}
          className="transport-btn"
        >
          <FastForward size={14} />
        </button>
        <button
          onClick={onJumpToEnd}
          title={t("editor_transport_jump_end")}
          className="transport-btn"
        >
          <SkipForward size={14} />
        </button>
      </div>

      <div className="w-px h-5 bg-overlay-md mx-1 shrink-0" />

      {/* Timecode pill */}
      {timecodeEditing ? (
        <input
          autoFocus
          type="text"
          value={timecodeInput}
          onChange={(e) => setTimecodeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const ms = parseTimecode(timecodeInput, fps);
              if (ms !== null)
                onSetCurrentTime(Math.max(0, Math.min(durationMs, ms)));
              setTimecodeEditing(false);
            }
            if (e.key === "Escape") setTimecodeEditing(false);
          }}
          onBlur={() => setTimecodeEditing(false)}
          className="font-mono text-xs text-dim-1 w-36 text-center tabular-nums bg-overlay-sm border border-studio-accent rounded px-2 outline-none"
        />
      ) : (
        <button
          onClick={() => {
            setTimecodeInput(timecode);
            setTimecodeEditing(true);
          }}
          title={t("editor_transport_timecode_hint")}
          className="font-mono text-xs text-dim-2 tabular-nums bg-transparent border-0 cursor-text hover:bg-overlay-sm rounded px-2 py-1 transition-colors select-none"
        >
          {timecode}{" "}
          <span className="text-dim-3">/</span>{" "}
          {duration}
        </button>
      )}

      <div className="flex-1" />

      {/* Split at playhead */}
      <button
        onClick={handleSplit}
        disabled={!state.selectedClipId}
        title="Split clip at playhead"
        className="flex items-center gap-1.5 text-xs text-dim-2 hover:text-dim-1 bg-overlay-sm border border-overlay-sm px-2.5 py-1 rounded cursor-pointer hover:bg-overlay-md transition-colors disabled:opacity-30 disabled:cursor-default"
      >
        <Scissors size={12} />
        Split
      </button>

      <div className="w-px h-5 bg-overlay-md mx-1 shrink-0" />

      {/* Volume */}
      <div className="flex items-center gap-1.5">
        <Volume2 size={14} className="text-dim-3 shrink-0" />
        <input
          type="range"
          min={0}
          max={2}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-20 h-1 accent-studio-accent"
          title="Master volume"
        />
      </div>
    </div>
  );
}
