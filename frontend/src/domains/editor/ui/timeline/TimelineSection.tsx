import { useRef, useState } from "react";
import { Timeline } from "./Timeline";
import { TimelineToolstrip } from "./TimelineToolstrip";

export function TimelineSection() {
  const [snap, setSnap] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ height: 340 }} className="flex flex-col shrink-0">
      <TimelineToolstrip
        onZoomIn={() => undefined}
        onZoomOut={() => undefined}
        onZoomFit={() => undefined}
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
