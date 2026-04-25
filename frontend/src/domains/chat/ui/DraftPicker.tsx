import { useTranslation } from "react-i18next";
import { ChevronDown, Mic, FileText, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/primitives/dropdown-menu";
import { useContentAssets } from "@/domains/audio/hooks/use-content-assets";
import { cn } from "@/shared/lib/utils";

interface DraftItem {
  contentId: number;
  label: string;
}

interface DraftPickerProps {
  drafts: DraftItem[];
  activeContentId: number | null;
  onSelect: (contentId: number) => void;
}

function DraftItemRow({
  item,
  index,
  isActive,
  onSelect,
}: {
  item: DraftItem;
  index: number;
  isActive: boolean;
  onSelect: (contentId: number) => void;
}) {
  const { data } = useContentAssets(item.contentId);
  const hasVoiceover =
    data?.assets?.some((a) => a.type === "voiceover") ?? false;

  return (
    <DropdownMenuItem
      onClick={() => onSelect(item.contentId)}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-md group",
        isActive && "bg-primary/[0.06]"
      )}
    >
      <span
        className={cn(
          "flex-none w-5 h-5 rounded-full flex items-center justify-center text-sm font-semibold tabular-nums transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground group-hover:bg-muted/80"
        )}
      >
        {index + 1}
      </span>

      <span
        className={cn(
          "flex-1 text-sm truncate transition-colors",
          isActive
            ? "text-foreground font-medium"
            : "text-muted-foreground group-hover:text-foreground"
        )}
      >
        {item.label}
      </span>

      <span className="flex-none flex items-center gap-1.5">
        {hasVoiceover && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-sm font-medium px-1.5 py-0.5 rounded transition-colors",
              isActive
                ? "bg-success/15 text-success dark:text-success"
                : "bg-muted text-muted-foreground/60"
            )}
          >
            <Mic className="w-2.5 h-2.5" />
            <span>VO</span>
          </span>
        )}
        {isActive && <Check className="w-3 h-3 text-primary flex-none" />}
      </span>
    </DropdownMenuItem>
  );
}

export function DraftPicker({
  drafts,
  activeContentId,
  onSelect,
}: DraftPickerProps) {
  const { t } = useTranslation();

  if (drafts.length === 0) return null;

  const activeDraft = drafts.find((i) => i.contentId === activeContentId);
  const triggerLabel =
    activeDraft?.label ?? t("studio_chat_content_picker_trigger");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "group flex items-center gap-1.5 max-w-[160px]",
            "px-2.5 py-1 rounded-md border transition-all duration-150",
            "text-sm font-medium",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring",
            activeDraft
              ? "border-primary/30 bg-primary/[0.06] text-primary hover:bg-primary/[0.10] hover:border-primary/40"
              : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-border"
          )}
        >
          <FileText className="w-3 h-3 flex-none opacity-70" />
          <span className="truncate leading-none">{triggerLabel}</span>
          <ChevronDown className="w-3 h-3 flex-none opacity-60 transition-transform duration-150 group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="w-64 p-1.5">
        <DropdownMenuLabel className="px-3 py-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground/70">
          {t("studio_chat_content_picker_label")} · {drafts.length}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />

        <div className="flex flex-col gap-0.5">
          {drafts.map((item, index) => (
            <DraftItemRow
              key={item.contentId}
              item={item}
              index={index}
              isActive={item.contentId === activeContentId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
