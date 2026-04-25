import {
  FastForward,
  Pause,
  Play,
  Rewind,
  Scissors,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatHHMMSSFF } from "../../lib/timecode";

interface PlaybackBarProps {
  durationMs?: number;
  fps?: number;
}

export function PlaybackBar({ durationMs = 0, fps = 30 }: PlaybackBarProps) {
  const { t } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);

  return (
    <div
      className="flex items-center gap-2 px-4 bg-studio-surface border-t border-overlay-sm shrink-0"
      style={{ height: 56 }}
    >
      <div className="flex items-center gap-0.5">
        <button
          title={t("editor_transport_jump_start")}
          className="transport-btn"
        >
          <SkipBack size={14} />
        </button>
        <button title={t("editor_transport_rewind")} className="transport-btn">
          <Rewind size={14} />
        </button>
        <button
          onClick={() => setIsPlaying((value) => !value)}
          title={
            isPlaying ? t("editor_transport_pause") : t("editor_transport_play")
          }
          className="w-9 h-9 rounded-full flex items-center justify-center bg-studio-accent text-white cursor-pointer border-0 hover:opacity-90 transition-opacity shrink-0"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button title={t("editor_transport_forward")} className="transport-btn">
          <FastForward size={14} />
        </button>
        <button
          title={t("editor_transport_jump_end")}
          className="transport-btn"
        >
          <SkipForward size={14} />
        </button>
      </div>

      <div className="w-px h-5 bg-overlay-md mx-1 shrink-0" />

      <span className="font-mono text-xs text-dim-2 tabular-nums rounded px-2 py-1">
        {formatHHMMSSFF(0, fps)} <span className="text-dim-3">/</span>{" "}
        {formatHHMMSSFF(durationMs, fps)}
      </span>

      <div className="flex-1" />

      <button
        disabled
        title="Split clip at playhead"
        className="flex items-center gap-1.5 text-xs text-dim-2 bg-overlay-sm border border-overlay-sm px-2.5 py-1 rounded opacity-30"
      >
        <Scissors size={12} />
        Split
      </button>

      <div className="w-px h-5 bg-overlay-md mx-1 shrink-0" />

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
