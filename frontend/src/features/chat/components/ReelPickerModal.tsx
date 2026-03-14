import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { fmtNum, useReels, useReelNiches } from "@/features/reels/hooks/use-reels";
import type { Reel } from "@/features/reels/types/reel.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: number[];
  onSelect: (reel: Reel) => void;
}

export function ReelPickerModal({
  open,
  onOpenChange,
  selectedIds,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedNicheId, setSelectedNicheId] = useState<number | null>(null);

  const { data: nichesData } = useReelNiches();
  const niches = nichesData?.niches ?? [];

  const { data, isLoading } = useReels({
    nicheId: selectedNicheId,
    niche: selectedNicheId ? undefined : "trending",
    sort: "views",
  });

  const reels = (data?.reels ?? []).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.username.toLowerCase().includes(q) ||
      (r.hook ?? "").toLowerCase().includes(q)
    );
  });

  function handleSelect(reel: Reel) {
    onSelect(reel);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <DialogTitle className="text-sm">
            {t("studio_chat_reelPicker_title")}
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3 border-b space-y-2.5">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("studio_chat_reelPicker_search")}
            className="h-8 text-sm"
            autoFocus
          />

          {niches.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedNicheId(null)}
                className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  !selectedNicheId
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-white/[0.03] text-muted-foreground border-white/10 hover:text-foreground"
                }`}
              >
                {t("studio_chat_reelPicker_niche_all")}
              </button>
              {niches.map((n) => (
                <button
                  key={n.id}
                  onClick={() =>
                    setSelectedNicheId(selectedNicheId === n.id ? null : n.id)
                  }
                  className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    selectedNicheId === n.id
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-white/[0.03] text-muted-foreground border-white/10 hover:text-foreground"
                  }`}
                >
                  {n.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 py-1">
          {isLoading ? (
            <div className="space-y-1 px-2 py-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-lg bg-white/[0.04] animate-pulse"
                />
              ))}
            </div>
          ) : reels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("studio_chat_reelPicker_empty")}
            </p>
          ) : (
            reels.map((reel) => {
              const isSelected = selectedIds.includes(reel.id);
              return (
                <button
                  key={reel.id}
                  onClick={() => handleSelect(reel)}
                  disabled={isSelected}
                  className={`w-full text-left px-4 py-2.5 hover:bg-white/[0.04] transition-colors flex items-center gap-3 ${
                    isSelected ? "opacity-40 cursor-default" : "cursor-pointer"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-base shrink-0">
                    {reel.thumbnailEmoji ?? "🎬"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate">
                      @{reel.username}
                    </p>
                    {reel.hook && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {reel.hook.slice(0, 60)}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">
                      {fmtNum(reel.views)} views · {reel.niche}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] text-primary font-semibold shrink-0">
                      ✓
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
