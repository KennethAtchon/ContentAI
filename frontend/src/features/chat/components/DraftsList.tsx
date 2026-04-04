import { useTranslation } from "react-i18next";
import { Mic, Music, FileText } from "lucide-react";
import { useContentAssets } from "@/features/audio/hooks/use-content-assets";
import { cn } from "@/shared/utils/helpers/utils";
import { getSessionDraftLabel } from "../lib/draft-labels";
import type { SessionDraft } from "../types/chat.types";

interface DraftsListProps {
  drafts: SessionDraft[];
  activeContentId: number | null;
  onSelect: (draft: SessionDraft) => void;
}

function DraftCard({
  draft,
  index,
  isActive,
  onSelect,
}: {
  draft: SessionDraft;
  index: number;
  isActive: boolean;
  onSelect: (draft: SessionDraft) => void;
}) {
  const { t } = useTranslation();
  const { data: assetsData } = useContentAssets(draft.id);
  const assets = assetsData?.assets ?? [];
  const hasVoiceover = assets.some(
    (a) => a.role === "voiceover" || a.type === "voiceover"
  );
  const hasMusic = assets.some((a) => a.role === "background_music");
  const label = getSessionDraftLabel(draft, index, t);

  const outputTypeLabel =
    draft.outputType === "full_script"
      ? t("workspace_draft_type_full")
      : draft.outputType === "hook_only"
        ? t("workspace_draft_type_hook")
        : draft.outputType === "caption_only"
          ? t("workspace_draft_type_caption")
          : draft.outputType;

  return (
    <button
      onClick={() => onSelect(draft)}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all",
        isActive
          ? "border-primary/30 bg-primary/[0.04]"
          : "border-border/50 bg-transparent hover:bg-muted/40 hover:border-border"
      )}
    >
      {isActive && (
        <div className="mb-1.5 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t("workspace_draft_active")}
          </span>
        </div>
      )}

      <p
        className={cn(
          "mb-2 text-sm leading-relaxed",
          isActive ? "font-medium text-foreground" : "text-foreground/80"
        )}
      >
        {label}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-muted/60 px-1.5 py-0.5 text-sm text-muted-foreground/60">
            v{draft.version}
          </span>
          <span className="text-sm text-muted-foreground/60">
            {outputTypeLabel}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {hasVoiceover && (
            <span className="flex items-center gap-0.5 text-sm text-success dark:text-success">
              <Mic className="h-3 w-3" />
            </span>
          )}
          {hasMusic && (
            <span className="flex items-center gap-0.5 text-sm text-blue-500">
              <Music className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function DraftsList({
  drafts,
  activeContentId,
  onSelect,
}: DraftsListProps) {
  const { t } = useTranslation();

  if (drafts.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground/40" />
        </div>
        <div>
          <p className="text-base font-medium text-foreground/70">
            {t("workspace_empty_title")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("workspace_empty_description")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
      {drafts.map((draft, index) => (
        <DraftCard
          key={draft.id}
          draft={draft}
          index={index}
          isActive={draft.id === activeContentId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
