import { Volume2, VolumeX, Lock, Unlock, Trash2 } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { TRACK_COLORS } from "../types/editor";
import type { Track } from "../types/editor";
import { TrackHeaderContextMenu } from "./ClipContextMenu";

interface Props {
  track: Track;
  onToggleMute: () => void;
  onToggleLock: () => void;
  onDeleteAllClips: () => void;
  canRemove?: boolean;
  onRemove?: () => void;
}

export function TrackHeader({ track, onToggleMute, onToggleLock, onDeleteAllClips, canRemove, onRemove }: Props) {
  const color = TRACK_COLORS[track.type];

  return (
    <TrackHeaderContextMenu
      track={track}
      onToggleMute={onToggleMute}
      onToggleLock={onToggleLock}
      onDeleteAllClips={onDeleteAllClips}
    >
      <div className="flex items-center gap-2 px-3 h-14 border-b border-overlay-sm shrink-0 cursor-default">
        <div
          className="w-2 h-7 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="flex-1 text-sm font-medium text-dim-1 truncate">
          {track.name}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
          title={track.muted ? "Unmute" : "Mute"}
          className={cn(
            "w-6 h-6 rounded flex items-center justify-center",
            "border-0 cursor-pointer transition-colors bg-transparent",
            track.muted ? "text-studio-accent" : "text-dim-3 hover:text-dim-1"
          )}
        >
          {track.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
          title={track.locked ? "Unlock" : "Lock"}
          className={cn(
            "w-6 h-6 rounded flex items-center justify-center",
            "border-0 cursor-pointer transition-colors bg-transparent",
            track.locked ? "text-studio-accent" : "text-dim-3 hover:text-dim-1"
          )}
        >
          {track.locked ? <Lock size={12} /> : <Unlock size={12} />}
        </button>
        {canRemove && onRemove && (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Remove track"
            className="w-6 h-6 rounded flex items-center justify-center border-0 cursor-pointer transition-colors bg-transparent text-dim-3 hover:text-red-400"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </TrackHeaderContextMenu>
  );
}
