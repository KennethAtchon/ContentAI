import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Undo2,
  Redo2,
  SkipBack,
  Rewind,
  Play,
  Pause,
  FastForward,
  SkipForward,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Upload,
  Lock,
  FilePlus,
  Sparkles,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { invalidateEditorProjectsQueries } from "@/shared/lib/query-invalidation";
import { useMediaLibrary } from "@/features/media/hooks/use-media-library";
import type { MediaItem } from "@/features/media/types/media.types";
import { useEditorReducer } from "../hooks/useEditorStore";
import { usePlayback } from "../hooks/usePlayback";
import { Timeline } from "./Timeline";
import { PreviewArea } from "./PreviewArea";
import { Inspector } from "./Inspector";
import { MediaPanel } from "./MediaPanel";
import { ExportModal } from "./ExportModal";
import { ResolutionPicker } from "./ResolutionPicker";
import { AssetUrlMapContext } from "../contexts/asset-url-map-context";
import type { EditProject, Clip, Track } from "../types/editor";
import {
  EDITOR_AUTOSAVE_DEBOUNCE_MS,
  EDITOR_AUTOSAVE_INTERVAL_MS,
} from "../constants/editor";
import {
  patchEditorProject,
  publishEditorProject,
  type PatchProjectParams,
} from "../services/editor-api";
import { formatHHMMSSFF, parseTimecode } from "../utils/timecode";
import { stripLocallyModifiedFromTracks } from "../utils/strip-local-editor-fields";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

interface Props {
  project: EditProject;
  onBack: () => void;
}

interface Asset {
  id: string;
  type: string;
  r2Url?: string;
  mediaUrl?: string;
  audioUrl?: string;
  durationMs: number | null;
}

export function EditorLayout({ project, onBack }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const fetcher = useQueryFetcher<{ assets: Asset[] }>();
  const store = useEditorReducer();
  const [showExport, setShowExport] = useState(false);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [timecodeEditing, setTimecodeEditing] = useState(false);
  const [timecodeInput, setTimecodeInput] = useState("");
  const [effectPreview, setEffectPreview] = useState<{ clipId: string; patch: Partial<Clip> } | null>(null);
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<
    [string, string, string] | null
  >(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSavingPatchRef = useRef(false);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const lastHandledServerUpdatedAt = useRef(project.updatedAt);
  const [pollIntervalMs, setPollIntervalMs] = useState(2000);
  const [scriptResetPending, setScriptResetPending] =
    useState<EditProject | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  const hasPlaceholders =
    store.state.tracks
      .find((t) => t.type === "video")
      ?.clips.some((c) => c.isPlaceholder) ?? false;

  useEffect(() => {
    if (!hasPlaceholders) setPollIntervalMs(2000);
  }, [hasPlaceholders]);

  const projectFetcher = useQueryFetcher<{ project: EditProject }>();
  const { data: polledPayload } = useQuery({
    queryKey: queryKeys.api.editorProject(project.id),
    queryFn: () => projectFetcher(`/api/editor/${project.id}`),
    enabled: !!project.id,
    refetchInterval: hasPlaceholders ? pollIntervalMs : false,
  });

  useEffect(() => {
    store.loadProject(project);
    lastHandledServerUpdatedAt.current = project.updatedAt;
  }, [project.id]);

  const editorStoreRef = useRef(store);
  editorStoreRef.current = store;

  useEffect(() => {
    const serverP = polledPayload?.project;
    if (!serverP) return;
    if (serverP.updatedAt === lastHandledServerUpdatedAt.current) return;

    setPollIntervalMs((p) => Math.min(p * 2, 15000));

    const serverVideo = serverP.tracks.find((t) => t.type === "video");
    const localVideo = editorStoreRef.current.state.tracks.find(
      (t) => t.type === "video",
    );
    const serverAllPlaceholders =
      !!serverVideo &&
      serverVideo.clips.length > 0 &&
      serverVideo.clips.every((c) => c.isPlaceholder);
    const localHasRealClip = localVideo?.clips.some(
      (c) => Boolean(c.assetId) && !c.isPlaceholder,
    );

    if (serverAllPlaceholders && localHasRealClip) {
      setScriptResetPending(serverP);
      return;
    }

    lastHandledServerUpdatedAt.current = serverP.updatedAt;
    editorStoreRef.current.dispatch({
      type: "MERGE_TRACKS_FROM_SERVER",
      tracks: serverP.tracks as Track[],
    });
  }, [polledPayload?.project]);

  // ── Asset URL Map ───────────────────────────────────────────────────────────
  // Fetch project assets to build assetId → URL map for PreviewArea and waveforms.
  // Uses the same query key as MediaPanel — TanStack Query serves from cache.
  const { data: assetsData } = useQuery({
    queryKey: queryKeys.api.contentAssets(project.generatedContentId ?? 0),
    queryFn: () =>
      fetcher(`/api/assets?generatedContentId=${project.generatedContentId}`),
    enabled: !!project.generatedContentId,
  });
  const { data: libraryData } = useMediaLibrary();

  const assetUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of assetsData?.assets ?? []) {
      const url = a.mediaUrl ?? a.audioUrl ?? a.r2Url ?? "";
      if (url) map.set(a.id, url);
    }
    for (const item of (libraryData?.items ?? []) as MediaItem[]) {
      const url = item.mediaUrl ?? item.r2Url ?? "";
      if (url) map.set(item.id, url);
    }
    return map;
  }, [assetsData, libraryData]);

  // ── Auto-save ───────────────────────────────────────────────────────────────
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const {
    mutate: queueSave,
    mutateAsync: flushSave,
    isPending: isSavingPatch,
  } = useMutation({
    mutationFn: (patch: PatchProjectParams) =>
      patchEditorProject(project.id, patch),
    onSuccess: () => {
      setLastSavedAt(new Date());
      setIsDirty(false);
      void invalidateEditorProjectsQueries(queryClient);
    },
  });
  isSavingPatchRef.current = isSavingPatch;

  const { mutateAsync: runPublish, isPending: isPublishing } = useMutation({
    mutationFn: () => publishEditorProject(project.id),
    onSuccess: (res) => {
      void invalidateEditorProjectsQueries(queryClient);
      store.loadProject({
        ...project,
        tracks: store.state.tracks,
        status: res.status as "published",
        publishedAt: res.publishedAt,
      });
    },
  });

  const { mutate: createNewDraft, isPending: isCreatingDraft } = useMutation({
    mutationFn: () =>
      authenticatedFetchJson<{ project: EditProject }>(
        `/api/editor/${project.id}/new-draft`,
        {
          method: "POST",
        }
      ),
    onSuccess: () => {
      void invalidateEditorProjectsQueries(queryClient);
      onBack();
    },
  });

  const { mutate: aiAssemble, isPending: isAiAssembling } = useMutation({
    mutationFn: (platform: string) =>
      authenticatedFetchJson<{
        timeline: EditProject["tracks"];
        fallback: boolean;
      }>(`/api/editor/${project.id}/ai-assemble`, {
        method: "POST",
        body: JSON.stringify({ platform }),
      }),
    onSuccess: async (res) => {
      const merged: EditProject = { ...project, tracks: res.timeline };
      store.loadProject(merged);
      let durationMs = 0;
      for (const tr of res.timeline) {
        for (const c of tr.clips) {
          durationMs = Math.max(durationMs, c.startMs + c.durationMs);
        }
      }
      try {
        await flushSave({
          tracks: stripLocallyModifiedFromTracks(res.timeline),
          durationMs,
          title: merged.title ?? undefined,
        });
      } catch {
        // Autosave will retry on next edit; user may also use sync.
      }
    },
  });

  const scheduleSave = useCallback(
    (patch: PatchProjectParams) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(
        () => queueSave(patch),
        EDITOR_AUTOSAVE_DEBOUNCE_MS
      );
    },
    [queueSave]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ── Playback ────────────────────────────────────────────────────────────────
  const onTick = useCallback(
    (ms: number) => store.setCurrentTime(ms),
    [store.setCurrentTime]
  );
  const onEnd = useCallback(() => store.setPlaying(false), [store.setPlaying]);
  usePlayback({
    isPlaying: store.state.isPlaying,
    currentTimeMs: store.state.currentTimeMs,
    durationMs: store.state.durationMs,
    playbackRate: store.state.playbackRate,
    onTick,
    onEnd,
  });

  // ── Clip actions (trigger auto-save via tracks effect) ──────────────────────
  const handleAddClip = useCallback(
    (trackId: string, clip: Clip) => store.addClipAutoPromote(trackId, clip),
    [store.addClipAutoPromote]
  );

  const handleUpdateClip = useCallback(
    (clipId: string, patch: Partial<Clip>) => store.updateClip(clipId, patch),
    [store.updateClip]
  );

  const handleRemoveClip = useCallback(
    (clipId: string) => store.removeClip(clipId),
    [store.removeClip]
  );

  const handleDeleteAllClipsInTrack = useCallback(
    (trackId: string) => {
      const track = store.state.tracks.find((t) => t.id === trackId);
      if (!track) return;
      for (const clip of track.clips) store.removeClip(clip.id);
    },
    [store.removeClip, store.state.tracks]
  );

  const handleClipSplit = useCallback(
    (clipId: string) => store.splitClip(clipId, store.state.currentTimeMs),
    [store.splitClip, store.state.currentTimeMs]
  );

  const handleClipDuplicate = useCallback(
    (clipId: string) => store.duplicateClip(clipId),
    [store.duplicateClip]
  );

  const handleClipCopy = useCallback(
    (clipId: string) => store.copyClip(clipId),
    [store.copyClip]
  );

  const handleClipPaste = useCallback(
    (trackId: string, startMs: number) => store.pasteClip(trackId, startMs),
    [store.pasteClip]
  );

  const handleClipToggleEnabled = useCallback(
    (clipId: string) => store.toggleClipEnabled(clipId),
    [store.toggleClipEnabled]
  );

  const handleClipRippleDelete = useCallback(
    (clipId: string) => store.rippleDeleteClip(clipId),
    [store.rippleDeleteClip]
  );

  const handleClipSetSpeed = useCallback(
    (clipId: string, speed: number) =>
      store.updateClip(clipId, { speed }),
    [store.updateClip]
  );

  const handleSelectTransition = useCallback(
    (trackId: string, clipAId: string, clipBId: string) => {
      store.selectClip(null);
      setSelectedTransitionKey([trackId, clipAId, clipBId]);
      // Only create a transition record when the user actually changes the type
      // in the Inspector — not just from clicking the diamond.
    },
    [store.selectClip]
  );

  const selectedTransition = selectedTransitionKey
    ? (() => {
        const [trackId, clipAId, clipBId] = selectedTransitionKey;
        const track = store.state.tracks.find((t) => t.id === trackId);
        return (
          (track?.transitions ?? []).find(
            (t) => t.clipAId === clipAId && t.clipBId === clipBId
          ) ?? null
        );
      })()
    : null;

  // Clear transition selection when a clip is selected
  useEffect(() => {
    if (store.state.selectedClipId) {
      setSelectedTransitionKey(null);
    }
  }, [store.state.selectedClipId]);

  // Save whenever tracks or title change (skip when read-only)
  const tracksRef = useRef(store.state.tracks);
  useEffect(() => {
    if (tracksRef.current === store.state.tracks) return;
    tracksRef.current = store.state.tracks;
    if (!store.state.isReadOnly) {
      setIsDirty(true);
      scheduleSave({
        tracks: stripLocallyModifiedFromTracks(store.state.tracks),
        durationMs: store.state.durationMs,
        title: store.state.title,
      });
    }
  }, [store.state.tracks, store.state.title]);

  // Save when resolution changes (skip when read-only)
  const resolutionRef = useRef(store.state.resolution);
  useEffect(() => {
    if (resolutionRef.current === store.state.resolution) return;
    resolutionRef.current = store.state.resolution;
    if (!store.state.isReadOnly) {
      setIsDirty(true);
      scheduleSave({ resolution: store.state.resolution });
    }
  }, [store.state.resolution]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  // Use refs for volatile state values so the effect never needs to re-run
  // (and re-register the listener) on playback ticks.
  const kbStateRef = useRef(store.state);
  kbStateRef.current = store.state;
  const kbStoreRef = useRef(store);
  kbStoreRef.current = store;
  const kbRemoveClipRef = useRef(handleRemoveClip);
  kbRemoveClipRef.current = handleRemoveClip;
  const kbRippleDeleteRef = useRef(handleClipRippleDelete);
  kbRippleDeleteRef.current = handleClipRippleDelete;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const s = kbStateRef.current;
      const st = kbStoreRef.current;

      // Space — play/pause
      if (e.code === "Space") {
        e.preventDefault();
        st.setPlaying(!s.isPlaying);
      }

      // Arrow keys — step one frame
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        st.setCurrentTime(Math.max(0, s.currentTimeMs - 1000 / s.fps));
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        st.setCurrentTime(Math.min(s.durationMs, s.currentTimeMs + 1000 / s.fps));
      }

      // JKL scrubbing
      if (e.code === "KeyJ" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        // J: reverse playback at 1×; if already playing in reverse, increase speed
        const newRate = s.isPlaying && s.playbackRate < 0
          ? Math.max(s.playbackRate * 2, -8)
          : -1;
        st.setPlaybackRate(newRate);
        st.setPlaying(true);
      }
      if (e.code === "KeyK" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        // K: stop and reset rate to 1×
        st.setPlaying(false);
        st.setPlaybackRate(1);
      }
      if (e.code === "KeyL" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        // L: forward 1×; if already playing forward, increase speed
        const newRate = s.isPlaying && s.playbackRate > 0
          ? Math.min(s.playbackRate * 2, 8)
          : 1;
        st.setPlaybackRate(newRate);
        st.setPlaying(true);
      }

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        st.undo();
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        st.redo();
      }

      // Delete / Backspace — delete selected clip
      if (e.code === "Delete" || e.code === "Backspace") {
        if (s.selectedClipId) {
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+Delete — ripple delete
            kbRippleDeleteRef.current(s.selectedClipId);
          } else {
            kbRemoveClipRef.current(s.selectedClipId);
          }
        }
      }

      // Escape — deselect
      if (e.code === "Escape") {
        st.selectClip(null);
      }

      // S — split at playhead
      if (e.code === "KeyS" && !e.metaKey && !e.ctrlKey) {
        if (s.selectedClipId) {
          e.preventDefault();
          st.splitClip(s.selectedClipId, s.currentTimeMs);
        }
      }

      // Cmd/Ctrl+D — duplicate
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        if (s.selectedClipId) {
          e.preventDefault();
          st.duplicateClip(s.selectedClipId);
        }
      }

      // Cmd/Ctrl+C — copy selected clip
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        if (s.selectedClipId) {
          e.preventDefault();
          st.copyClip(s.selectedClipId);
        }
      }

      // Cmd/Ctrl+V — paste at current playhead
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        if (s.clipboardClip) {
          e.preventDefault();
          const ownerTrack = s.tracks.find((t) =>
            t.clips.some((c) => c.id === s.clipboardClip?.id)
          );
          const trackId =
            s.clipboardSourceTrackId ??
            ownerTrack?.id ??
            "video";
          st.pasteClip(trackId, s.currentTimeMs);
        }
      }

      // [ — set in-point: trim clip start to current playhead
      if (e.code === "BracketLeft" && !e.metaKey && !e.ctrlKey) {
        if (s.selectedClipId) {
          const clip = s.tracks.flatMap((t) => t.clips).find((c) => c.id === s.selectedClipId);
          if (
            clip &&
            s.currentTimeMs > clip.startMs &&
            s.currentTimeMs < clip.startMs + clip.durationMs
          ) {
            e.preventDefault();
            const delta = s.currentTimeMs - clip.startMs;
            st.updateClip(clip.id, {
              startMs: s.currentTimeMs,
              trimStartMs: clip.trimStartMs + delta,
              durationMs: clip.durationMs - delta,
            });
          }
        }
      }

      // ] — set out-point: trim clip end to current playhead
      if (e.code === "BracketRight" && !e.metaKey && !e.ctrlKey) {
        if (s.selectedClipId) {
          const clip = s.tracks.flatMap((t) => t.clips).find((c) => c.id === s.selectedClipId);
          if (
            clip &&
            s.currentTimeMs > clip.startMs &&
            s.currentTimeMs < clip.startMs + clip.durationMs
          ) {
            e.preventDefault();
            st.updateClip(clip.id, {
              durationMs: s.currentTimeMs - clip.startMs,
            });
          }
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // empty deps — handler reads live values via refs

  const { state } = store;
  const timecode = formatHHMMSSFF(state.currentTimeMs, state.fps);

  const jumpToStart = () => {
    store.setCurrentTime(0);
    store.setPlaying(false);
  };
  const jumpToEnd = () => {
    store.setCurrentTime(state.durationMs);
    store.setPlaying(false);
  };
  const rewind = () =>
    store.setCurrentTime(Math.max(0, state.currentTimeMs - 5000));
  const fastForward = () =>
    store.setCurrentTime(
      Math.min(state.durationMs, state.currentTimeMs + 5000)
    );

  const zoomIn = () => store.setZoom(state.zoom * 1.25);
  const zoomOut = () => store.setZoom(state.zoom / 1.25);
  const zoomFit = () => {
    const containerW = timelineContainerRef.current?.clientWidth ?? 800;
    const newZoom =
      state.durationMs > 0 ? (containerW / state.durationMs) * 1000 : 40;
    store.setZoom(newZoom);
  };

  const editorPublishStateRef = useRef({
    tracks: state.tracks,
    durationMs: state.durationMs,
    title: state.title,
    resolution: state.resolution,
  });
  editorPublishStateRef.current = {
    tracks: state.tracks,
    durationMs: state.durationMs,
    title: state.title,
    resolution: state.resolution,
  };

  // Periodic heartbeat save — fires every 30 s regardless of debounce activity
  useEffect(() => {
    intervalTimerRef.current = setInterval(() => {
      if (!state.isReadOnly && !isSavingPatchRef.current) {
        const snap = editorPublishStateRef.current;
        void flushSave({
          tracks: stripLocallyModifiedFromTracks(snap.tracks),
          durationMs: snap.durationMs,
          title: snap.title,
          resolution: snap.resolution,
        });
      }
    }, EDITOR_AUTOSAVE_INTERVAL_MS);
    return () => {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
    };
  }, [flushSave]);

  const handleConfirmPublish = useCallback(async () => {
    setPublishDialogOpen(false);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const snap = editorPublishStateRef.current;
    try {
      await flushSave({
        tracks: stripLocallyModifiedFromTracks(snap.tracks),
        durationMs: snap.durationMs,
        title: snap.title,
        resolution: snap.resolution,
      });
      await runPublish();
    } catch {
      // User can open Publish again if save or publish failed.
    }
  }, [flushSave, runPublish]);

  const handleBack = useCallback(async () => {
    if (!state.isReadOnly && saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      const snap = editorPublishStateRef.current;
      try {
        await flushSave({
          tracks: stripLocallyModifiedFromTracks(snap.tracks),
          durationMs: snap.durationMs,
          title: snap.title,
          resolution: snap.resolution,
        });
      } catch {
        // proceed even if save fails
      }
    }
    onBack();
  }, [state.isReadOnly, flushSave, onBack]);

  return (
    <AssetUrlMapContext.Provider value={assetUrlMap}>
      <div
        className="flex flex-col bg-studio-bg overflow-hidden min-w-0 w-full"
        style={{ height: "100%" }}
      >
        {/* ── Toolbar (54px) ──────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-0 px-4 border-b border-overlay-sm bg-studio-surface shrink-0"
          style={{ height: 54 }}
        >
          <button
            onClick={handleBack}
            title={t("editor_back")}
            className="transport-btn mr-2"
          >
            <ArrowLeft size={15} />
          </button>

          <input
            type="text"
            value={state.title}
            onChange={(e) => store.setTitle(e.target.value)}
            readOnly={state.isReadOnly}
            className="bg-transparent border-0 border-b border-overlay-md text-sm text-dim-1 min-w-[160px] outline-none focus:border-studio-accent transition-colors px-1 read-only:border-transparent read-only:cursor-default"
          />

          <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />

          <button
            onClick={store.undo}
            disabled={state.past.length === 0}
            title={t("editor_transport_undo")}
            className="transport-btn disabled:opacity-30"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={store.redo}
            disabled={state.future.length === 0}
            title={t("editor_transport_redo")}
            className="transport-btn disabled:opacity-30"
          >
            <Redo2 size={14} />
          </button>

          <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />

          <div className="flex items-center gap-0.5">
            <button
              onClick={jumpToStart}
              title={t("editor_transport_jump_start")}
              className="transport-btn"
            >
              <SkipBack size={14} />
            </button>
            <button
              onClick={rewind}
              title={t("editor_transport_rewind")}
              className="transport-btn"
            >
              <Rewind size={14} />
            </button>
            <button
              onClick={() => store.setPlaying(!state.isPlaying)}
              title={
                state.isPlaying
                  ? t("editor_transport_pause")
                  : t("editor_transport_play")
              }
              className="transport-btn text-studio-accent"
            >
              {state.isPlaying ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button
              onClick={fastForward}
              title={t("editor_transport_forward")}
              className="transport-btn"
            >
              <FastForward size={14} />
            </button>
            <button
              onClick={jumpToEnd}
              title={t("editor_transport_jump_end")}
              className="transport-btn"
            >
              <SkipForward size={14} />
            </button>
          </div>

          <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />
          {timecodeEditing ? (
            <input
              autoFocus
              type="text"
              value={timecodeInput}
              onChange={(e) => setTimecodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const ms = parseTimecode(timecodeInput, state.fps);
                  if (ms !== null) {
                    store.setCurrentTime(
                      Math.max(0, Math.min(state.durationMs, ms))
                    );
                  }
                  setTimecodeEditing(false);
                }
                if (e.key === "Escape") {
                  setTimecodeEditing(false);
                }
              }}
              onBlur={() => setTimecodeEditing(false)}
              className="font-mono text-sm text-dim-1 min-w-[120px] text-center tabular-nums bg-overlay-sm border border-studio-accent rounded px-1 outline-none"
            />
          ) : (
            <button
              onClick={() => {
                setTimecodeInput(timecode);
                setTimecodeEditing(true);
              }}
              title={t("editor_transport_timecode_hint")}
              className="font-mono text-sm text-dim-1 min-w-[120px] text-center select-none tabular-nums bg-transparent border-0 cursor-text hover:bg-overlay-sm rounded px-1 transition-colors"
            >
              {timecode}
            </button>
          )}

          <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />
          <button
            onClick={zoomOut}
            title={t("editor_transport_zoom_out")}
            className="transport-btn"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-dim-3 min-w-[48px] text-center select-none">
            {Math.round(state.zoom)}px/s
          </span>
          <button
            onClick={zoomIn}
            title={t("editor_transport_zoom_in")}
            className="transport-btn"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={zoomFit}
            className={cn(
              "text-xs text-dim-3 hover:text-dim-1 bg-transparent border-0 cursor-pointer px-1.5",
              "h-7 rounded transition-colors hover:bg-overlay-sm"
            )}
          >
            {t("editor_transport_zoom_fit")}
          </button>

          <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />

          {/* Resolution picker */}
          <ResolutionPicker
            resolution={state.resolution}
            onChange={store.setResolution}
          />

          <div className="flex-1" />

          {/* Save status indicator */}
          {!state.isReadOnly && (
            <div className="flex items-center gap-1.5 mr-3 text-xs min-w-[110px] justify-end">
              {isSavingPatch ? (
                <span className="flex items-center gap-1 text-dim-3">
                  <Loader2 size={11} className="animate-spin" />
                  {t("editor_saving")}
                </span>
              ) : isDirty ? (
                <span className="text-amber-400">{t("editor_unsaved_changes")}</span>
              ) : lastSavedAt ? (
                <span className="flex items-center gap-1 text-dim-3">
                  <Check size={11} className="text-green-500" />
                  {t("editor_saved")}
                </span>
              ) : null}
            </div>
          )}

          {state.isReadOnly ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-green-500/15 text-green-400 uppercase tracking-wide">
                <Lock size={11} />
                {t("editor_status_published")}
              </span>
              <button
                onClick={() => createNewDraft()}
                disabled={isCreatingDraft}
                className="flex items-center gap-1.5 bg-overlay-sm border border-overlay-md text-dim-1 text-sm font-semibold px-4 py-1.5 rounded-lg border-0 cursor-pointer hover:bg-overlay-md transition-colors disabled:opacity-60"
              >
                <FilePlus size={14} />
                {t("editor_new_draft")}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {project.generatedContentId != null && (
                <div className="relative">
                  <button
                    onClick={() => setShowAiMenu((v) => !v)}
                    disabled={isAiAssembling}
                    className="flex items-center gap-1.5 bg-overlay-sm border border-overlay-md text-dim-1 text-sm font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-overlay-md transition-colors disabled:opacity-60"
                  >
                    <Sparkles size={13} />
                    {t("editor_ai_assemble")}
                    <ChevronDown size={11} />
                  </button>
                  {showAiMenu && (
                    <div
                      className="absolute right-0 top-full mt-1 z-50 flex flex-col bg-studio-surface border border-overlay-md rounded-lg shadow-lg overflow-hidden min-w-[168px]"
                      onMouseLeave={() => setShowAiMenu(false)}
                    >
                      {[
                        {
                          platform: "tiktok",
                          label: t("editor_ai_assemble_tiktok"),
                        },
                        {
                          platform: "youtube-shorts",
                          label: t("editor_ai_assemble_youtube"),
                        },
                        {
                          platform: "instagram",
                          label: t("editor_ai_assemble_instagram"),
                        },
                      ].map(({ platform, label }) => (
                        <button
                          key={platform}
                          onClick={() => {
                            setShowAiMenu(false);
                            aiAssemble(platform);
                          }}
                          className="text-left px-3 py-2 text-xs text-dim-1 hover:bg-overlay-sm cursor-pointer border-0 bg-transparent transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setShowExport(true)}
                className="flex items-center gap-1.5 bg-overlay-sm border border-overlay-md text-dim-1 text-sm font-semibold px-4 py-1.5 rounded-lg cursor-pointer hover:bg-overlay-md transition-colors"
              >
                <Upload size={14} />
                {t("editor_export_button")}
              </button>
              <button
                type="button"
                onClick={() => setPublishDialogOpen(true)}
                disabled={isPublishing || isSavingPatch}
                className="flex items-center gap-1.5 bg-gradient-to-br from-studio-accent to-studio-purple text-white text-sm font-semibold px-4 py-1.5 rounded-lg border-0 cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {t("editor_publish_button")}
              </button>
            </div>
          )}
        </div>

        {/* ── Workspace (flex:1) ─────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          <MediaPanel
            generatedContentId={project.generatedContentId}
            currentTimeMs={state.currentTimeMs}
            onAddClip={handleAddClip}
            selectedClipId={state.selectedClipId}
            onUpdateClip={handleUpdateClip}
            onEffectPreview={(patch) =>
              setEffectPreview(
                patch && state.selectedClipId
                  ? { clipId: state.selectedClipId, patch }
                  : null
              )
            }
            videoTrack={state.tracks.find((t) => t.type === "video")}
            onReorder={store.reorderShots}
            onAddCaptionClip={store.addCaptionClip}
            readOnly={state.isReadOnly}
          />

          <PreviewArea
            tracks={state.tracks}
            currentTimeMs={state.currentTimeMs}
            isPlaying={state.isPlaying}
            durationMs={state.durationMs}
            fps={state.fps}
            resolution={state.resolution}
            effectPreviewOverride={effectPreview}
          />

          <Inspector
            tracks={state.tracks}
            selectedClipId={state.selectedClipId}
            onUpdateClip={handleUpdateClip}
            selectedTransition={selectedTransition}
            onSetTransition={store.setTransition}
            onRemoveTransition={store.removeTransition}
          />
        </div>

        {/* ── Timeline (296px) ──────────────────────────────────────────── */}
        <div style={{ height: 296 }} className="flex flex-col shrink-0">
          <div
            className="flex items-center justify-between px-3 py-1 border-t border-overlay-sm bg-studio-surface shrink-0"
            style={{ height: 32 }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-dim-1">
                {t("editor_timeline_label")}
              </span>
              <button
                type="button"
                title={t("editor_sync_timeline")}
                onClick={() =>
                  void queryClient.invalidateQueries({
                    queryKey: queryKeys.api.editorProject(project.id),
                  })
                }
                className="p-1 rounded hover:bg-overlay-sm text-dim-3 hover:text-dim-1"
              >
                <RefreshCw size={12} />
              </button>
            </div>
            <span className="text-xs italic text-dim-3">
              {Math.round(state.zoom)} px/s ·{" "}
              {(state.durationMs / 60000).toFixed(1)} min
            </span>
          </div>

          <div ref={timelineContainerRef} className="flex-1 overflow-hidden">
            <Timeline
              tracks={state.tracks}
              durationMs={state.durationMs}
              currentTimeMs={state.currentTimeMs}
              zoom={state.zoom}
              selectedClipId={state.selectedClipId}
              hasClipboard={!!state.clipboardClip}
              onSeek={store.setCurrentTime}
              onSelectClip={store.selectClip}
              onUpdateClip={handleUpdateClip}
              onAddClip={handleAddClip}
              onToggleMute={store.toggleTrackMute}
              onToggleLock={store.toggleTrackLock}
              onDeleteAllClipsInTrack={handleDeleteAllClipsInTrack}
              selectedTransitionId={
                selectedTransitionKey
                  ? `${selectedTransitionKey[1]}-${selectedTransitionKey[2]}`
                  : null
              }
              onSelectTransition={handleSelectTransition}
              onRemoveTransition={store.removeTransition}
              onClipSplit={handleClipSplit}
              onClipDuplicate={handleClipDuplicate}
              onClipCopy={handleClipCopy}
              onClipPaste={handleClipPaste}
              onClipToggleEnabled={handleClipToggleEnabled}
              onClipRippleDelete={handleClipRippleDelete}
              onClipDelete={handleRemoveClip}
              onClipSetSpeed={handleClipSetSpeed}
              onAddVideoTrack={store.addVideoTrack}
              onRemoveTrack={store.removeTrack}
              scrollRef={timelineScrollRef}
            />
          </div>
        </div>

        {showExport && state.editProjectId && (
          <ExportModal
            projectId={state.editProjectId}
            onClose={() => setShowExport(false)}
          />
        )}

        <AlertDialog
          open={!!scriptResetPending}
          onOpenChange={(open) => {
            if (!open && scriptResetPending) {
              lastHandledServerUpdatedAt.current =
                scriptResetPending.updatedAt;
              setScriptResetPending(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("editor_script_iteration_title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("editor_script_iteration_body")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!scriptResetPending) return;
                  lastHandledServerUpdatedAt.current =
                    scriptResetPending.updatedAt;
                  store.loadProject(scriptResetPending);
                  setScriptResetPending(null);
                }}
              >
                {t("editor_script_iteration_confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={publishDialogOpen}
          onOpenChange={setPublishDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("editor_publish_confirm_title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("editor_publish_confirm")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
              <AlertDialogAction
                disabled={isPublishing || isSavingPatch}
                onClick={() => void handleConfirmPublish()}
              >
                {t("editor_publish_confirm_action")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AssetUrlMapContext.Provider>
  );
}
