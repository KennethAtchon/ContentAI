import { useRef } from "react";

interface Props {
  durationMs: number;
  zoom: number; // px/s
  onSeek: (ms: number) => void;
}

function formatTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimelineRuler({ durationMs, zoom, onSeek }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const totalWidthPx = Math.max((durationMs / 1000) * zoom, 800);

  // Major tick every ~5s (adapt to zoom)
  const majorIntervalSec = zoom < 20 ? 30 : zoom < 60 ? 10 : 5;
  const minorPerMajor = 5;
  const minorIntervalSec = majorIntervalSec / minorPerMajor;
  const totalSec = durationMs / 1000;

  const ticks: { x: number; label?: string }[] = [];
  let t = 0;
  while (t <= totalSec + majorIntervalSec) {
    const x = t * zoom;
    const isMajor =
      Math.round(t * 1000) % Math.round(majorIntervalSec * 1000) < 1;
    ticks.push({ x, label: isMajor ? formatTimecode(t * 1000) : undefined });
    t = Math.round((t + minorIntervalSec) * 1000) / 1000;
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ms = (x / zoom) * 1000;
    onSeek(ms);
  };

  return (
    <div
      ref={ref}
      className="relative h-8 bg-studio-surface border-b border-overlay-sm cursor-pointer shrink-0"
      style={{ minWidth: totalWidthPx, width: "100%" }}
      onClick={handleClick}
    >
      {ticks.map((tick, i) => (
        <div
          key={i}
          className="absolute top-0 flex flex-col items-center pointer-events-none"
          style={{ left: tick.x }}
        >
          <div
            className={["bg-dim-3", tick.label ? "h-4 w-px" : "h-2 w-px"].join(
              " "
            )}
          />
          {tick.label && (
            <span className="text-[9px] italic text-dim-3 mt-0.5 whitespace-nowrap select-none">
              {tick.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
