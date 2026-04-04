import type { TFunction } from "i18next";
import type { SessionDraft } from "../types/chat.types";

const DEFAULT_DRAFT_LABEL_MAX_LENGTH = 60;

export function getSessionDraftLabel(
  draft: SessionDraft,
  index: number,
  t: TFunction,
  options?: { maxLength?: number }
): string {
  const maxLength = options?.maxLength ?? DEFAULT_DRAFT_LABEL_MAX_LENGTH;
  const label =
    draft.generatedHook?.trim() ||
    t("workspace_draft_untitled", { index: index + 1 });

  if (label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
