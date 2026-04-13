import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  Upload,
  Lock,
  FilePlus,
  Check,
  Loader2,
  Camera,
} from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { toast } from "sonner";
import { ResolutionPicker } from "../dialogs/ResolutionPicker";
import { formatHHMMSSFF, parseTimecode } from "../../utils/timecode";

const RESOLUTION_LABEL_MAP: Record<string, string> = {
  "720x1280": "9:16 SD (720p)",
  "1080x1920": "9:16 HD (1080p)",
  "2160x3840": "9:16 4K",
  "1920x1080": "16:9 Landscape",
  "1080x1080": "1:1 Square",
};

interface EditorToolbarProps {
  title: string;
  isReadOnly: boolean;
  pastLength: number;
  futureLength: number;
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  fps: number;
  zoom: number;
  resolution: string;
  onFpsChange: (fps: 24 | 25 | 30 | 60) => void;
  isDirty: boolean;
  isSavingPatch: boolean;
  lastSavedAt: unknown;
  isPublishing: boolean;
  isCreatingDraft: boolean;
  isCapturingThumbnail: boolean;
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onJumpToStart: () => void;
  onRewind: () => void;
  onTogglePlaying: () => void;
  onFastForward: () => void;
  onJumpToEnd: () => void;
  onSetCurrentTime: (ms: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onResolutionChange: (resolution: string) => void;
  onCaptureThumbnail: () => void;
  onOpenExport: () => void;
  onOpenPublishDialog: () => void;
  onCreateNewDraft: () => void;
  onSaveNow: () => void;
}

export function EditorToolbar({
  title,
  isReadOnly,
  pastLength,
  futureLength,
  isPlaying,
  currentTimeMs,
  durationMs,
  fps,
  zoom,
  resolution,
  onFpsChange,
  isDirty,
  isSavingPatch,
  lastSavedAt,
  isPublishing,
  isCreatingDraft,
  isCapturingThumbnail,
  onBack,
  onTitleChange,
  onUndo,
  onRedo,
  onJumpToStart,
  onRewind,
  onTogglePlaying,
  onFastForward,
  onJumpToEnd,
  onSetCurrentTime,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onResolutionChange,
  onCaptureThumbnail,
  onOpenExport,
  onOpenPublishDialog,
  onCreateNewDraft,
  onSaveNow,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  const [timecodeEditing, setTimecodeEditing] = useState(false);
  const [timecodeInput, setTimecodeInput] = useState("");
  const timecode = formatHHMMSSFF(currentTimeMs, fps);

  return (
    <div
      className="flex items-center gap-0 px-4 border-b border-overlay-sm bg-studio-surface shrink-0"
      style={{ height: 54 }}
    >
      <button
        onClick={onBack}
        title={t("editor_back")}
        className="transport-btn mr-2"
      >
        <ArrowLeft size={15} />
      </button>

      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        readOnly={isReadOnly}
        className="bg-transparent border-0 border-b border-overlay-md text-sm text-dim-1 min-w-[160px] outline-none focus:border-studio-accent transition-colors px-1 read-only:border-transparent read-only:cursor-default"
      />

      <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />

      <button
        onClick={onUndo}
        disabled={pastLength === 0}
        title={t("editor_transport_undo")}
        className="transport-btn disabled:opacity-30"
      >
        <Undo2 size={14} />
      </button>
      <button
        onClick={onRedo}
        disabled={futureLength === 0}
        title={t("editor_transport_redo")}
        className="transport-btn disabled:opacity-30"
      >
        <Redo2 size={14} />
      </button>

      <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />

      <div className="flex items-center gap-0.5">
        <button
          onClick={onJumpToStart}
          title={t("editor_transport_jump_start")}
          className="transport-btn"
        >
          <SkipBack size={14} />
        </button>
        <button
          onClick={onRewind}
          title={t("editor_transport_rewind")}
          className="transport-btn"
        >
          <Rewind size={14} />
        </button>
        <button
          onClick={onTogglePlaying}
          title={
            isPlaying ? t("editor_transport_pause") : t("editor_transport_play")
          }
          className="transport-btn text-studio-accent"
        >
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button
          onClick={onFastForward}
          title={t("editor_transport_forward")}
          className="transport-btn"
        >
          <FastForward size={14} />
        </button>
        <button
          onClick={onJumpToEnd}
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
              const ms = parseTimecode(timecodeInput, fps);
              if (ms !== null)
                onSetCurrentTime(Math.max(0, Math.min(durationMs, ms)));
              setTimecodeEditing(false);
            }
            if (e.key === "Escape") setTimecodeEditing(false);
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
        onClick={onZoomOut}
        title={t("editor_transport_zoom_out")}
        className="transport-btn"
      >
        <ZoomOut size={14} />
      </button>
      <span className="text-xs text-dim-3 min-w-[48px] text-center select-none">
        {Math.round(zoom)}px/s
      </span>
      <button
        onClick={onZoomIn}
        title={t("editor_transport_zoom_in")}
        className="transport-btn"
      >
        <ZoomIn size={14} />
      </button>
      <button
        onClick={onZoomFit}
        className={cn(
          "text-xs text-dim-3 hover:text-dim-1 bg-transparent border-0 cursor-pointer px-1.5",
          "h-7 rounded transition-colors hover:bg-overlay-sm"
        )}
      >
        {t("editor_transport_zoom_fit")}
      </button>

      <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />

      <ResolutionPicker
        resolution={resolution}
        onChange={(newResolution) => {
          onResolutionChange(newResolution);
          const label = RESOLUTION_LABEL_MAP[newResolution] ?? newResolution;
          toast.success(t("editor_resolution_changed", { resolution: label }));
        }}
      />

      <select
        value={String(fps)}
        onChange={(e) =>
          onFpsChange(Number(e.target.value) as 24 | 25 | 30 | 60)
        }
        className="ml-2 h-8 rounded border border-overlay-md bg-transparent px-2 text-xs text-dim-2 outline-none"
        title="Timeline FPS"
      >
        {[24, 25, 30, 60].map((value) => (
          <option
            key={value}
            value={value}
            className="bg-studio-surface text-dim-1"
          >
            {value} fps
          </option>
        ))}
      </select>

      {!isReadOnly && (
        <>
          <div className="w-px h-5 bg-overlay-md mx-3 shrink-0" />
          <button
            onClick={onCaptureThumbnail}
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

      {!isReadOnly && (
        <div className="flex items-center gap-1.5 mr-3 text-xs">
          {isSavingPatch ? (
            <span className="flex items-center gap-1 text-dim-3">
              <Loader2 size={11} className="animate-spin" />
              {t("editor_saving")}
            </span>
          ) : isDirty ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onSaveNow}
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

      {isReadOnly ? (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-full bg-green-500/15 text-green-400 uppercase tracking-wide">
            <Lock size={11} />
            {t("editor_status_published")}
          </span>
          <button
            onClick={onCreateNewDraft}
            disabled={isCreatingDraft}
            title={
              isCreatingDraft
                ? "Creating a new draft..."
                : t("editor_new_draft")
            }
            className="flex items-center gap-1.5 bg-overlay-sm border border-overlay-md text-dim-1 text-sm font-semibold px-4 py-1.5 rounded-lg border-0 cursor-pointer hover:bg-overlay-md transition-colors disabled:opacity-60"
          >
            <FilePlus size={14} />
            {t("editor_new_draft")}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 bg-overlay-sm border border-overlay-md text-dim-1 text-sm font-semibold px-4 py-1.5 rounded-lg cursor-pointer hover:bg-overlay-md transition-colors"
          >
            <Upload size={14} />
            {t("editor_export_button")}
          </button>
          <button
            type="button"
            onClick={onOpenPublishDialog}
            disabled={isPublishing || isSavingPatch}
            title={
              isPublishing
                ? "Publishing..."
                : isSavingPatch
                  ? "Wait for autosave to finish before publishing."
                  : t("editor_publish_button")
            }
            className="flex items-center gap-1.5 bg-gradient-to-br from-studio-accent to-studio-purple text-white text-sm font-semibold px-4 py-1.5 rounded-lg border-0 cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {t("editor_publish_button")}
          </button>
        </div>
      )}
    </div>
  );
}
