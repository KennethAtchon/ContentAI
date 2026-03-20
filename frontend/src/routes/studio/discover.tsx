import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { ReelList } from "@/features/reels/components/ReelList";
import { TikTokFeed } from "@/features/reels/components/TikTokFeed";
import { AnalysisPanel } from "@/features/reels/components/AnalysisPanel";
import { TrendingAudio } from "@/features/reels/components/TrendingAudio";
import {
  useReels,
  useReel,
  useReelNiches,
} from "@/features/reels/hooks/use-reels";
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
  const [selectedNicheValue, setSelectedNicheValue] = useState<string | null>(
    null
  );
  const [activeReelId, setActiveReelId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [allReels, setAllReels] = useState<Reel[]>([]);
  const [audioHeight, setAudioHeight] = useState(130);
  const dragState = useRef<{ startY: number; startHeight: number } | null>(
    null
  );

  const { data: nichesData } = useReelNiches();
  const niches = nichesData?.niches ?? [];
  const activeNicheValue =
    selectedNicheValue ?? (niches[0]?.id ? String(niches[0].id) : null);
  const activeNicheId =
    activeNicheValue && activeNicheValue !== "trending"
      ? Number(activeNicheValue)
      : null;
  const isTrending = activeNicheValue === "trending";

  const {
    data: reelsData,
    isLoading: reelsLoading,
    isFetching,
  } = useReels({
    niche: isTrending ? "trending" : undefined,
    nicheId: isTrending ? null : activeNicheId,
    sort: "fresh",
    offset,
  });
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

  const handleNicheChange = (value: string) => {
    setSelectedNicheValue(value);
    setActiveReelId(null);
    setOffset(0);
    setAllReels([]);
  };

  const loadMore = useCallback(() => setOffset((prev) => prev + PAGE_SIZE), []);

  const handleActiveChange = useCallback(
    (id: number) => setActiveReelId(id),
    []
  );

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragState.current = { startY: e.clientY, startHeight: audioHeight };
      const onMove = (e: globalThis.MouseEvent) => {
        if (!dragState.current) return;
        const delta = dragState.current.startY - e.clientY;
        setAudioHeight(
          Math.max(60, Math.min(400, dragState.current.startHeight + delta))
        );
      };
      const onUp = () => {
        dragState.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [audioHeight]
  );

  const handleAnalyze = useCallback((id: number) => {
    setActiveReelId(id);
  }, []);

  const { data: reelData } = useReel(resolvedId);
  const selectedReel = reelData?.reel ?? null;

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
          <aside className="bg-studio-surface border-r border-overlay-sm flex flex-col overflow-hidden">
            {/* Niche selector */}
            {niches.length > 0 && (
              <div className="px-3 pt-3 pb-2 border-b border-overlay-sm">
                <Select
                  value={activeNicheValue ?? undefined}
                  onValueChange={(val) => handleNicheChange(val)}
                >
                  <SelectTrigger className="w-full h-8 bg-overlay-sm border-overlay-md text-sm text-studio-fg rounded-lg focus:ring-studio-accent/50 focus:ring-offset-0">
                    <SelectValue placeholder={t("studio_search_placeholder")} />
                  </SelectTrigger>
                  <SelectContent className="bg-studio-surface border-overlay-md text-studio-fg">
                    <SelectItem
                      value="trending"
                      className="text-sm text-studio-fg focus:bg-studio-accent/[0.12] focus:text-studio-fg"
                    >
                      🔥 {t("studio_discover_trending")}
                    </SelectItem>
                    {niches.map((n) => (
                      <SelectItem
                        key={n.id}
                        value={String(n.id)}
                        className="text-sm text-studio-fg focus:bg-studio-accent/[0.12] focus:text-studio-fg"
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
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                  <ReelList
                    reels={allReels}
                    activeId={resolvedId}
                    onSelect={handleActiveChange}
                  />
                  {hasMore && (
                    <button
                      onClick={loadMore}
                      disabled={isFetching}
                      className="mx-3 mb-2 py-1.5 text-sm text-dim-2 hover:text-studio-accent border border-overlay-sm rounded-lg transition-colors disabled:opacity-40"
                    >
                      {isFetching
                        ? "Loading…"
                        : `Load more (${total - allReels.length} left)`}
                    </button>
                  )}
                </div>
                {/* Resize handle */}
                <div
                  onMouseDown={handleDragStart}
                  className="h-[6px] shrink-0 cursor-row-resize flex items-center justify-center group border-t border-overlay-sm hover:border-studio-accent/30 transition-colors"
                >
                  <div className="w-6 h-[2px] rounded-full bg-overlay-md group-hover:bg-studio-accent/50 transition-colors" />
                </div>
                <div
                  style={{ height: audioHeight }}
                  className="shrink-0 overflow-hidden"
                >
                  <TrendingAudio nicheId={isTrending ? null : activeNicheId} />
                </div>
              </>
            )}
          </aside>

          {/* Center — TikTok video feed */}
          <main className="flex flex-col overflow-hidden bg-studio-bg relative">
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
            <AnalysisPanel reel={selectedReel} />
          ) : (
            <aside className="bg-studio-surface border-l border-overlay-sm flex items-center justify-center">
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
      <span className="text-5xl opacity-50">{icon}</span>
      <p className="text-base font-semibold text-dim-2">{label}</p>
      {sub && <p className="text-sm text-dim-3">{sub}</p>}
    </div>
  );
}

export const Route = createFileRoute("/studio/discover")({
  component: DiscoverPage,
});
