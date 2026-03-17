import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type {
  CompositionRecord,
  SaveState,
} from "../../types/composition.types";
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
}: EditorHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          {t("phase5_editor_label")}
        </p>
        <h1 className="truncate text-sm font-semibold text-foreground">
          {t("phase5_editor_title", { id: generatedContentId })}
        </h1>
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="rounded border border-border/60 px-2 py-1 text-foreground/80 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
        >
          {t("phase5_editor_undo")}
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="rounded border border-border/60 px-2 py-1 text-foreground/80 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
        >
          {t("phase5_editor_redo")}
        </button>
        <SaveStatusBadge saveState={saveState} saveError={saveError} />
        <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
          {t("phase5_editor_version", { version: composition.version })}
        </span>
        <Link
          to="/studio/generate"
          className="rounded border border-border/60 px-2.5 py-1.5 text-foreground/80 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
        >
          {t("phase5_editor_back")}
        </Link>
      </div>
    </div>
  );
}
