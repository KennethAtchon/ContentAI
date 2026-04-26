import { useRef, useState } from "react";
import { useEditorProjectStore } from "../../store/editor-project-store";
import { useEditorTimelineStore } from "../../store/editor-timeline-store";
import { Timeline } from "./Timeline";
import { TimelineToolstrip } from "./TimelineToolstrip";

export function TimelineSection() {
  const [snap, setSnap] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const durationMs = useEditorProjectStore((state) => state.durationMs);
  const zoomIn = useEditorTimelineStore((state) => state.zoomIn);
  const zoomOut = useEditorTimelineStore((state) => state.zoomOut);
  const zoomToFit = useEditorTimelineStore((state) => state.zoomToFit);

  return (
    <div style={{ height: 340 }} className="flex flex-col shrink-0">
      <TimelineToolstrip
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomFit={() =>
          zoomToFit(durationMs, scrollRef.current?.clientWidth ?? 0)
        }
        onSyncTimeline={() => undefined}
        snap={snap}
        onSnapChange={setSnap}
      />
      <div className="flex-1 overflow-hidden">
        <Timeline scrollRef={scrollRef} />
      </div>
    </div>
  );
}
