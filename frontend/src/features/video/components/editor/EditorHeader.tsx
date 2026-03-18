import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Undo2, Redo2 } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import type {
  CompositionMode,
  CompositionRecord,
  SaveState,
} from "../../types/composition.types";
import type { HistoryViewEntry } from "../../hooks/use-editor-history";
import { SaveStatusBadge } from "./SaveStatusBadge";

export type EditorHeaderProps = {
  generatedContentId: number;
  composition: CompositionRecord;
  saveState: SaveState;
  saveError: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  lastActionLabel: string | null;
  nextUndoLabel: string | null;
  nextRedoLabel: string | null;
  historyTrail: HistoryViewEntry[];
  editMode: CompositionMode;
  onEditModeChange: (mode: CompositionMode) => void;
};

export function EditorHeader({
  generatedContentId,
  composition,
  saveState,
  saveError,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  nextUndoLabel,
  nextRedoLabel,
  editMode,
  onEditModeChange,
}: EditorHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="h-full flex items-center gap-1.5 px-3 border-b border-white/[0.06] bg-studio-bg shrink-0">
      {/* Back */}
      <Link
        to="/studio/editor"
        className="p-1.5 rounded text-slate-200/35 hover:text-slate-200/80 hover:bg-white/[0.05] transition-all shrink-0"
        title={t("phase5_editor_back")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      {/* Title + save */}
      <span className="text-[12px] font-semibold text-slate-100 truncate max-w-[140px] shrink-0">
        {t("phase5_editor_title", { id: generatedContentId })}
      </span>
      <SaveStatusBadge saveState={saveState} saveError={saveError} />

      <div className="w-px h-4 bg-white/[0.08] mx-1 shrink-0" />

      {/* Undo / Redo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title={nextUndoLabel ?? undefined}
        className="p-1.5 rounded text-slate-200/45 hover:text-slate-200/90 hover:bg-white/[0.06] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title={nextRedoLabel ?? undefined}
        className="p-1.5 rounded text-slate-200/45 hover:text-slate-200/90 hover:bg-white/[0.06] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        {/* Version badge */}
        <span className="text-[9px] font-mono text-slate-200/25 tabular-nums">
          {t("phase5_editor_version", { version: composition.version })}
        </span>

        <div className="w-px h-4 bg-white/[0.08] shrink-0" />

        {/* Mode toggle */}
        <div className="flex items-center rounded border border-white/[0.08] overflow-hidden text-[10px] font-medium">
          <button
            onClick={() => onEditModeChange("quick")}
            className={cn(
              "px-2.5 py-1 transition-colors",
              editMode === "quick"
                ? "bg-white/[0.10] text-slate-100"
                : "text-slate-200/38 hover:text-slate-200/65",
            )}
          >
            {t("phase5_editor_mode_quick")}
          </button>
          <button
            onClick={() => onEditModeChange("precision")}
            className={cn(
              "px-2.5 py-1 border-l border-white/[0.08] transition-colors",
              editMode === "precision"
                ? "bg-white/[0.10] text-slate-100"
                : "text-slate-200/38 hover:text-slate-200/65",
            )}
          >
            {t("phase5_editor_mode_precision")}
          </button>
        </div>
      </div>
    </div>
  );
}
