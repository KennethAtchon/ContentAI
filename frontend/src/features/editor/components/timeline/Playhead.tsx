import { useEffect, useRef } from "react";
import { usePlayheadClock } from "../../context/PlayheadClockContext";

interface Props {
  zoom: number;
  height: number;
  onSeek: (ms: number) => void;
}

export function Playhead({ zoom, height, onSeek }: Props) {
  const clock = usePlayheadClock();
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Subscribe to clock and update position directly on the DOM — no React renders.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    return clock.subscribe((ms) => {
      el.style.left = `${(ms / 1000) * zoomRef.current}px`;
    });
  }, [clock]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startMs = clock.getTime();
    const dragZoom = zoomRef.current;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newMs = Math.max(0, startMs + (dx / dragZoom) * 1000);
      onSeek(newMs);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const initialX = (clock.getTime() / 1000) * zoom;

  return (
    <div
      ref={containerRef}
      className="absolute top-0 z-20 pointer-events-none"
      style={{ left: initialX, height }}
    >
      <div className="absolute top-0 left-0 w-[2px] h-full bg-studio-accent/90" />
      <div
        className="absolute top-0 left-[-5px] w-3 h-3 rounded-full bg-studio-accent cursor-grab active:cursor-grabbing pointer-events-auto shadow-md"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
