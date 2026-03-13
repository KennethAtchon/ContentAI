import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import { useApp } from "@/shared/contexts/app-context";
import { cn } from "@/shared/utils/helpers/utils";

interface TrendingAudioItem {
  audioId: string | null;
  audioName: string | null;
  artistName: string | null;
  useCount: number;
  lastSeen: string | null;
  trend: "rising" | "stable" | "declining";
}

const TREND_ICON: Record<TrendingAudioItem["trend"], string> = {
  rising: "↗",
  stable: "→",
  declining: "↘",
};

export function TrendingAudio({ nicheId }: { nicheId: number | null }) {
  const { t } = useTranslation();
  const { user } = useApp();
  const [open, setOpen] = useState(true);
  const fetcher = useQueryFetcher<{ audio: TrendingAudioItem[] }>();

  const params = new URLSearchParams({ days: "7", limit: "6" });
  if (nicheId != null) params.set("nicheId", String(nicheId));

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.api.audioTrending({
      days: 7,
      limit: 6,
      nicheId,
    }),
    queryFn: () => fetcher(`/api/audio/trending?${params}`),
    enabled: !!user,
  });

  const audio = data?.audio ?? [];

  return (
    <div className="px-3 pb-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className={cn(
            "w-full flex items-center justify-between text-[11px] font-semibold text-slate-200/60",
            "py-2"
          )}
        >
          <span className="flex items-center gap-2">
            <span>🎵</span>
            {t("studio_discover_trendingAudio")}
          </span>
          <span className="text-[10px] text-slate-200/40">
            {open ? "—" : "+"}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="studio-skeleton h-[36px]" />
              ))}
            </div>
          ) : audio.length === 0 ? (
            <div className="text-[11px] text-slate-200/35">
              {t("studio_discover_trendingAudio_empty")}
            </div>
          ) : (
            <div className="space-y-2">
              {audio.map((item) => (
                <div
                  key={`${item.audioId ?? "unknown"}-${item.audioName ?? ""}`}
                  className="flex items-start gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-1.5"
                >
                  <span className="text-[12px] text-slate-200/50">
                    {TREND_ICON[item.trend]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-slate-100 truncate">
                      {item.audioName ?? "Unknown audio"}
                    </div>
                    <div className="text-[10px] text-slate-200/40 truncate">
                      {(item.artistName ?? "Unknown artist") +
                        ` · ${item.useCount} uses`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
