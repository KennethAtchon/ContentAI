import { useReducer, useCallback } from "react";
import type {
  TimelineClip,
  ClipPatch,
  EditProject,
  ExportJobStatus,
  Transition,
} from "../types/editor";
import { editorReducer } from "../model/editor-reducer";
import { INITIAL_EDITOR_STATE } from "../model/editor-reducer-helpers";

export { INITIAL_EDITOR_STATE } from "../model/editor-reducer-helpers";

export function useEditorReducer() {
  const [state, dispatch] = useReducer(editorReducer, INITIAL_EDITOR_STATE);

  const loadProject = useCallback(
    (project: EditProject) => dispatch({ type: "LOAD_PROJECT", project }),
    []
  );
  const setTitle = useCallback(
    (title: string) => dispatch({ type: "SET_TITLE", title }),
    []
  );
  const setResolution = useCallback(
    (resolution: string) => dispatch({ type: "SET_RESOLUTION", resolution }),
    []
  );
  const setCurrentTime = useCallback(
    (ms: number) => dispatch({ type: "SET_CURRENT_TIME", ms }),
    []
  );
  const setPlaying = useCallback(
    (playing: boolean) => dispatch({ type: "SET_PLAYING", playing }),
    []
  );
  const setPlaybackRate = useCallback(
    (rate: number) => dispatch({ type: "SET_PLAYBACK_RATE", rate }),
    []
  );
  const setZoom = useCallback(
    (zoom: number) => dispatch({ type: "SET_ZOOM", zoom }),
    []
  );
  const selectClip = useCallback(
    (clipId: string | null) => dispatch({ type: "SELECT_CLIP", clipId }),
    []
  );
  const addClip = useCallback(
    (trackId: string, clip: TimelineClip) =>
      dispatch({ type: "ADD_CLIP", trackId, clip }),
    []
  );
  const updateClip = useCallback(
    (clipId: string, patch: ClipPatch) =>
      dispatch({ type: "UPDATE_CLIP", clipId, patch }),
    []
  );
  const removeClip = useCallback(
    (clipId: string) => dispatch({ type: "REMOVE_CLIP", clipId }),
    []
  );
  const rippleDeleteClip = useCallback(
    (clipId: string) => dispatch({ type: "RIPPLE_DELETE_CLIP", clipId }),
    []
  );
  const toggleClipEnabled = useCallback(
    (clipId: string) => dispatch({ type: "TOGGLE_CLIP_ENABLED", clipId }),
    []
  );
  const copyClip = useCallback(
    (clipId: string) => dispatch({ type: "COPY_CLIP", clipId }),
    []
  );
  const pasteClip = useCallback(
    (trackId: string, startMs: number) =>
      dispatch({ type: "PASTE_CLIP", trackId, startMs }),
    []
  );
  const splitClipAction = useCallback(
    (clipId: string, atMs: number) =>
      dispatch({ type: "SPLIT_CLIP", clipId, atMs }),
    []
  );
  const duplicateClip = useCallback(
    (clipId: string) => dispatch({ type: "DUPLICATE_CLIP", clipId }),
    []
  );
  const moveClip = useCallback(
    (clipId: string, startMs: number) =>
      dispatch({ type: "MOVE_CLIP", clipId, startMs }),
    []
  );
  const toggleTrackMute = useCallback(
    (trackId: string) => dispatch({ type: "TOGGLE_TRACK_MUTE", trackId }),
    []
  );
  const toggleTrackLock = useCallback(
    (trackId: string) => dispatch({ type: "TOGGLE_TRACK_LOCK", trackId }),
    []
  );
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);
  const setExportJob = useCallback(
    (jobId: string | null) => dispatch({ type: "SET_EXPORT_JOB", jobId }),
    []
  );
  const setExportStatus = useCallback(
    (status: ExportJobStatus | null) =>
      dispatch({ type: "SET_EXPORT_STATUS", status }),
    []
  );
  const setTransition = useCallback(
    (
      trackId: string,
      clipAId: string,
      clipBId: string,
      transitionType: Transition["type"],
      durationMs: number
    ) =>
      dispatch({
        type: "SET_TRANSITION",
        trackId,
        clipAId,
        clipBId,
        transitionType,
        durationMs,
      }),
    []
  );
  const removeTransition = useCallback(
    (trackId: string, transitionId: string) =>
      dispatch({ type: "REMOVE_TRANSITION", trackId, transitionId }),
    []
  );
  const reorderShots = useCallback(
    (trackId: string, clipIds: string[]) =>
      dispatch({ type: "REORDER_SHOTS", trackId, clipIds }),
    []
  );
  const addClipAutoPromote = useCallback(
    (preferredTrackId: string, clip: TimelineClip) =>
      dispatch({ type: "ADD_CLIP_AUTO_PROMOTE", preferredTrackId, clip }),
    []
  );
  const addCaptionClip = useCallback(
    (
      trackId: string,
      payload: {
        captionDocId: string;
        originVoiceoverClipId: string | null;
        startMs: number;
        durationMs: number;
        sourceStartMs: number;
        sourceEndMs: number;
        presetId: string;
        groupingMs?: number;
      }
    ) => dispatch({ type: "ADD_CAPTION_CLIP", trackId, ...payload }),
    []
  );
  const updateCaptionStyle = useCallback(
    (
      clipId: string,
      payload: {
        presetId?: string;
        overrides?: import("../types/editor").CaptionStyleOverrides;
        groupingMs?: number;
      }
    ) => dispatch({ type: "UPDATE_CAPTION_STYLE", clipId, ...payload }),
    []
  );
  const addVideoTrack = useCallback(
    (afterTrackId: string) => {
      dispatch({ type: "ADD_VIDEO_TRACK", afterTrackId });
    },
    []
  );
  const removeTrack = useCallback(
    (trackId: string) => dispatch({ type: "REMOVE_TRACK", trackId }),
    []
  );
  const renameTrack = useCallback(
    (trackId: string, name: string) =>
      dispatch({ type: "RENAME_TRACK", trackId, name }),
    []
  );
  const reorderTracks = useCallback(
    (trackIds: string[]) => dispatch({ type: "REORDER_TRACKS", trackIds }),
    []
  );

  return {
    state,
    dispatch,
    loadProject,
    setTitle,
    setResolution,
    setCurrentTime,
    setPlaying,
    setPlaybackRate,
    setZoom,
    selectClip,
    addClip,
    updateClip,
    removeClip,
    rippleDeleteClip,
    toggleClipEnabled,
    copyClip,
    pasteClip,
    splitClip: splitClipAction,
    duplicateClip,
    moveClip,
    toggleTrackMute,
    toggleTrackLock,
    undo,
    redo,
    setExportJob,
    setExportStatus,
    setTransition,
    removeTransition,
    reorderShots,
    addClipAutoPromote,
    addCaptionClip,
    updateCaptionStyle,
    addVideoTrack,
    removeTrack,
    renameTrack,
    reorderTracks,
  };
}

export type EditorStore = ReturnType<typeof useEditorReducer>;
