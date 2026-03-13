import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { ReelList } from "@/features/reels/components/ReelList";
import { TikTokFeed } from "@/features/reels/components/TikTokFeed";
import { AnalysisPanel } from "@/features/reels/components/AnalysisPanel";
import { useReels, useReel, useReelNiches } from "@/features/reels/hooks/use-reels";
import type { Reel } from "@/features/reels/types/reel.types";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

const PAGE_SIZE = 20;

function DiscoverPage() {
  const { t } = useTranslation();
  const [selectedNicheId, setSelectedNicheId] = useState<number | null>(null);
  const [activeReelId, setActiveReelId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [allReels, setAllReels] = useState<Reel[]>([]);

  const { data: nichesData } = useReelNiches();
  const niches = nichesData?.niches ?? [];
  const activeNicheId = selectedNicheId ?? niches[0]?.id ?? null;
  const activeNicheName = niches.find((n) => n.id === activeNicheId)?.name ?? "";

  const { data: reelsData, isLoading: reelsLoading, isFetching } = useReels(activeNicheName, offset);
  const total = reelsData?.total ?? 0;
  const hasMore = allReels.length < total;
  const resolvedId = activeReelId ?? allReels[0]?.id ?? null;

  // Append newly fetched page to accumulated list
  useEffect(() => {
    if (reelsData?.reels && reelsData.reels.length > 0) {
      setAllReels((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const newReels = reelsData.reels.filter((r) => !existingIds.has(r.id));
        return newReels.length > 0 ? [...prev, ...newReels] : prev;
      });
    }
  }, [reelsData]);

  const handleNicheChange = (nicheId: number) => {
    setSelectedNicheId(nicheId);
    setActiveReelId(null);
    setOffset(0);
    setAllReels([]);
  };

  const loadMore = useCallback(() => setOffset((prev) => prev + PAGE_SIZE), []);

  const handleActiveChange = useCallback((id: number) => setActiveReelId(id), []);

  const handleAnalyze = useCallback((id: number) => {
    setActiveReelId(id);
    // Analysis panel will load automatically via useReel
  }, []);

  const { data: reelData } = useReel(resolvedId);
  const selectedReel = reelData?.reel ?? null;
  const analysis = reelData?.analysis ?? null;

  return (
    <AuthGuard authType="user">
      <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
        <StudioTopBar variant="studio" activeTab="discover" />

        {/* Three-column layout: sidebar | feed | analysis */}
        <div
          className="grid overflow-hidden"
          style={{ gridTemplateColumns: "220px 1fr 300px" }}
        >
          {/* Left sidebar */}
          <aside className="bg-studio-surface border-r border-white/[0.05] flex flex-col overflow-hidden">
            {/* Niche selector */}
            {niches.length > 0 && (
              <div className="px-3 pt-3 pb-2 border-b border-white/[0.05]">
                <Select
                  value={activeNicheId != null ? String(activeNicheId) : undefined}
                  onValueChange={(val) => handleNicheChange(Number(val))}
                >
                  <SelectTrigger className="w-full h-8 bg-white/[0.05] border-white/[0.08] text-[12px] text-studio-fg rounded-lg focus:ring-studio-accent/50 focus:ring-offset-0">
                    <SelectValue placeholder={t("studio_search_placeholder")} />
                  </SelectTrigger>
                  <SelectContent className="bg-studio-surface border-white/[0.1] text-studio-fg">
                    {niches.map((n) => (
                      <SelectItem
                        key={n.id}
                        value={String(n.id)}
                        className="text-[12px] text-studio-fg focus:bg-studio-accent/[0.12] focus:text-studio-fg"
                      >
                        {n.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {reelsLoading ? (
              <div className="p-3 space-y-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="studio-skeleton h-[54px]" />
                ))}
              </div>
            ) : (
              <>
                <ReelList
                  reels={allReels}
                  activeId={resolvedId}
                  onSelect={handleActiveChange}
                />
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={isFetching}
                    className="mx-3 mb-2 py-1.5 text-[11px] text-slate-200/40 hover:text-studio-accent border border-white/[0.06] rounded-lg transition-colors disabled:opacity-40"
                  >
                    {isFetching ? "Loading…" : `Load more (${total - allReels.length} left)`}
                  </button>
                )}
              </>
            )}
          </aside>

          {/* Center — TikTok video feed */}
          <main className="flex flex-col overflow-hidden bg-black relative">
            {allReels.length > 0 ? (
              <TikTokFeed
                reels={allReels}
                activeId={resolvedId}
                onActiveChange={handleActiveChange}
                onLoadMore={loadMore}
                hasMore={hasMore}
                onAnalyze={handleAnalyze}
              />
            ) : (
              <EmptyCanvas
                label={t("studio_canvas_noReel")}
                sub={t("studio_canvas_noReelSub")}
                icon="🎬"
              />
            )}
          </main>

          {/* Right AI panel */}
          {selectedReel ? (
            <AnalysisPanel reel={selectedReel} analysis={analysis} />
          ) : (
            <aside className="bg-studio-surface border-l border-white/[0.05] flex items-center justify-center">
              <EmptyCanvas label={t("studio_panel_selectReel")} icon="✦" />
            </aside>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

function EmptyCanvas({
  label,
  sub,
  icon,
}: {
  label: string;
  sub?: string;
  icon: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12 text-center">
      <span className="text-[40px] opacity-50">{icon}</span>
      <p className="text-[14px] font-semibold text-slate-200/50">{label}</p>
      {sub && <p className="text-[12px] text-slate-200/25">{sub}</p>}
    </div>
  );
}

export const Route = createFileRoute("/studio/discover")({
  component: DiscoverPage,
});
