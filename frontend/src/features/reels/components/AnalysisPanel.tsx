import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";
import { fmtNum, useAnalyzeReel } from "../hooks/use-reels";
import type {
  ReelDetail,
  ReelAnalysis,
} from "../types/reel.types";

const HOOK_COLORS: Record<string, { bg: string; text: string }> = {
  Warning: { bg: "rgba(239,68,68,0.12)", text: "#EF4444" },
  Authority: { bg: "rgba(129,140,248,0.12)", text: "#818CF8" },
  Question: { bg: "rgba(245,158,11,0.12)", text: "#F59E0B" },
  Curiosity: { bg: "rgba(192,132,252,0.12)", text: "#C084FC" },
  List: { bg: "rgba(20,184,166,0.12)", text: "#14B8A6" },
  POV: { bg: "rgba(56,189,248,0.12)", text: "#38BDF8" },
  MythBust: { bg: "rgba(249,115,22,0.12)", text: "#F97316" },
  SocialProof: { bg: "rgba(34,197,94,0.12)", text: "#22C55E" },
};

interface Props {
  reel: ReelDetail;
  analysis: ReelAnalysis | null;
}


export function AnalysisPanel({ reel, analysis }: Props) {
  const { t } = useTranslation();
  const analyzeReel = useAnalyzeReel();




  return (
    <aside className="bg-studio-surface border-l border-white/[0.05] flex flex-col overflow-hidden font-studio">
      <AnalysisTab
        reel={reel}
        analysis={analysis}
        isAnalyzing={analyzeReel.isPending}
        onAnalyze={() => analyzeReel.mutate(reel.id)}
      />
    </aside>
  );
}

/* ── Analysis tab ─────────────────────────────────────────────────────────── */

function AnalysisTab({
  reel,
  analysis,
  isAnalyzing,
  onAnalyze,
}: {
  reel: ReelDetail;
  analysis: ReelAnalysis | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
}) {
  const { t } = useTranslation();

  return (
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
              className="bg-white/[0.04] border border-white/[0.06] rounded-[10px] p-3"
            >
              <p className="text-[9px] text-slate-200/30 tracking-[1px] uppercase mb-1">
                {m.l}
              </p>
              <p
                className={cn(
                  "text-[18px] font-bold font-studio-mono",
                  m.accent ? "text-studio-accent" : "text-studio-fg"
                )}
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
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] p-3 text-[11px] text-slate-200/50 leading-[1.7] font-studio-mono">
            {reel.caption.slice(0, 180)}…
          </div>
        </div>
      )}

      {reel.audioName && (
        <div>
          <SectionLabel>{t("studio_panel_audio")}</SectionLabel>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] p-2.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-studio-accent to-studio-purple flex items-center justify-center text-sm shrink-0">
              ♪
            </div>
            <div>
              <p className="text-[12px] font-semibold text-studio-fg">
                {reel.audioName}
              </p>
              {reel.audioId && (
                <p className="text-[10px] text-slate-200/30 font-studio-mono mt-px">
                  {reel.audioId}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <SectionLabel>{t("studio_panel_aiAnalysis")}</SectionLabel>
        {analysis ? (
          <>
            <AnalysisTags analysis={analysis} />
            {analysis.remixSuggestion && (
              <div className="mt-3 bg-studio-purple/[0.06] border border-studio-purple/15 rounded-[10px] p-3">
                <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-studio-purple mb-1.5">
                  {t("studio_panel_remixSuggestion")}
                </p>
                <p className="text-[12px] text-slate-200/65 leading-[1.6]">
                  {analysis.remixSuggestion}
                </p>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className={cn(
              "w-full bg-studio-accent/[0.08] border border-dashed border-studio-accent/30 rounded-[10px]",
              "text-studio-accent text-[12px] font-semibold py-3.5",
              "flex items-center justify-center gap-1.5 cursor-pointer font-studio",
              "transition-all duration-150 hover:bg-studio-accent/[0.14] hover:border-studio-accent/50",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isAnalyzing
              ? `⟳ ${t("studio_panel_analyzing")}`
              : `✦ ${t("studio_panel_runAnalysis")}`}
          </button>
        )}
      </div>
    </div>
  );
}


/* ── Shared sub-components ────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[1px] uppercase text-slate-200/25 mb-2.5">
      {children}
    </p>
  );
}

function AnalysisTags({ analysis }: { analysis: ReelAnalysis | null }) {
  if (!analysis) return null;
  const tags = [
    { label: analysis.hookCategory, type: "category" },
    ...(analysis.emotionalTrigger
      ?.split(",")
      .map((e) => ({ label: e.trim(), type: "emotion" })) ?? []),
    { label: analysis.formatPattern, type: "format" },
    { label: analysis.ctaType, type: "cta" },
  ].filter((t) => t.label);
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {tags.map((tag, i) => {
        const colors = tag.type === "category" ? HOOK_COLORS[tag.label!] : null;
        return (
          <span
            key={i}
            className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: colors?.bg ?? "rgba(255,255,255,0.06)",
              color: colors?.text ?? "rgba(226,232,240,0.5)",
              border: `1px solid ${colors?.text ?? "rgba(226,232,240,0.3)"}30`,
            }}
          >
            {tag.label}
          </span>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-white/[0.06] text-slate-200/40",
    queued: "bg-amber-400/15 text-amber-400",
    posted: "bg-green-400/15 text-green-400",
    failed: "bg-red-400/15 text-red-400",
  };
  return (
    <span
      className={cn(
        "text-[9px] font-bold px-1.5 py-px rounded-full uppercase tracking-[0.5px]",
        styles[status] ?? styles.draft
      )}
    >
      {status}
    </span>
  );
}

