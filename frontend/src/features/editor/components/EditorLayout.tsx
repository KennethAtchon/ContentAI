import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import { useEditorReducer } from "../hooks/useEditorStore";
import { usePlayback } from "../hooks/usePlayback";
import { Timeline } from "./Timeline";
import { PreviewArea } from "./PreviewArea";
import { Inspector } from "./Inspector";
import { MediaPanel } from "./MediaPanel";
import { ExportModal } from "./ExportModal";
import type { EditProject, Clip } from "../types/editor";

interface Props {
  project: EditProject;
  onBack: () => void;
}

function formatHHMMSSFF(ms: number, fps: number): string {
  const totalFrames = Math.floor((ms / 1000) * fps);
  const ff = totalFrames % fps;
  const totalSec = Math.floor(totalFrames / fps);
  const ss = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const mm = totalMin % 60;
  const hh = Math.floor(totalMin / 60);
  return [
    String(hh).padStart(2, "0"),
    String(mm).padStart(2, "0"),
    String(ss).padStart(2, "0"),
    String(ff).padStart(2, "0"),
  ].join(":");
}

export function EditorLayout({ project, onBack }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const store = useEditorReducer();
  const [showExport, setShowExport] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load project on mount
  useEffect(() => {
    store.loadProject(project);
  }, [project.id]);

  // Auto-save mutation
  const { mutate: save } = useMutation({
    mutationFn: (patch: object) =>
      authenticatedFetchJson(`/api/editor/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.api.editorProjects(),
      });
    },
  });

  // Schedule debounced save whenever tracks change
  const scheduleSave = useCallback(
    (patch: object) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => save(patch), 2000);
    },
    [save]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Playback engine
  const onTick = useCallback(
    (ms: number) => store.setCurrentTime(ms),
    [store.setCurrentTime]
  );
  const onEnd = useCallback(() => store.setPlaying(false), [store.setPlaying]);
  usePlayback({
    isPlaying: store.state.isPlaying,
    currentTimeMs: store.state.currentTimeMs,
    durationMs: store.state.durationMs,
    onTick,
    onEnd,
  });

  // Track + clip actions — trigger auto-save
  const handleAddClip = useCallback(
    (trackId: string, clip: Clip) => {
      store.addClip(trackId, clip);
      // Save is triggered after state update via effect below
    },
    [store.addClip]
  );

  const handleUpdateClip = useCallback(
    (clipId: string, patch: Partial<Clip>) => {
      store.updateClip(clipId, patch);
    },
    [store.updateClip]
  );

  const handleRemoveClip = useCallback(
    (clipId: string) => {
      store.removeClip(clipId);
    },
    [store.removeClip]
  );

  // Save whenever tracks change
  const tracksRef = useRef(store.state.tracks);
  useEffect(() => {
    if (tracksRef.current === store.state.tracks) return; // no-op on first mount
    tracksRef.current = store.state.tracks;
    scheduleSave({
      tracks: store.state.tracks,
      durationMs: store.state.durationMs,
      title: store.state.title,
    });
  }, [store.state.tracks, store.state.title]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.code === "Space") {
        e.preventDefault();
        store.setPlaying(!store.state.isPlaying);
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        store.setCurrentTime(
          store.state.currentTimeMs - 1000 / store.state.fps
        );
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        store.setCurrentTime(
          store.state.currentTimeMs + 1000 / store.state.fps
        );
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        store.redo();
      }
      if (e.code === "Delete" || e.code === "Backspace") {
        if (store.state.selectedClipId) {
          e.preventDefault();
          handleRemoveClip(store.state.selectedClipId);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store, handleRemoveClip]);

  const { state } = store;
  const timecode = formatHHMMSSFF(state.currentTimeMs, state.fps);

  // Transport helpers
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

  // Zoom
  const zoomIn = () => store.setZoom(state.zoom * 1.25);
  const zoomOut = () => store.setZoom(state.zoom / 1.25);
  const zoomFit = () => {
    const containerW = 800; // approximate
    const newZoom =
      state.durationMs > 0 ? (containerW / state.durationMs) * 1000 : 40;
    store.setZoom(newZoom);
  };

  return (
    <div
      className="flex flex-col bg-studio-bg overflow-hidden"
      style={{ height: "100%", minWidth: 1280 }}
    >
      {/* ── Toolbar (54px) ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-0 px-4 border-b border-overlay-sm bg-studio-surface shrink-0"
        style={{ height: 54 }}
      >
        {/* Back */}
        <button
          onClick={onBack}
          className="text-dim-3 hover:text-dim-1 bg-transparent border-0 cursor-pointer text-sm mr-2"
        >
          ←
        </button>

        {/* Project title */}
        <input
          type="text"
          value={state.title}
          onChange={(e) => store.setTitle(e.target.value)}
          className="bg-transparent border-0 border-b border-overlay-md text-sm text-dim-1 min-w-[160px] outline-none focus:border-studio-accent transition-colors px-1"
        />

        <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />

        {/* Undo / Redo */}
        <button
          onClick={store.undo}
          disabled={state.past.length === 0}
          title="Undo (Cmd+Z)"
          className="text-dim-3 hover:text-dim-1 disabled:opacity-30 bg-transparent border-0 cursor-pointer text-sm px-1.5"
        >
          ↩
        </button>
        <button
          onClick={store.redo}
          disabled={state.future.length === 0}
          title="Redo (Cmd+Shift+Z)"
          className="text-dim-3 hover:text-dim-1 disabled:opacity-30 bg-transparent border-0 cursor-pointer text-sm px-1.5"
        >
          ↪
        </button>

        <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />

        {/* Transport controls */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={jumpToStart}
            title="Jump to start"
            className="transport-btn"
          >
            ⏮
          </button>
          <button onClick={rewind} title="Rewind 5s" className="transport-btn">
            ⏪
          </button>
          <button
            onClick={() => store.setPlaying(!state.isPlaying)}
            title={state.isPlaying ? "Pause (Space)" : "Play (Space)"}
            className="transport-btn text-studio-accent font-bold"
          >
            {state.isPlaying ? "⏸" : "▶"}
          </button>
          <button
            onClick={fastForward}
            title="Forward 5s"
            className="transport-btn"
          >
            ⏩
          </button>
          <button
            onClick={jumpToEnd}
            title="Jump to end"
            className="transport-btn"
          >
            ⏭
          </button>
        </div>

        {/* Timecode */}
        <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />
        <span className="font-mono italic text-sm text-dim-1 min-w-[120px] text-center select-none">
          {timecode}
        </span>

        {/* Zoom */}
        <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />
        <button onClick={zoomOut} className="transport-btn">
          −
        </button>
        <span className="text-xs text-dim-3 min-w-[48px] text-center select-none">
          {Math.round(state.zoom)}px/s
        </span>
        <button onClick={zoomIn} className="transport-btn">
          +
        </button>
        <button
          onClick={zoomFit}
          className="text-xs text-dim-3 hover:text-dim-1 bg-transparent border-0 cursor-pointer px-1.5"
        >
          Fit
        </button>

        <div className="flex-1" />

        {/* Export button */}
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-1.5 bg-gradient-to-br from-studio-accent to-studio-purple text-white text-sm font-semibold px-4 py-1.5 rounded-lg border-0 cursor-pointer hover:opacity-90 transition-opacity"
        >
          ↑ {t("editor_export_button")}
        </button>
      </div>

      {/* ── Workspace (flex:1) ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Media Panel (220px) */}
        <MediaPanel
          generatedContentId={project.generatedContentId}
          currentTimeMs={state.currentTimeMs}
          onAddClip={handleAddClip}
        />

        {/* Preview Area (flex:1) */}
        <PreviewArea
          tracks={state.tracks}
          currentTimeMs={state.currentTimeMs}
          isPlaying={state.isPlaying}
          durationMs={state.durationMs}
          fps={state.fps}
          resolution={state.resolution}
        />

        {/* Inspector (244px) */}
        <Inspector
          tracks={state.tracks}
          selectedClipId={state.selectedClipId}
          onUpdateClip={handleUpdateClip}
        />
      </div>

      {/* ── Timeline (296px) ────────────────────────────────────────────── */}
      <div style={{ height: 296 }} className="flex flex-col shrink-0">
        {/* Timeline toolbar */}
        <div
          className="flex items-center justify-between px-3 py-1 border-t border-overlay-sm bg-studio-surface shrink-0"
          style={{ height: 32 }}
        >
          <span className="text-xs font-bold text-dim-1">Timeline</span>
          <span className="text-xs italic text-dim-3">
            {Math.round(state.zoom)} px/s ·{" "}
            {(state.durationMs / 60000).toFixed(1)} min
          </span>
        </div>

        {/* Track area */}
        <div className="flex-1 overflow-hidden">
          <Timeline
            tracks={state.tracks}
            durationMs={state.durationMs}
            currentTimeMs={state.currentTimeMs}
            zoom={state.zoom}
            selectedClipId={state.selectedClipId}
            onSeek={store.setCurrentTime}
            onSelectClip={store.selectClip}
            onUpdateClip={handleUpdateClip}
            onToggleMute={store.toggleTrackMute}
            onToggleLock={store.toggleTrackLock}
          />
        </div>
      </div>

      {/* Export modal */}
      {showExport && state.editProjectId && (
        <ExportModal
          projectId={state.editProjectId}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
