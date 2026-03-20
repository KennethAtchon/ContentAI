import { TRACK_COLORS } from "../types/editor";
import type { Track } from "../types/editor";

interface Props {
  track: Track;
  onToggleMute: () => void;
  onToggleLock: () => void;
}

export function TrackHeader({ track, onToggleMute, onToggleLock }: Props) {
  const color = TRACK_COLORS[track.type];

  return (
    <div className="flex items-center gap-2 px-3 h-14 border-b border-overlay-sm shrink-0">
      <div
        className="w-2 h-7 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 text-sm font-medium text-dim-1 truncate">
        {track.name}
      </span>
      <button
        onClick={onToggleMute}
        title={track.muted ? "Unmute" : "Mute"}
        className={[
          "w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center",
          "border-0 cursor-pointer transition-colors",
          track.muted ? "text-studio-accent" : "text-dim-3 hover:text-dim-1",
          "bg-transparent",
        ].join(" ")}
      >
        M
      </button>
      <button
        onClick={onToggleLock}
        title={track.locked ? "Unlock" : "Lock"}
        className={[
          "w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center",
          "border-0 cursor-pointer transition-colors",
          track.locked ? "text-studio-accent" : "text-dim-3 hover:text-dim-1",
          "bg-transparent",
        ].join(" ")}
      >
        L
      </button>
    </div>
  );
}
