import { useState, useRef, useEffect } from "react";
import {
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Trash2,
  Plus,
  MoreHorizontal,
  GripVertical,
  Pencil,
} from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { TRACK_COLORS } from "../types/editor";
import type { Track } from "../types/editor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

interface Props {
  track: Track;
  onToggleMute: () => void;
  onToggleLock: () => void;
  onDeleteAllClips: () => void;
  onRename: (name: string) => void;
  canRemove?: boolean;
  onRemove?: () => void;
  onAddVideoTrack?: () => void;
  isDragging?: boolean;
  gripProps?: React.HTMLAttributes<HTMLElement>;
}

export function TrackHeader({
  track,
  onToggleMute,
  onToggleLock,
  onDeleteAllClips,
  onRename,
  canRemove,
  onRemove,
  onAddVideoTrack,
  isDragging,
  gripProps,
}: Props) {
  const color = TRACK_COLORS[track.type];
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(track.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(track.name);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isRenaming, track.name]);

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== track.name) onRename(trimmed);
    setIsRenaming(false);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 h-14 border-b border-overlay-sm shrink-0 cursor-default select-none transition-opacity",
        isDragging && "opacity-40"
      )}
    >
      {/* Drag handle — listeners only on the grip so buttons still click normally */}
      <span
        {...gripProps}
        className="text-dim-3 shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical size={12} />
      </span>

      {/* Color dot */}
      <div
        className="w-2 h-6 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* Track name / rename input */}
      {isRenaming ? (
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setIsRenaming(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 text-sm font-medium bg-studio-surface border border-studio-accent rounded px-1 py-0.5 text-dim-1 outline-none"
        />
      ) : (
        <span
          className="flex-1 min-w-0 text-sm font-medium text-dim-1 truncate"
          onDoubleClick={() => setIsRenaming(true)}
          title={track.name}
        >
          {track.name}
        </span>
      )}

      {/* Mute — kept visible since it has active visual state */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        title={track.muted ? "Unmute" : "Mute"}
        className={cn(
          "w-6 h-6 rounded flex items-center justify-center shrink-0",
          "border-0 cursor-pointer transition-colors bg-transparent",
          track.muted ? "text-studio-accent" : "text-dim-3 hover:text-dim-1"
        )}
      >
        {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
      </button>

      {/* 3-dots menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="w-6 h-6 rounded flex items-center justify-center shrink-0 border-0 cursor-pointer transition-colors bg-transparent text-dim-3 hover:text-dim-1"
          >
            <MoreHorizontal size={13} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setIsRenaming(true)}>
            <Pencil size={13} className="mr-2" />
            Rename
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={onToggleLock}>
            {track.locked ? (
              <Unlock size={13} className="mr-2" />
            ) : (
              <Lock size={13} className="mr-2" />
            )}
            {track.locked ? "Unlock" : "Lock"}
          </DropdownMenuItem>

          {onAddVideoTrack && (
            <DropdownMenuItem onSelect={onAddVideoTrack}>
              <Plus size={13} className="mr-2" />
              Add Track Below
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={onDeleteAllClips}
            className="text-red-400 focus:text-red-400"
          >
            <Trash2 size={13} className="mr-2" />
            Clear Clips
          </DropdownMenuItem>

          {canRemove && onRemove && (
            <DropdownMenuItem
              onSelect={onRemove}
              className="text-red-400 focus:text-red-400"
            >
              <Trash2 size={13} className="mr-2" />
              Remove Track
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
