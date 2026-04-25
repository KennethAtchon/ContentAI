import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/shared/ui/primitives/button";
import { Checkbox } from "@/shared/ui/primitives/checkbox";
import {
  useDeleteAdminReel,
  type AdminNicheReel,
} from "@/domains/admin/hooks/use-niches";
import { fmtNum } from "./niche-helpers";

// ── Reel Row ──────────────────────────────────────────────────────────────────

export function NicheReelRow({
  reel,
  nicheId,
  selected,
  onSelect,
}: {
  reel: AdminNicheReel;
  nicheId: number;
  selected: boolean;
  onSelect: (id: number, checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const deleteReel = useDeleteAdminReel();

  return (
    <>
      <div
        className="grid grid-cols-[44px_1fr_90px_90px_140px] items-center px-4 py-3 hover:bg-overlay-xs transition-colors cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div onClick={(e) => e.stopPropagation()} className="flex items-center">
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(reel.id, !!checked)}
          />
        </div>
        <div className="min-w-0">
          <p className="text-base text-studio-fg truncate font-medium">
            {reel.hook ?? reel.caption ?? `@${reel.username}`}
          </p>
          <p className="text-sm text-dim-3">@{reel.username}</p>
        </div>
        <span className="text-base text-dim-1 tabular-nums">
          {fmtNum(reel.views)}
        </span>
        <span className="text-base text-dim-1 tabular-nums">
          {reel.engagementRate
            ? `${Number(reel.engagementRate).toFixed(1)}%`
            : "—"}
        </span>
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {reel.videoR2Url && (
            <a href={reel.videoR2Url} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-sm">
                <Eye className="h-3 w-3" />
              </Button>
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-sm text-error hover:text-error hover:bg-error/10"
            onClick={() => deleteReel.mutate({ reelId: reel.id, nicheId })}
            disabled={deleteReel.isPending}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-dim-3" />
          ) : (
            <ChevronDown className="h-3 w-3 text-dim-3" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-[52px] pb-4 bg-overlay-xs border-t border-overlay-xs grid grid-cols-2 gap-x-6 gap-y-2">
          {[
            [t("admin_niche_row_likes"), fmtNum(reel.likes)],
            [t("admin_niche_row_comments"), fmtNum(reel.comments)],
            [t("admin_niche_row_audio"), reel.audioName ?? "—"],
            [t("admin_niche_row_viral"), reel.isViral ? "Yes" : "No"],
            [
              t("admin_niche_row_has_analysis"),
              reel.hasAnalysis ? "Yes" : "No",
            ],
            [t("admin_niche_row_caption"), reel.caption ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2 py-1">
              <span className="text-sm text-dim-3 w-28 shrink-0">{label}</span>
              <span className="text-sm text-dim-1 truncate">{value}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
