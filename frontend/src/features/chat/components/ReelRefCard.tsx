import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { fmtNum, useReel } from "@/features/reels/hooks/use-reels";

interface Props {
  reelId: number;
  onRemove?: (id: number) => void;
}

export function ReelRefCard({ reelId, onRemove }: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useReel(reelId);

  if (isLoading) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs animate-pulse">
        <span className="w-16 h-3 bg-current/20 rounded" />
      </div>
    );
  }

  if (!data?.reel) return null;

  const { reel } = data;

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs max-w-[220px]">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[11px] truncate text-primary">
          @{reel.username}
        </p>
        {reel.hook && (
          <p className="text-[10px] text-muted-foreground truncate">
            {reel.hook.slice(0, 50)}
            {reel.hook.length > 50 ? "…" : ""}
          </p>
        )}
        <p className="text-[10px] text-muted-foreground/60">
          {fmtNum(reel.views)} {t("studio_chat_reelCard_views")} · {reel.niche}
        </p>
      </div>
      {onRemove && (
        <button
          onClick={() => onRemove(reelId)}
          className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          aria-label="Remove reel"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
