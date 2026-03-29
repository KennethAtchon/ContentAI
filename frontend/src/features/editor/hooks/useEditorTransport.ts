import { useCallback } from "react";
import { stripLocallyModifiedFromTracks } from "../utils/strip-local-editor-fields";
import type { EditorStore } from "./useEditorStore";

interface SaveSnapshot {
  tracks: ReturnType<typeof stripLocallyModifiedFromTracks>;
  durationMs: number;
  title: string;
  resolution: string;
}

interface PublishStateRef {
  current: {
    tracks: Parameters<typeof stripLocallyModifiedFromTracks>[0];
    durationMs: number;
    title: string;
    resolution: string;
  };
}

interface TimerRef {
  current: ReturnType<typeof setTimeout> | null;
}

interface UseEditorTransportParams {
  store: EditorStore;
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  flushSave: (payload: SaveSnapshot) => Promise<unknown>;
  runPublish: () => Promise<unknown>;
  saveTimerRef: TimerRef;
  editorPublishStateRef: PublishStateRef;
  setPublishDialogOpen: (open: boolean) => void;
  onBack: () => void;
}

function makeSnapshot(ref: PublishStateRef["current"]) {
  return {
    tracks: stripLocallyModifiedFromTracks(ref.tracks),
    durationMs: ref.durationMs,
    title: ref.title,
    resolution: ref.resolution,
  };
}

export function useEditorTransport({
  store,
  timelineContainerRef,
  flushSave,
  runPublish,
  saveTimerRef,
  editorPublishStateRef,
  setPublishDialogOpen,
  onBack,
}: UseEditorTransportParams) {
  const { state } = store;

  const jumpToStart = useCallback(() => {
    store.setCurrentTime(0);
    store.setPlaying(false);
  }, [store]);

  const jumpToEnd = useCallback(() => {
    store.setCurrentTime(state.durationMs);
    store.setPlaying(false);
  }, [store, state.durationMs]);

  const rewind = useCallback(() => {
    store.setCurrentTime(Math.max(0, state.currentTimeMs - 5000));
  }, [store, state.currentTimeMs]);

  const fastForward = useCallback(() => {
    store.setCurrentTime(Math.min(state.durationMs, state.currentTimeMs + 5000));
  }, [store, state.durationMs, state.currentTimeMs]);

  const zoomIn = useCallback(() => store.setZoom(state.zoom * 1.25), [store, state.zoom]);
  const zoomOut = useCallback(() => store.setZoom(state.zoom / 1.25), [store, state.zoom]);

  const zoomFit = useCallback(() => {
    const containerW = timelineContainerRef.current?.clientWidth ?? 800;
    const nextZoom = state.durationMs > 0 ? (containerW / state.durationMs) * 1000 : 40;
    store.setZoom(nextZoom);
  }, [timelineContainerRef, state.durationMs, store]);

  const saveNow = useCallback(() => {
    const snap = editorPublishStateRef.current;
    void flushSave(makeSnapshot(snap));
  }, [editorPublishStateRef, flushSave]);

  const handleConfirmPublish = useCallback(async () => {
    setPublishDialogOpen(false);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    try {
      await flushSave(makeSnapshot(editorPublishStateRef.current));
      await runPublish();
    } catch {
      // keep dialog closed; user can retry publish
    }
  }, [setPublishDialogOpen, saveTimerRef, flushSave, editorPublishStateRef, runPublish]);

  const handleBack = useCallback(async () => {
    if (!state.isReadOnly && saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      try {
        await flushSave(makeSnapshot(editorPublishStateRef.current));
      } catch {
        // allow navigation even if save fails
      }
    }
    onBack();
  }, [state.isReadOnly, saveTimerRef, flushSave, editorPublishStateRef, onBack]);

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
