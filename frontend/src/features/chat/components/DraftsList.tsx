import { useTranslation } from "react-i18next";
import { Mic, Music, FileText } from "lucide-react";
import { useContentAssets } from "@/features/audio/hooks/use-content-assets";
import { cn } from "@/shared/utils/helpers/utils";
import type { SessionDraft } from "../types/chat.types";

interface DraftsListProps {
  drafts: SessionDraft[];
  activeContentId: number | null;
  onSelect: (draft: SessionDraft) => void;
  onSetActive: (id: number) => void;
}

function DraftCard({
  draft,
  index,
  isActive,
  onSelect,
  onSetActive,
}: {
  draft: SessionDraft;
  index: number;
  isActive: boolean;
  onSelect: (draft: SessionDraft) => void;
  onSetActive: (id: number) => void;
}) {
  const { t } = useTranslation();
  const { data: assetsData } = useContentAssets(draft.id);
  const assets = assetsData?.assets ?? [];
  const hasVoiceover = assets.some(
    (a) => a.role === "voiceover" || a.type === "voiceover"
  );
  const hasMusic = assets.some((a) => a.role === "background_music");

  const label = draft.generatedHook
    ? draft.generatedHook.length > 60
      ? draft.generatedHook.slice(0, 57) + "…"
      : draft.generatedHook
    : t("workspace_draft_untitled", { index: index + 1 });

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
        "w-full text-left p-3 rounded-lg border transition-all group",
        isActive
          ? "border-primary/30 bg-primary/[0.04]"
          : "border-border/50 bg-transparent hover:bg-muted/40 hover:border-border"
      )}
    >
      {isActive && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-sm font-semibold text-primary uppercase tracking-wide">
            {t("workspace_draft_active")}
          </span>
        </div>
      )}

      <p
        className={cn(
          "text-sm leading-relaxed mb-2",
          isActive ? "text-foreground font-medium" : "text-foreground/80"
        )}
      >
        {label}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground/60 bg-muted/60 px-1.5 py-0.5 rounded">
            v{draft.version}
          </span>
          <span className="text-sm text-muted-foreground/60">
            {outputTypeLabel}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {hasVoiceover && (
            <span className="flex items-center gap-0.5 text-sm text-success dark:text-success">
              <Mic className="w-3 h-3" />
            </span>
          )}
          {hasMusic && (
            <span className="flex items-center gap-0.5 text-sm text-blue-500">
              <Music className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      {!isActive && (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onSetActive(draft.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onSetActive(draft.id);
            }
          }}
          className="mt-2 text-sm text-muted-foreground/50 hover:text-primary transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
        >
          {t("workspace_draft_set_active")}
        </div>
      )}
    </button>
  );
}

export function DraftsList({
  drafts,
  activeContentId,
  onSelect,
  onSetActive,
}: DraftsListProps) {
  const { t } = useTranslation();

  if (drafts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <FileText className="w-5 h-5 text-muted-foreground/40" />
        </div>
        <div>
          <p className="text-base font-medium text-foreground/70">
            {t("workspace_empty_title")}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {t("workspace_empty_description")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
      {drafts.map((draft, index) => (
        <DraftCard
          key={draft.id}
          draft={draft}
          index={index}
          isActive={draft.id === activeContentId}
          onSelect={onSelect}
          onSetActive={onSetActive}
        />
      ))}
    </div>
  );
}
