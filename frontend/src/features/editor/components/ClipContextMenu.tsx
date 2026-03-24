import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/shared/components/ui/context-menu";
import type { Clip, Track, Transition } from "../types/editor";

// ── Clip context menu ──────────────────────────────────────────────────────────

interface ClipContextMenuProps {
  clip: Clip;
  track: Track;
  hasClipboard: boolean;
  children: React.ReactNode;
  onSplit: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onToggleEnabled: () => void;
  onRippleDelete: () => void;
  onDelete: () => void;
  onSetSpeed: (speed: number) => void;
}

export function ClipContextMenu({
  clip,
  hasClipboard,
  children,
  onSplit,
  onDuplicate,
  onCopy,
  onPaste,
  onToggleEnabled,
  onRippleDelete,
  onDelete,
  onSetSpeed,
}: ClipContextMenuProps) {
  const isDisabled = clip.enabled === false;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={onSplit}>
          Split at Playhead
          <ContextMenuShortcut>S</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onDuplicate}>
          Duplicate
          <ContextMenuShortcut>⌘D</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={onCopy}>
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={onPaste} disabled={!hasClipboard}>
          Paste
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={onToggleEnabled}>
          {isDisabled ? "Enable Clip" : "Disable Clip"}
        </ContextMenuItem>

        <ContextMenuSub>
          <ContextMenuSubTrigger>Speed</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4].map((s) => (
              <ContextMenuItem
                key={s}
                onSelect={() => onSetSpeed(s)}
                className={clip.speed === s ? "text-studio-accent" : ""}
              >
                {s}×{clip.speed === s ? " ✓" : ""}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={onRippleDelete}>
          Ripple Delete
          <ContextMenuShortcut>⇧⌫</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={onDelete}
          className="text-red-400 focus:text-red-400"
        >
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ── Placeholder clip context menu ──────────────────────────────────────────────

interface PlaceholderContextMenuProps {
  children: React.ReactNode;
  onDelete: () => void;
}

export function PlaceholderContextMenu({
  children,
  onDelete,
}: PlaceholderContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem
          onSelect={onDelete}
          className="text-red-400 focus:text-red-400"
        >
          Delete Placeholder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ── Track area context menu (right-click on empty track space) ─────────────────

interface TrackAreaContextMenuProps {
  children: React.ReactNode;
  hasClipboard: boolean;
  onPaste: () => void;
}

export function TrackAreaContextMenu({
  children,
  hasClipboard,
  onPaste,
}: TrackAreaContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onSelect={onPaste} disabled={!hasClipboard}>
          Paste Here
          <ContextMenuShortcut>⌘V</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ── Track header context menu ──────────────────────────────────────────────────

interface TrackHeaderContextMenuProps {
  track: Track;
  children: React.ReactNode;
  onToggleMute: () => void;
  onToggleLock: () => void;
  onDeleteAllClips: () => void;
}

export function TrackHeaderContextMenu({
  track,
  children,
  onToggleMute,
  onToggleLock,
  onDeleteAllClips,
}: TrackHeaderContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={onToggleMute}>
          {track.muted ? "Unmute Track" : "Mute Track"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onToggleLock}>
          {track.locked ? "Unlock Track" : "Lock Track"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={onDeleteAllClips}
          className="text-red-400 focus:text-red-400"
          disabled={track.clips.length === 0}
        >
          Delete All Clips in Track
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ── Transition diamond context menu ───────────────────────────────────────────

interface TransitionContextMenuProps {
  transition: Transition | undefined;
  children: React.ReactNode;
  onRemove: () => void;
}

export function TransitionContextMenu({
  transition,
  children,
  onRemove,
}: TransitionContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem
          onSelect={onRemove}
          disabled={!transition || transition.type === "none"}
          className="text-red-400 focus:text-red-400"
        >
          Remove Transition
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
