import { useEffect, type RefObject } from "react";

/** Auto-scroll horizontally so the playhead stays in view during playback */
export function useTimelinePlayheadScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  currentTimeMs: number,
  zoom: number
): void {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const playheadPx = (currentTimeMs / 1000) * zoom;
    const { scrollLeft, clientWidth } = el;
    const margin = 80;
    if (playheadPx > scrollLeft + clientWidth - margin) {
      el.scrollLeft = playheadPx - margin;
    } else if (playheadPx < scrollLeft + margin) {
      el.scrollLeft = Math.max(0, playheadPx - margin);
    }
  }, [currentTimeMs, zoom, scrollRef]);
}
