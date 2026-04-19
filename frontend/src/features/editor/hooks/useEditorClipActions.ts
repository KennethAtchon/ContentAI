import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { Clip, TrackType, Transition, ClipPatch } from "../types/editor";
import type { EditorStore } from "./useEditorStore";
import { hasCollision } from "../utils/clip-constraints";
import type { TabKey } from "../components/panels/LeftPanel";

interface UseEditorClipActionsParams {
  store: EditorStore;
  t: (key: string) => string;
  selectedTransitionKey: [string, string, string] | null;
  setSelectedTransitionKey: (key: [string, string, string] | null) => void;
  setPendingAdd: (value: { trackId: string; startMs: number } | null) => void;
  setMediaActiveTab: (tab: TabKey) => void;
}

export function useEditorClipActions({
  store,
  t,
  selectedTransitionKey,
  setSelectedTransitionKey,
  setPendingAdd,
  setMediaActiveTab,
}: UseEditorClipActionsParams) {
  const handleAddClip = useCallback(
    (trackId: string, clip: Clip) => {
      const track = store.state.tracks.find((item) => item.id === trackId);
      if (track && hasCollision(track, clip.startMs, clip.durationMs)) {
        toast.error(t("editor_clip_collision"));
        setPendingAdd(null);
        return;
      }
      store.addClipAutoPromote(trackId, clip);
    },
    [store, t, setPendingAdd]
  );

  const handleUpdateClip = useCallback(
    (clipId: string, patch: ClipPatch) => store.updateClip(clipId, patch),
    [store]
  );

  const handleRemoveClip = useCallback(
    (clipId: string) => store.removeClip(clipId),
    [store]
  );

  const handleDeleteAllClipsInTrack = useCallback(
    (trackId: string) => {
      const track = store.state.tracks.find((item) => item.id === trackId);
      if (!track) return;
      for (const clip of track.clips) store.removeClip(clip.id);
    },
    [store]
  );

  const handleClipSplit = useCallback(
    (clipId: string) => store.splitClip(clipId, store.state.currentTimeMs),
    [store]
  );
  const handleClipDuplicate = useCallback(
    (clipId: string) => store.duplicateClip(clipId),
    [store]
  );
  const handleClipCopy = useCallback(
    (clipId: string) => store.copyClip(clipId),
    [store]
  );
  const handleClipPaste = useCallback(
    (trackId: string, startMs: number) => store.pasteClip(trackId, startMs),
    [store]
  );
  const handleClipToggleEnabled = useCallback(
    (clipId: string) => store.toggleClipEnabled(clipId),
    [store]
  );
  const handleClipRippleDelete = useCallback(
    (clipId: string) => store.rippleDeleteClip(clipId),
    [store]
  );
  const handleClipSetSpeed = useCallback(
    (clipId: string, speed: number) => store.updateClip(clipId, { speed }),
    [store]
  );

  const handleFocusMediaForTrack = useCallback(
    (trackType: TrackType, trackId: string, startMs: number) => {
      setPendingAdd({ trackId, startMs });
      setMediaActiveTab(
        trackType === "audio" || trackType === "music" ? "audio" : "media"
      );
    },
    [setPendingAdd, setMediaActiveTab]
  );

  const handleSelectTransition = useCallback(
    (trackId: string, clipAId: string, clipBId: string) => {
      store.selectClip(null);
      setSelectedTransitionKey([trackId, clipAId, clipBId]);
    },
    [store, setSelectedTransitionKey]
  );

  const selectedTransition = useMemo<Transition | null>(() => {
    if (!selectedTransitionKey) return null;
    const [trackId, clipAId, clipBId] = selectedTransitionKey;
    const track = store.state.tracks.find((item) => item.id === trackId);
    return (
      (track?.transitions ?? []).find(
        (transition) =>
          transition.clipAId === clipAId && transition.clipBId === clipBId
      ) ?? null
    );
  }, [selectedTransitionKey, store.state.tracks]);

  useEffect(() => {
    if (store.state.selectedClipId) setSelectedTransitionKey(null);
  }, [store.state.selectedClipId, setSelectedTransitionKey]);

  return useMemo(
    () => ({
      handleAddClip,
      handleUpdateClip,
      handleRemoveClip,
      handleDeleteAllClipsInTrack,
      handleClipSplit,
      handleClipDuplicate,
      handleClipCopy,
      handleClipPaste,
      handleClipToggleEnabled,
      handleClipRippleDelete,
      handleClipSetSpeed,
      handleFocusMediaForTrack,
      handleSelectTransition,
      selectedTransition,
    }),
    [
      handleAddClip,
      handleUpdateClip,
      handleRemoveClip,
      handleDeleteAllClipsInTrack,
      handleClipSplit,
      handleClipDuplicate,
      handleClipCopy,
      handleClipPaste,
      handleClipToggleEnabled,
      handleClipRippleDelete,
      handleClipSetSpeed,
      handleFocusMediaForTrack,
      handleSelectTransition,
      selectedTransition,
    ]
  );
}
