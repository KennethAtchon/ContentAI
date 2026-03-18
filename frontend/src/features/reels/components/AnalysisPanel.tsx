import { useTranslation } from "react-i18next";
import { fmtNum } from "../hooks/use-reels";
import { GenerateFromReelButton } from "./GenerateFromReelButton";
import type { ReelDetail } from "../types/reel.types";

interface Props {
  reel: ReelDetail;
}

export function AnalysisPanel({ reel }: Props) {
  const { t } = useTranslation();

  return (
    <aside className="bg-studio-surface border-l border-overlay-sm flex flex-col overflow-hidden font-studio">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Metrics grid */}
        <div>
          <SectionLabel>{t("studio_panel_metrics")}</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                l: t("studio_panel_views"),
                v: fmtNum(reel.views),
                accent: false,
              },
              {
                l: t("studio_panel_likes"),
                v: fmtNum(reel.likes),
                accent: false,
              },
              {
                l: t("studio_panel_comments"),
                v: fmtNum(reel.comments),
                accent: false,
              },
              {
                l: t("studio_panel_engagement"),
                v: `${reel.engagementRate ?? 0}%`,
                accent: true,
              },
            ].map((m) => (
              <div
                key={m.l}
                className="bg-overlay-xs border border-overlay-sm rounded-[10px] p-3"
              >
                <p className="text-[9px] text-dim-3 tracking-[1px] uppercase mb-1">
                  {m.l}
                </p>
                <p
                  className={`text-[18px] font-bold font-studio-mono ${m.accent ? "text-studio-accent" : "text-studio-fg"}`}
                >
                  {m.v}
                </p>
              </div>
            ))}
          </div>
        </div>

        {reel.hook && (
          <div>
            <SectionLabel>{t("studio_panel_hook")}</SectionLabel>
            <div className="bg-studio-accent/[0.06] border border-studio-accent/15 rounded-[10px] p-3 text-[13px] font-semibold text-studio-fg leading-[1.5]">
              {reel.hook}
            </div>
          </div>
        )}

        {reel.caption && (
          <div>
            <SectionLabel>{t("studio_panel_caption")}</SectionLabel>
            <div className="bg-overlay-xs border border-overlay-sm rounded-[10px] p-3 text-[11px] text-dim-2 leading-[1.7] font-studio-mono">
              {reel.caption.slice(0, 180)}…
            </div>
          </div>
        )}

        {reel.audioName && (
          <div>
            <SectionLabel>{t("studio_panel_audio")}</SectionLabel>
            <div className="bg-overlay-xs border border-overlay-sm rounded-[10px] p-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-studio-accent to-studio-purple flex items-center justify-center text-sm shrink-0">
                ♪
              </div>
              <div>
                <p className="text-[12px] font-semibold text-studio-fg">
                  {reel.audioName}
                </p>
                {reel.audioId && (
                  <p className="text-[10px] text-dim-3 font-studio-mono mt-px">
                    {reel.audioId}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <GenerateFromReelButton reel={reel} />
      </div>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[1px] uppercase text-dim-3 mb-2.5">
      {children}
    </p>
  );
}
