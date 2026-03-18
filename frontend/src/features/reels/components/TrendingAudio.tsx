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
    <div className="px-3 pb-3 h-full flex flex-col">
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="flex flex-col flex-1 min-h-0"
      >
        <CollapsibleTrigger
          className={cn(
            "w-full flex items-center justify-between text-[11px] font-semibold text-dim-1 shrink-0",
            "py-2"
          )}
        >
          <span className="flex items-center gap-2">
            <span>🎵</span>
            {t("studio_discover_trendingAudio")}
          </span>
          <span className="text-[10px] text-dim-2">
            {open ? "—" : "+"}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="studio-skeleton h-[36px]" />
              ))}
            </div>
          ) : audio.length === 0 ? (
            <div className="text-[11px] text-dim-3">
              {t("studio_discover_trendingAudio_empty")}
            </div>
          ) : (
            <div className="space-y-2">
              {audio.map((item) => (
                <div
                  key={`${item.audioId ?? "unknown"}-${item.audioName ?? ""}`}
                  className="flex items-start gap-2 rounded-md border border-overlay-sm bg-overlay-xs px-2 py-1.5"
                >
                  <span className="text-[12px] text-dim-2">
                    {TREND_ICON[item.trend]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-primary truncate">
                      {item.audioName ?? "Unknown audio"}
                    </div>
                    <div className="text-[10px] text-dim-2 truncate">
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
