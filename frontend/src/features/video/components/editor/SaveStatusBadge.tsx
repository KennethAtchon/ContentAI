import { useTranslation } from "react-i18next";
import type { SaveState } from "../../types/composition.types";

export type SaveStatusBadgeProps = {
  saveState: SaveState;
  saveError: string | null;
};

export function SaveStatusBadge({
  saveState,
  saveError,
}: SaveStatusBadgeProps) {
  const { t } = useTranslation();

  if (saveState === "saving") {
    return (
      <span className="rounded border border-blue-400/30 bg-blue-500/10 px-2 py-1 text-[11px] text-blue-300">
        {t("phase5_editor_saving")}
      </span>
    );
  }
  if (saveState === "saved") {
    return (
      <span className="rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
        {t("phase5_editor_saved")}
      </span>
    );
  }
  if (saveState === "error") {
    return (
      <span
        title={saveError ?? undefined}
        className="rounded border border-red-400/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300"
      >
        {t("phase5_editor_save_failed")}
      </span>
    );
  }
  return null;
}
