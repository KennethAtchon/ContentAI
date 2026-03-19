
interface Props {
  currentTimeMs: number;
  zoom: number; // px/s
  height: number; // total timeline content height
  onSeek: (ms: number) => void;
}

export function Playhead({ currentTimeMs, zoom, height, onSeek }: Props) {
  const x = (currentTimeMs / 1000) * zoom;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startMs = currentTimeMs;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newMs = Math.max(0, startMs + (dx / zoom) * 1000);
      onSeek(newMs);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      className="absolute top-0 z-20 pointer-events-none"
      style={{ left: x, height }}
    >
      {/* Vertical line */}
      <div className="absolute top-0 left-0 w-[2px] h-full bg-studio-accent/90" />

      {/* Drag handle */}
      <div
        className="absolute top-0 left-[-5px] w-3 h-3 rounded-full bg-studio-accent cursor-grab active:cursor-grabbing pointer-events-auto shadow-md"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
