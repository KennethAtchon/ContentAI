import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { ReelList } from "@/features/reels/components/ReelList";
import { PhonePreview } from "@/features/reels/components/PhonePreview";
import { AnalysisPanel } from "@/features/reels/components/AnalysisPanel";
import { useReels, useReel } from "@/features/reels/hooks/use-reels";

const AI_TOOLS = [
  "studio_tools_hookWriter",
  "studio_tools_captionAI",
  "studio_tools_remix",
  "studio_tools_voiceOver",
  "studio_tools_scheduler",
];

function DiscoverPage() {
  const { t } = useTranslation();
  const [niche, setNiche] = useState("personal finance");
  const [inputNiche, setInputNiche] = useState("personal finance");
  const [activeReelId, setActiveReelId] = useState<number | null>(null);

  const { data: reelsData, isLoading: reelsLoading } = useReels(niche);
  const reels = reelsData?.reels ?? [];
  const resolvedId = activeReelId ?? reels[0]?.id ?? null;

  const { data: reelData } = useReel(resolvedId);
  const selectedReel = reelData?.reel ?? null;
  const analysis = reelData?.analysis ?? null;

  const handleScan = () => { setNiche(inputNiche); setActiveReelId(null); };

  return (
    <AuthGuard authType="user">
      {/* Full-screen dark studio shell */}
      <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
        <StudioTopBar variant="studio" niche={inputNiche} onNicheChange={setInputNiche} onScan={handleScan} activeTab="discover" />

        {/* Three-column layout */}
        <div className="grid overflow-hidden" style={{ gridTemplateColumns: "220px 1fr 300px" }}>

          {/* Left sidebar */}
          <aside className="bg-studio-surface border-r border-white/[0.05] flex flex-col overflow-hidden">
            {reelsLoading ? (
              <div className="p-3 space-y-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="studio-skeleton h-[54px]" />
                ))}
              </div>
            ) : (
              <ReelList reels={reels} activeId={resolvedId} onSelect={setActiveReelId} />
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
                  <ToolbarBtn onClick={() => {
                    const idx = reels.findIndex((r) => r.id === resolvedId);
                    if (idx > 0) setActiveReelId(reels[idx - 1].id);
                  }}>⟵ {t("studio_toolbar_prev")}</ToolbarBtn>
                  <ToolbarBtn onClick={() => {
                    const idx = reels.findIndex((r) => r.id === resolvedId);
                    if (idx < reels.length - 1) setActiveReelId(reels[idx + 1].id);
                  }}>{t("studio_toolbar_next")} ⟶</ToolbarBtn>
                  <div className="w-px h-5 bg-white/[0.06] mx-0.5" />
                  <ToolbarBtn>✂ {t("studio_toolbar_trim")}</ToolbarBtn>
                  <ToolbarBtn>♪ {t("studio_toolbar_audio")}</ToolbarBtn>
                  <ToolbarBtn>T {t("studio_toolbar_caption")}</ToolbarBtn>
                  <div className="w-px h-5 bg-white/[0.06] mx-0.5" />
                  <ToolbarBtn primary>✦ {t("studio_toolbar_generateRemix")}</ToolbarBtn>
                </div>
              </>
            ) : (
              <EmptyCanvas label={t("studio_canvas_noReel")} sub={t("studio_canvas_noReelSub")} icon="🎬" />
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

function ToolbarBtn({ children, onClick, primary }: { children: React.ReactNode; onClick?: () => void; primary?: boolean }) {
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

function EmptyCanvas({ label, sub, icon }: { label: string; sub?: string; icon: string }) {
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
