import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CompositionMode,
  SaveState,
  Timeline,
} from "../types/composition.types";
import { useSaveComposition } from "./use-save-composition";

export type UseAutosaveCompositionInput = {
  compositionId: string | null;
  expectedVersion: number;
  timeline: Timeline | null;
  editMode: CompositionMode;
  enabled?: boolean;
  debounceMs?: number;
  onSaved?: (nextVersion: number) => void;
};

export function useAutosaveComposition(input: UseAutosaveCompositionInput) {
  const {
    compositionId,
    expectedVersion,
    timeline,
    editMode,
    enabled = true,
    debounceMs = 800,
    onSaved,
  } = input;

  const saveComposition = useSaveComposition();
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const firstRenderRef = useRef(true);
  const latestSavedHashRef = useRef<string | null>(null);

  const timelineHash = useMemo(
    () => (timeline ? JSON.stringify(timeline) : null),
    [timeline],
  );

  useEffect(() => {
    if (!enabled || !compositionId || !timeline || !timelineHash) return;
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      latestSavedHashRef.current = timelineHash;
      return;
    }
    if (timelineHash === latestSavedHashRef.current) return;

    const timer = setTimeout(() => {
      setSaveState("saving");
      setSaveError(null);
      saveComposition
        .mutateAsync({
          compositionId,
          expectedVersion,
          editMode,
          timeline,
        })
        .then((result) => {
          latestSavedHashRef.current = timelineHash;
          setSaveState("saved");
          onSaved?.(result.version);
        })
        .catch((error: Error) => {
          setSaveState("error");
          setSaveError(error.message);
        });
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [
    compositionId,
    debounceMs,
    editMode,
    enabled,
    expectedVersion,
    onSaved,
    saveComposition,
    timeline,
    timelineHash,
  ]);

  return {
    saveState,
    saveError,
    isSaving: saveComposition.isPending || saveState === "saving",
  };
}
