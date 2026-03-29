import type { ComponentProps } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TrackHeader } from "./TrackHeader";

/** Thin sortable wrapper — keeps dnd-kit logic out of TrackHeader itself */
export function SortableTrackHeader(props: ComponentProps<typeof TrackHeader>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.track.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <TrackHeader {...props} isDragging={isDragging} gripProps={{ ...attributes, ...listeners }} />
    </div>
  );
}
