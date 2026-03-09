import "@/styles/studio.css";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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

  // Auto-select first reel when list loads
  const resolvedId = activeReelId ?? reels[0]?.id ?? null;

  const { data: reelData } = useReel(resolvedId);
  const selectedReel = reelData?.reel ?? null;
  const analysis = reelData?.analysis ?? null;

  const handleScan = () => {
    setNiche(inputNiche);
    setActiveReelId(null);
  };

  return (
    <AuthGuard authType="user">
      <div className="ais-root">
        <StudioTopBar
          niche={inputNiche}
          onNicheChange={setInputNiche}
          onScan={handleScan}
          activeTab="discover"
        />

        <div className="ais-layout">
          {/* Left sidebar */}
          <div className="ais-sidebar">
            {reelsLoading ? (
              <div className="ais-panel-body">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="ais-skeleton"
                    style={{ height: 54, marginBottom: 4, margin: "4px 10px" }}
                  />
                ))}
              </div>
            ) : (
              <ReelList
                reels={reels}
                activeId={resolvedId}
                onSelect={setActiveReelId}
              />
            )}

            <div className="ais-sidebar-section">{t("studio_sidebar_aiTools")}</div>
            {AI_TOOLS.map((key) => (
              <button key={key} className="ais-tool">
                ✦ {t(key)}
              </button>
            ))}
          </div>

          {/* Center canvas */}
          <div className="ais-canvas">
            {selectedReel ? (
              <>
                <PhonePreview reel={selectedReel} />
                <div className="ais-canvas-toolbar">
                  <button
                    className="ais-toolbar-btn"
                    onClick={() => {
                      const idx = reels.findIndex((r) => r.id === resolvedId);
                      if (idx > 0) setActiveReelId(reels[idx - 1].id);
                    }}
                  >
                    ⟵ {t("studio_toolbar_prev")}
                  </button>
                  <button
                    className="ais-toolbar-btn"
                    onClick={() => {
                      const idx = reels.findIndex((r) => r.id === resolvedId);
                      if (idx < reels.length - 1) setActiveReelId(reels[idx + 1].id);
                    }}
                  >
                    {t("studio_toolbar_next")} ⟶
                  </button>
                  <div className="ais-toolbar-sep" />
                  <button className="ais-toolbar-btn">✂ {t("studio_toolbar_trim")}</button>
                  <button className="ais-toolbar-btn">♪ {t("studio_toolbar_audio")}</button>
                  <button className="ais-toolbar-btn">T {t("studio_toolbar_caption")}</button>
                  <div className="ais-toolbar-sep" />
                  <button className="ais-toolbar-btn primary">
                    ✦ {t("studio_toolbar_generateRemix")}
                  </button>
                </div>
              </>
            ) : (
              <div className="ais-empty" style={{ flex: 1 }}>
                <div className="ais-empty-icon">🎬</div>
                <div className="ais-empty-title">{t("studio_canvas_noReel")}</div>
                <div className="ais-empty-sub">{t("studio_canvas_noReelSub")}</div>
              </div>
            )}
          </div>

          {/* Right AI panel */}
          {selectedReel ? (
            <AnalysisPanel reel={selectedReel} analysis={analysis} />
          ) : (
            <div className="ais-ai-panel">
              <div className="ais-panel-body">
                <div className="ais-empty">
                  <div className="ais-empty-icon">✦</div>
                  <div className="ais-empty-title">{t("studio_panel_selectReel")}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/studio/discover")({
  component: DiscoverPage,
});
