import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Check,
  Loader2,
  Camera,
} from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { useMediaLibrary } from "@/features/media/hooks/use-media-library";
import type { MediaItem } from "@/features/media/types/media.types";
import { useEditorReducer } from "../hooks/useEditorStore";
import { useEditorAutosave } from "../hooks/useEditorAutosave";
import { useEditorKeyboard } from "../hooks/useEditorKeyboard";
import { useEditorProjectPoll } from "../hooks/useEditorProjectPoll";
import { useEditorLayoutMutations } from "../hooks/useEditorLayoutMutations";
import { usePlayback } from "../hooks/usePlayback";
import { useAssetSync } from "../hooks/useAssetSync";
import { Timeline } from "./Timeline";
import { PreviewArea } from "./PreviewArea";
import { Inspector } from "./Inspector";
import { MediaPanel } from "./MediaPanel";
import { ExportModal } from "./ExportModal";
import { ResolutionPicker } from "./ResolutionPicker";
import { AssetUrlMapContext } from "../contexts/asset-url-map-context";
import { EditorProvider } from "../context/EditorContext";
import type { EditProject, Clip, TrackType } from "../types/editor";
import type { TabKey } from "./MediaPanel";
import { hasCollision } from "../utils/clip-constraints";
import { toast } from "sonner";
import { formatHHMMSSFF, parseTimecode } from "../utils/timecode";
import { stripLocallyModifiedFromTracks } from "../utils/strip-local-editor-fields";
import { uploadProjectThumbnail } from "../services/editor-api";
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

const RESOLUTION_LABEL_MAP: Record<string, string> = {
  "720x1280": "9:16 SD (720p)",
  "1080x1920": "9:16 HD (1080p)",
  "2160x3840": "9:16 4K",
  "1920x1080": "16:9 Landscape",
  "1080x1080": "1:1 Square",
};

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
  const [timecodeEditing, setTimecodeEditing] = useState(false);
  const [timecodeInput, setTimecodeInput] = useState("");
  const [effectPreview, setEffectPreview] = useState<{ clipId: string; patch: Partial<Clip> } | null>(null);
  /** Ephemeral UI selection for transition inspector; not serialized in editor state. */
  const [selectedTransitionKey, setSelectedTransitionKey] = useState<
    [string, string, string] | null
  >(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [isCapturingThumbnail, setIsCapturingThumbnail] = useState(false);
  const thumbnailCapturedRef = useRef(false);

  const {
    scriptResetPending,
    onScriptIterationDialogOpenChange,
    confirmScriptIteration,
  } = useEditorProjectPoll({ project, store });

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

  // ── Thumbnail capture ───────────────────────────────────────────────────────

  function captureVideoFrame(url: string, timeMs: number): Promise<Blob | null> {
    return new Promise<Blob | null>((resolve) => {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.preload = "metadata";
      const cleanup = () => { video.src = ""; };
      video.addEventListener("error", () => { cleanup(); resolve(null); }, { once: true });
      video.addEventListener("seeked", () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 568;
          const ctx = canvas.getContext("2d");
          if (!ctx) { cleanup(); resolve(null); return; }
          ctx.drawImage(video, 0, 0);
          canvas.toBlob((blob) => { cleanup(); resolve(blob); }, "image/jpeg", 0.85);
        } catch {
          cleanup();
          resolve(null);
        }
      }, { once: true });
      video.addEventListener("loadedmetadata", () => {
        video.currentTime = Math.max(0, timeMs / 1000);
      }, { once: true });
      video.src = url;
    });
  }

  const captureThumbnail = useCallback(
    async (atMs?: number) => {
      const videoTrack = store.state.tracks.find((t) => t.type === "video");
      const currentMs = atMs ?? store.state.currentTimeMs;
      // Find the clip active at currentMs, or fall back to the first real video clip
      const activeClip =
        videoTrack?.clips.find(
          (c) => !c.isPlaceholder && c.assetId && c.startMs <= currentMs && currentMs < c.startMs + c.durationMs
        ) ?? videoTrack?.clips.find((c) => !c.isPlaceholder && c.assetId);
      const url = activeClip?.assetId ? assetUrlMap.get(activeClip.assetId) : undefined;
      if (!url) return;

      const seekMs = activeClip
        ? activeClip.trimStartMs + Math.max(0, currentMs - activeClip.startMs)
        : 0;

      setIsCapturingThumbnail(true);
      try {
        const blob = await captureVideoFrame(url, seekMs);
        if (!blob) return;
        await uploadProjectThumbnail(project.id, blob);
        toast.success(t("editor_thumbnail_saved"));
      } catch {
        toast.error(t("editor_thumbnail_failed"));
      } finally {
        setIsCapturingThumbnail(false);
      }
    },
    [store.state.tracks, store.state.currentTimeMs, assetUrlMap, project.id, t]
  );

  // Auto-generate thumbnail once on first editor open if the project has none
  useEffect(() => {
    if (thumbnailCapturedRef.current) return;
    if (project.thumbnailUrl) { thumbnailCapturedRef.current = true; return; }
    if (assetUrlMap.size === 0) return;
    const videoTrack = store.state.tracks.find((t) => t.type === "video");
    const firstClip = videoTrack?.clips.find((c) => !c.isPlaceholder && c.assetId);
    if (!firstClip?.assetId) return;
    thumbnailCapturedRef.current = true;
    void captureThumbnail(0);
  }, [assetUrlMap, store.state.tracks, project.thumbnailUrl, captureThumbnail]);

  const autosave = useEditorAutosave({
    projectId: project.id,
    isReadOnly: store.state.isReadOnly,
    tracks: store.state.tracks,
    durationMs: store.state.durationMs,
    title: store.state.title,
    resolution: store.state.resolution,
  });
  const {
    lastSavedAt,
    isDirty,
    isSavingPatch,
    flushSave,
    saveTimerRef,
    editorPublishStateRef,
  } = autosave;

  const [mediaActiveTab, setMediaActiveTab] = useState<TabKey>("media");
  const [pendingAdd, setPendingAdd] = useState<{ trackId: string; startMs: number } | null>(null);

  const {
    runPublish,
    isPublishing,
    createNewDraft,
    isCreatingDraft,
  } = useEditorLayoutMutations({
    project,
    store,
    queryClient,
    authenticatedFetchJson,
    onBack,
    flushSave,
  });

  const { syncAssets, isSyncing } = useAssetSync(project, (tracks, durationMs) => {
    store.loadProject({ ...project, tracks, durationMs });
  });

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
    (trackId: string, clip: Clip) => {
      const track = store.state.tracks.find((t) => t.id === trackId);
      if (track && hasCollision(track, clip.startMs, clip.durationMs)) {
        toast.error(t("editor_clip_collision"));
        setPendingAdd(null);
        return;
      }
      store.addClipAutoPromote(trackId, clip);
    },
    [store.addClipAutoPromote, store.state.tracks, t]
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

  const handleFocusMediaForTrack = useCallback(
    (trackType: TrackType, trackId: string, startMs: number) => {
      setPendingAdd({ trackId, startMs });
      setMediaActiveTab(
        trackType === "audio" || trackType === "music" ? "audio" : "media"
      );
    },
    []
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

  useEditorKeyboard({
    store,
    flushSave,
    editorPublishStateRef,
    removeClip: store.removeClip,
    rippleDeleteClip: store.rippleDeleteClip,
  });

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
    <EditorProvider store={store}>
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
            onChange={(newResolution) => {
              store.setResolution(newResolution);
              const label = RESOLUTION_LABEL_MAP[newResolution] ?? newResolution;
              toast.success(t("editor_resolution_changed", { resolution: label }));
            }}
          />

          {!state.isReadOnly && (
            <>
              <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />
              <button
                onClick={() => void captureThumbnail()}
                disabled={isCapturingThumbnail}
                title={t("editor_set_thumbnail")}
                className="transport-btn disabled:opacity-40"
              >
                {isCapturingThumbnail ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Camera size={14} />
                )}
              </button>
            </>
          )}

          <div className="flex-1" />

          {/* Save status indicator */}
          {!state.isReadOnly && (
            <div className="flex items-center gap-1.5 mr-3 text-xs">
              {isSavingPatch ? (
                <span className="flex items-center gap-1 text-dim-3">
                  <Loader2 size={11} className="animate-spin" />
                  {t("editor_saving")}
                </span>
              ) : isDirty ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400">{t("editor_unsaved_changes")}</span>
                  <button
                    onClick={() => {
                      const snap = editorPublishStateRef.current;
                      void flushSave({
                        tracks: stripLocallyModifiedFromTracks(snap.tracks),
                        durationMs: snap.durationMs,
                        title: snap.title,
                        resolution: snap.resolution,
                      });
                    }}
                    className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/30 text-amber-400 cursor-pointer hover:bg-amber-400/25 transition-colors"
                  >
                    {t("editor_save_now")}
                  </button>
                </div>
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
            mergedAssetIds={project.mergedAssetIds ?? []}
            currentTimeMs={state.currentTimeMs}
            onAddClip={handleAddClip}
            readOnly={state.isReadOnly}
            activeTab={mediaActiveTab}
            onTabChange={setMediaActiveTab}
            pendingAdd={pendingAdd}
            onClearPendingAdd={() => setPendingAdd(null)}
            onSyncAssets={syncAssets}
            isSyncing={isSyncing}
            tracks={state.tracks}
          />

          <PreviewArea
            tracks={state.tracks}
            currentTimeMs={state.currentTimeMs}
            isPlaying={state.isPlaying}
            playbackRate={state.playbackRate}
            durationMs={state.durationMs}
            fps={state.fps}
            resolution={state.resolution}
            effectPreviewOverride={effectPreview}
          />

          <Inspector
            tracks={state.tracks}
            selectedClipId={state.selectedClipId}
            onUpdateClip={handleUpdateClip}
            onEffectPreview={(patch) =>
              setEffectPreview(
                patch && state.selectedClipId
                  ? { clipId: state.selectedClipId, patch }
                  : null
              )
            }
            onAddCaptionClip={store.addCaptionClip}
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
              onRenameTrack={store.renameTrack}
              onReorderTracks={store.reorderTracks}
              scrollRef={timelineScrollRef}
              onFocusMediaForTrack={handleFocusMediaForTrack}
            />
          </div>
        </div>

        {showExport && state.editProjectId && (
          <ExportModal
            projectId={state.editProjectId}
            initialResolution={state.resolution}
            initialFps={state.fps as 24 | 30 | 60}
            onClose={() => setShowExport(false)}
          />
        )}

        <AlertDialog
          open={!!scriptResetPending}
          onOpenChange={onScriptIterationDialogOpenChange}
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
              <AlertDialogAction onClick={() => confirmScriptIteration()}>
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
    </EditorProvider>
  );
}
