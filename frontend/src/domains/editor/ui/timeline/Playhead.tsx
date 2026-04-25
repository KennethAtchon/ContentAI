interface Props {
  zoom: number;
  height: number;
  currentTimeMs?: number;
  onSeek?: (ms: number) => void;
}

export function Playhead({ zoom, height, currentTimeMs = 0, onSeek }: Props) {
  const left = (currentTimeMs / 1000) * zoom;

  return (
    <div
      className="absolute top-0 z-30 pointer-events-none"
      style={{ left, height }}
    >
      <button
        type="button"
        aria-label="Playhead"
        onClick={() => onSeek?.(currentTimeMs)}
        className="absolute -top-1 -left-1.5 h-3 w-3 rounded-full bg-studio-accent border border-white/40 pointer-events-auto"
      />
      <div className="h-full w-px bg-studio-accent shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
    </div>
  );
}
