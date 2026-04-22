import { useCallback } from "react";
import { toast } from "sonner";
import type { EditorStore } from "./useEditorStore";
import type { SaveService } from "../services/save-service";
import { usePlayheadClock } from "../context/PlayheadClockContext";

interface UseEditorTransportParams {
  store: EditorStore;
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  saveService: SaveService;
  runPublish: () => Promise<unknown>;
  setPublishDialogOpen: (open: boolean) => void;
  onBack: () => void;
}

export function useEditorTransport({
  store,
  timelineContainerRef,
  saveService,
  runPublish,
  setPublishDialogOpen,
  onBack,
}: UseEditorTransportParams) {
  const { state } = store;
  const clock = usePlayheadClock();

  const jumpToStart = useCallback(() => {
    store.setCurrentTime(0);
    store.setPlaying(false);
  }, [store]);

  const jumpToEnd = useCallback(() => {
    store.setCurrentTime(state.durationMs);
    store.setPlaying(false);
  }, [store, state.durationMs]);

  // Read live time from clock so these don't re-create on every playhead tick.
  const rewind = useCallback(() => {
    store.setCurrentTime(Math.max(0, clock.getTime() - 5000));
  }, [store, clock]);

  const fastForward = useCallback(() => {
    store.setCurrentTime(Math.min(state.durationMs, clock.getTime() + 5000));
  }, [store, state.durationMs, clock]);

  const zoomIn = useCallback(
    () => store.setZoom(state.zoom * 1.25),
    [store, state.zoom]
  );
  const zoomOut = useCallback(
    () => store.setZoom(state.zoom / 1.25),
    [store, state.zoom]
  );

  const zoomFit = useCallback(() => {
    const containerW = timelineContainerRef.current?.clientWidth ?? 800;
    const nextZoom =
      state.durationMs > 0 ? (containerW / state.durationMs) * 1000 : 40;
    store.setZoom(nextZoom);
  }, [timelineContainerRef, state.durationMs, store]);

  const saveNow = useCallback(() => {
    void saveService.flushNow();
  }, [saveService]);

  const handleConfirmPublish = useCallback(async () => {
    setPublishDialogOpen(false);
    saveService.cancelPending();
    try {
      await saveService.flushNow();
      await runPublish();
    } catch {
      toast.error("Failed to publish project.");
    }
  }, [setPublishDialogOpen, saveService, runPublish]);

  const handleBack = useCallback(async () => {
    if (!state.isReadOnly) {
      saveService.cancelPending();
      try {
        await saveService.flushNow();
      } catch {
        // allow navigation even if save fails
      }
    }
    onBack();
  }, [state.isReadOnly, saveService, onBack]);

  return {
    jumpToStart,
    jumpToEnd,
    rewind,
    fastForward,
    zoomIn,
    zoomOut,
    zoomFit,
    saveNow,
    handleConfirmPublish,
    handleBack,
  };
}
