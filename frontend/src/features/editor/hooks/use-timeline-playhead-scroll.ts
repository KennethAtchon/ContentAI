import { useEffect, useRef, type RefObject } from "react";
import { usePlayheadClock } from "../context/PlayheadClockContext";

/** Auto-scroll horizontally so the playhead stays in view during playback */
export function useTimelinePlayheadScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  zoom: number
): void {
  const clock = usePlayheadClock();
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    return clock.subscribe((currentTimeMs) => {
      const el = scrollRef.current;
      if (!el) return;
      const z = zoomRef.current;
      const playheadPx = (currentTimeMs / 1000) * z;
      const { scrollLeft, clientWidth } = el;
      const margin = 80;
      if (playheadPx > scrollLeft + clientWidth - margin) {
        el.scrollLeft = playheadPx - margin;
      } else if (playheadPx < scrollLeft + margin) {
        el.scrollLeft = Math.max(0, playheadPx - margin);
      }
    });
  }, [clock, scrollRef]);
}
