import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type {
  CompositionRecord,
  EditorSelection,
  Timeline,
} from "../types/composition.types";

export type TimelineHistoryEntry = {
  timeline: Timeline;
  selection: EditorSelection;
  label: string;
  source: "ui" | "keyboard";
  category: "timeline" | "text" | "captions" | "history" | "other";
};

type TimelineActionResult = {
  timeline: Timeline;
  selection?: Partial<EditorSelection>;
};

type ApplyTimelineAction = (
  currentSelection: EditorSelection,
  setEditableComposition: Dispatch<SetStateAction<CompositionRecord | null>>,
  setSelection: Dispatch<SetStateAction<EditorSelection>>,
  label: string,
  metadata: FallbackMetadata,
  compute: (prev: CompositionRecord) => TimelineActionResult | null,
) => void;

type FallbackMetadata = {
  source: "ui" | "keyboard";
  category: "timeline" | "text" | "captions" | "history" | "other";
};

type UndoRedoFn = (
  currentSelection: EditorSelection,
  fallbackLabel: string,
  fallbackMetadata: FallbackMetadata,
  labelBuilder: (label: string) => string,
  setEditableComposition: Dispatch<SetStateAction<CompositionRecord | null>>,
  setSelection: Dispatch<SetStateAction<EditorSelection>>,
) => void;

export type HistoryViewEntry = Pick<
  TimelineHistoryEntry,
  "label" | "source" | "category"
>;

export type EditorHistoryState = {
  pastEntries: TimelineHistoryEntry[];
  futureEntries: TimelineHistoryEntry[];
  lastActionLabel: string | null;
  canUndo: boolean;
  canRedo: boolean;
  nextUndoLabel: string | null;
  nextRedoLabel: string | null;
  nextUndoEntry: TimelineHistoryEntry | null;
  nextRedoEntry: TimelineHistoryEntry | null;
  historyTrail: HistoryViewEntry[];
  resetHistory: () => void;
  applyTimelineAction: ApplyTimelineAction;
  undo: UndoRedoFn;
  redo: UndoRedoFn;
};

export function useEditorHistory(): EditorHistoryState {
  const [pastEntries, setPastEntries] = useState<TimelineHistoryEntry[]>([]);
  const [futureEntries, setFutureEntries] = useState<TimelineHistoryEntry[]>([]);
  const [lastActionLabel, setLastActionLabel] = useState<string | null>(null);

  const resetHistory = useCallback(() => {
    setPastEntries([]);
    setFutureEntries([]);
    setLastActionLabel(null);
  }, []);

  const applyTimelineAction = useCallback(
    (
      currentSelection: EditorSelection,
      setEditableComposition: Dispatch<SetStateAction<CompositionRecord | null>>,
      setSelection: Dispatch<SetStateAction<EditorSelection>>,
      label: string,
      metadata: {
        source: "ui" | "keyboard";
        category: "timeline" | "text" | "captions" | "history" | "other";
      },
      compute: (prev: CompositionRecord) => TimelineActionResult | null,
    ) => {
      setEditableComposition((prev) => {
        if (!prev) return prev;
        const result = compute(prev);
        if (!result) return prev;
        const prevHash = JSON.stringify(prev.timeline);
        const nextHash = JSON.stringify(result.timeline);
        if (prevHash === nextHash) return prev;
        setPastEntries((items) => [
          ...items.slice(-49),
          {
            timeline: prev.timeline,
            selection: currentSelection,
            label,
            ...metadata,
          },
        ]);
        setFutureEntries([]);
        if (result.selection) {
          setSelection((current) => ({ ...current, ...result.selection }));
        }
        setLastActionLabel(label);
        return {
          ...prev,
          timeline: result.timeline,
        };
      });
    },
    [],
  );

  const canUndo = pastEntries.length > 0;
  const canRedo = futureEntries.length > 0;
  const nextUndoLabel = pastEntries[pastEntries.length - 1]?.label ?? null;
  const nextRedoLabel = futureEntries[0]?.label ?? null;
  const nextUndoEntry = pastEntries[pastEntries.length - 1] ?? null;
  const nextRedoEntry = futureEntries[0] ?? null;
  const historyTrail = pastEntries.slice(-3);

  const undo = useCallback(
    (
      currentSelection: EditorSelection,
      fallbackLabel: string,
      fallbackMetadata: FallbackMetadata,
      undoLabelBuilder: (label: string) => string,
      setEditableComposition: Dispatch<SetStateAction<CompositionRecord | null>>,
      setSelection: Dispatch<SetStateAction<EditorSelection>>,
    ) => {
      setPastEntries((items) => {
        if (items.length === 0) return items;
        const previous = items[items.length - 1];
        setEditableComposition((prev) => {
          if (!prev) return prev;
          setFutureEntries((future) => [
            {
              timeline: prev.timeline,
              selection: currentSelection,
              label: lastActionLabel ?? fallbackLabel,
              ...fallbackMetadata,
            },
            ...future,
          ].slice(0, 50));
          setSelection(previous.selection);
          return {
            ...prev,
            timeline: previous.timeline,
          };
        });
        setLastActionLabel(undoLabelBuilder(previous.label));
        return items.slice(0, -1);
      });
    },
    [lastActionLabel],
  );

  const redo = useCallback(
    (
      currentSelection: EditorSelection,
      fallbackLabel: string,
      fallbackMetadata: FallbackMetadata,
      redoLabelBuilder: (label: string) => string,
      setEditableComposition: Dispatch<SetStateAction<CompositionRecord | null>>,
      setSelection: Dispatch<SetStateAction<EditorSelection>>,
    ) => {
      setFutureEntries((items) => {
        if (items.length === 0) return items;
        const [next, ...rest] = items;
        setEditableComposition((prev) => {
          if (!prev) return prev;
          setPastEntries((past) => [
            ...past.slice(-49),
            {
              timeline: prev.timeline,
              selection: currentSelection,
              label: lastActionLabel ?? fallbackLabel,
              ...fallbackMetadata,
            },
          ]);
          setSelection(next.selection);
          return {
            ...prev,
            timeline: next.timeline,
          };
        });
        setLastActionLabel(redoLabelBuilder(next.label));
        return rest;
      });
    },
    [lastActionLabel],
  );

  return useMemo(
    () => ({
      pastEntries,
      futureEntries,
      lastActionLabel,
      canUndo,
      canRedo,
      nextUndoLabel,
      nextRedoLabel,
      nextUndoEntry,
      nextRedoEntry,
      historyTrail: historyTrail.map((entry) => ({
        label: entry.label,
        source: entry.source,
        category: entry.category,
      })),
      resetHistory,
      applyTimelineAction: applyTimelineAction as ApplyTimelineAction,
      undo,
      redo,
    }),
    [
      applyTimelineAction,
      canRedo,
      canUndo,
      futureEntries,
      lastActionLabel,
      nextRedoLabel,
      nextUndoLabel,
      nextRedoEntry,
      nextUndoEntry,
      historyTrail,
      pastEntries,
      redo,
      resetHistory,
      undo,
    ],
  );
}
