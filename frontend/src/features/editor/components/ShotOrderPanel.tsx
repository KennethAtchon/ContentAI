import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Track, Clip } from "../types/editor";

interface ShotOrderPanelProps {
  videoTrack: Track;
  onReorder: (clipIds: string[]) => void;
  readOnly?: boolean;
}

function SortableShotCard({
  clip,
  index,
  readOnly,
}: {
  clip: Clip;
  index: number;
  readOnly?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-overlay-sm bg-studio-surface px-2 py-2 select-none"
    >
      <span
        {...attributes}
        {...listeners}
        className="text-dim-3 shrink-0 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical size={14} />
      </span>
      <span className="text-[10px] font-mono text-dim-3 w-4 shrink-0 text-right">
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-dim-1 truncate">{clip.label}</p>
        <p className="text-[10px] text-dim-3">
          {(clip.durationMs / 1000).toFixed(1)}s
        </p>
      </div>
    </div>
  );
}

export function ShotOrderPanel({
  videoTrack,
  onReorder,
  readOnly,
}: ShotOrderPanelProps) {
  const { t } = useTranslation();
  const clips = [...videoTrack.clips].sort((a, b) => a.startMs - b.startMs);
  const clipIds = clips.map((c) => c.id);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = clipIds.indexOf(active.id as string);
    const newIndex = clipIds.indexOf(over.id as string);
    const newOrder = arrayMove(clipIds, oldIndex, newIndex);
    onReorder(newOrder);
  }

  if (clips.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <p className="text-[10px] font-semibold text-dim-3 uppercase tracking-wider">
          {t("editor_shots_label")}
        </p>
        <p className="text-xs italic text-dim-3 text-center mt-2">
          {t("editor_shots_empty")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-[10px] font-semibold text-dim-3 uppercase tracking-wider shrink-0">
        {t("editor_shots_label")}
      </p>
      {!readOnly && (
        <p className="text-[10px] text-dim-3 shrink-0">
          {t("editor_shots_reorder_hint")}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={clipIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1">
            {clips.map((clip, i) => (
              <SortableShotCard
                key={clip.id}
                clip={clip}
                index={i + 1}
                readOnly={readOnly}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
