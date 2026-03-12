import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { cn } from "@/shared/utils/helpers/utils";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { ReelList } from "@/features/reels/components/ReelList";
import { PhonePreview } from "@/features/reels/components/PhonePreview";
import { AnalysisPanel } from "@/features/reels/components/AnalysisPanel";
import { useReels, useReel, useReelNiches } from "@/features/reels/hooks/use-reels";
import type { Reel } from "@/features/reels/types/reel.types";
import { useTranslation } from "react-i18next";

const AI_TOOLS = [
  "studio_tools_hookWriter",
  "studio_tools_captionAI",
  "studio_tools_remix",
  "studio_tools_voiceOver",
  "studio_tools_scheduler",
];

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

  const loadMore = () => setOffset((prev) => prev + PAGE_SIZE);

  const { data: reelData } = useReel(resolvedId);
  const selectedReel = reelData?.reel ?? null;
  const analysis = reelData?.analysis ?? null;

  return (
    <AuthGuard authType="user">
      {/* Full-screen dark studio shell */}
      <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
        <StudioTopBar variant="studio" activeTab="discover" />

        {/* Three-column layout */}
        <div
          className="grid overflow-hidden"
          style={{ gridTemplateColumns: "220px 1fr 300px" }}
        >
          {/* Left sidebar */}
          <aside className="bg-studio-surface border-r border-white/[0.05] flex flex-col overflow-hidden">
            {/* Niche selector */}
            {niches.length > 0 && (
              <div className="px-3 pt-3 pb-2 border-b border-white/[0.05]">
                <select
                  value={activeNicheId ?? ""}
                  onChange={(e) => handleNicheChange(Number(e.target.value))}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-studio-fg outline-none focus:border-studio-accent/50 transition-colors cursor-pointer"
                >
                  {niches.map((n) => (
                    <option key={n.id} value={n.id} className="bg-studio-surface">
                      {n.name}
                    </option>
                  ))}
                </select>
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
                  onSelect={setActiveReelId}
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

            {/* AI Tools section */}
            <div className="border-t border-white/[0.05] px-3.5 pt-2.5 pb-2 text-[10px] font-semibold tracking-[1.5px] uppercase text-slate-200/25">
              {t("studio_sidebar_aiTools")}
            </div>
            {AI_TOOLS.map((key) => (
              <button
                key={key}
                className="px-3.5 py-2 text-[12px] text-slate-200/45 flex items-center gap-1.5 w-full text-left bg-transparent border-0 font-studio cursor-pointer transition-colors hover:text-studio-accent"
              >
                <span className="text-studio-accent/60">✦</span>
                {t(key)}
              </button>
            ))}
          </aside>

          {/* Center canvas */}
          <main className="flex flex-col overflow-hidden bg-studio-bg">
            {selectedReel ? (
              <>
                <PhonePreview reel={selectedReel} />

                {/* Toolbar */}
                <div className="px-4 py-2.5 border-t border-white/[0.05] flex items-center gap-2 bg-studio-surface shrink-0">
                  <ToolbarBtn
                    onClick={() => {
                      const idx = allReels.findIndex((r) => r.id === resolvedId);
                      if (idx > 0) setActiveReelId(allReels[idx - 1].id);
                    }}
                  >
                    ⟵ {t("studio_toolbar_prev")}
                  </ToolbarBtn>
                  <ToolbarBtn
                    onClick={() => {
                      const idx = allReels.findIndex((r) => r.id === resolvedId);
                      if (idx < allReels.length - 1) {
                        setActiveReelId(allReels[idx + 1].id);
                      } else if (hasMore) {
                        loadMore();
                      }
                    }}
                  >
                    {t("studio_toolbar_next")} ⟶
                  </ToolbarBtn>
                  <div className="w-px h-5 bg-white/[0.06] mx-0.5" />
                  <ToolbarBtn>✂ {t("studio_toolbar_trim")}</ToolbarBtn>
                  <ToolbarBtn>♪ {t("studio_toolbar_audio")}</ToolbarBtn>
                  <ToolbarBtn>T {t("studio_toolbar_caption")}</ToolbarBtn>
                  <div className="w-px h-5 bg-white/[0.06] mx-0.5" />
                  <ToolbarBtn primary>
                    ✦ {t("studio_toolbar_generateRemix")}
                  </ToolbarBtn>
                </div>
              </>
            ) : (
              <EmptyCanvas
                label="No reels found for this category"
                sub="An admin needs to add content for this niche first."
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

function ToolbarBtn({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-lg border transition-all duration-150 font-studio cursor-pointer",
        primary
          ? "bg-gradient-to-br from-studio-accent to-studio-purple border-transparent text-white font-semibold hover:opacity-85"
          : "bg-white/[0.05] border-white/[0.07] text-slate-200/50 hover:bg-white/[0.08] hover:text-studio-fg",
      )}
    >
      {children}
    </button>
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
