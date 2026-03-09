import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";
import { fmtNum, useAnalyzeReel } from "../hooks/use-reels";
import { useGenerateContent, useQueueContent, useGenerationHistory } from "@/features/generation/hooks/use-generation";
import type { ReelDetail, ReelAnalysis, GeneratedContent } from "../types/reel.types";

const HOOK_COLORS: Record<string, { bg: string; text: string }> = {
  Warning:     { bg: "rgba(239,68,68,0.12)",   text: "#EF4444" },
  Authority:   { bg: "rgba(129,140,248,0.12)",  text: "#818CF8" },
  Question:    { bg: "rgba(245,158,11,0.12)",   text: "#F59E0B" },
  Curiosity:   { bg: "rgba(192,132,252,0.12)",  text: "#C084FC" },
  List:        { bg: "rgba(20,184,166,0.12)",   text: "#14B8A6" },
  POV:         { bg: "rgba(56,189,248,0.12)",   text: "#38BDF8" },
  MythBust:    { bg: "rgba(249,115,22,0.12)",   text: "#F97316" },
  SocialProof: { bg: "rgba(34,197,94,0.12)",    text: "#22C55E" },
};

interface Props {
  reel: ReelDetail;
  analysis: ReelAnalysis | null;
}

type PanelTab = "Analysis" | "Generate" | "History";

export function AnalysisPanel({ reel, analysis }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PanelTab>("Analysis");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [copiedHook, setCopiedHook] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const analyzeReel     = useAnalyzeReel();
  const generateContent = useGenerateContent();
  const queueContent    = useQueueContent();

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    try {
      const res = await generateContent.mutateAsync({ sourceReelId: reel.id, prompt, outputType: "full" });
      setResult(res.content);
      setPrompt("");
    } catch { /* mutation error state handles UI */ }
  };

  const copy = async (text: string, type: "hook" | "caption") => {
    await navigator.clipboard.writeText(text);
    if (type === "hook") { setCopiedHook(true); setTimeout(() => setCopiedHook(false), 1500); }
    else { setCopiedCaption(true); setTimeout(() => setCopiedCaption(false), 1500); }
  };

  const TABS: PanelTab[] = ["Analysis", "Generate", "History"];

  return (
    <aside className="bg-studio-surface border-l border-white/[0.05] flex flex-col overflow-hidden font-studio">
      {/* Tabs */}
      <div className="flex border-b border-white/[0.05] shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2.5 text-[11px] font-medium text-center cursor-pointer",
              "bg-transparent border-0 border-b-2 transition-all duration-150 font-studio",
              "focus-visible:outline-none",
              activeTab === tab
                ? "text-studio-accent border-b-studio-accent"
                : "text-slate-200/35 border-b-transparent hover:text-slate-200/60",
            )}
          >
            {t(`studio_panel_${tab.toLowerCase()}`)}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "Analysis" && (
        <AnalysisTab reel={reel} analysis={analysis} isAnalyzing={analyzeReel.isPending} onAnalyze={() => analyzeReel.mutate(reel.id)} />
      )}

      {activeTab === "Generate" && (
        <div className="flex flex-col overflow-hidden flex-1">
          <div className="flex-1 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <AnalysisTags analysis={analysis} />
          </div>
          {/* Generate input area */}
          <div className="border-t border-white/[0.05] p-3.5 shrink-0">
            <p className="text-[10px] font-semibold tracking-[1px] uppercase text-slate-200/25 mb-2">
              {t("studio_generate_label")}
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("studio_generate_placeholder")}
              className={cn(
                "w-full bg-white/[0.04] border border-white/[0.08] rounded-[10px]",
                "text-studio-fg text-[12px] px-3 py-2.5 outline-none resize-none min-h-[60px]",
                "placeholder:text-slate-200/20 transition-colors duration-200 font-studio box-border",
                "focus:border-studio-ring/40",
              )}
            />
            <div className="mt-2">
              <button
                onClick={handleGenerate}
                disabled={generateContent.isPending || !prompt.trim()}
                className={cn(
                  "w-full relative overflow-hidden",
                  "bg-gradient-to-br from-studio-accent to-studio-purple border-0 rounded-lg",
                  "text-white text-[12px] font-bold py-2.5 cursor-pointer transition-opacity duration-150 font-studio",
                  "hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {generateContent.isPending && <div className="studio-gen-bar" />}
                <span className="relative z-10">
                  {generateContent.isPending ? t("studio_generate_generating") : `✦ ${t("studio_generate_button")}`}
                </span>
              </button>
              {generateContent.isError && (
                <p className="text-[11px] text-red-400 mt-1.5">{t("studio_generate_error")}</p>
              )}
            </div>
            {result && (
              <div className="mt-2.5 bg-studio-accent/[0.08] border border-studio-accent/20 rounded-[10px] p-3">
                <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-studio-accent mb-2">
                  ✦ {t("studio_generate_generated")}
                </p>
                {result.generatedHook && (
                  <p className="text-[13px] font-bold text-slate-100 leading-[1.4] mb-1.5">
                    {result.generatedHook}
                  </p>
                )}
                {result.generatedCaption && (
                  <p className="text-[11px] text-slate-200/55 leading-[1.6] mb-2.5">
                    {result.generatedCaption.slice(0, 200)}…
                  </p>
                )}
                <div className="flex gap-1.5 flex-wrap">
                  {result.generatedHook && (
                    <GhostBtn onClick={() => copy(result.generatedHook!, "hook")}>
                      {copiedHook ? "✓ Copied" : "Copy Hook"}
                    </GhostBtn>
                  )}
                  {result.generatedCaption && (
                    <GhostBtn onClick={() => copy(result.generatedCaption!, "caption")}>
                      {copiedCaption ? "✓ Copied" : "Copy Caption"}
                    </GhostBtn>
                  )}
                  <button
                    onClick={() => { queueContent.mutate({ contentId: result.id }); setResult(null); }}
                    className="text-[10px] font-bold px-2.5 py-1.5 rounded-md border-0 bg-gradient-to-br from-studio-accent to-studio-purple text-white cursor-pointer font-studio transition-opacity hover:opacity-85"
                  >
                    + {t("studio_queue_add")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "History" && <HistoryTab />}
    </aside>
  );
}

/* ── Analysis tab ─────────────────────────────────────────────────────────── */

function AnalysisTab({ reel, analysis, isAnalyzing, onAnalyze }: {
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
            { l: t("studio_panel_views"),      v: fmtNum(reel.views),            accent: false },
            { l: t("studio_panel_likes"),       v: fmtNum(reel.likes),            accent: false },
            { l: t("studio_panel_comments"),    v: fmtNum(reel.comments),         accent: false },
            { l: t("studio_panel_engagement"),  v: `${reel.engagementRate ?? 0}%`, accent: true  },
          ].map((m) => (
            <div key={m.l} className="bg-white/[0.04] border border-white/[0.06] rounded-[10px] p-3">
              <p className="text-[9px] text-slate-200/30 tracking-[1px] uppercase mb-1">{m.l}</p>
              <p className={cn(
                "text-[18px] font-bold font-studio-mono",
                m.accent ? "text-studio-accent" : "text-studio-fg",
              )}>
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
              <p className="text-[12px] font-semibold text-studio-fg">{reel.audioName}</p>
              {reel.audioId && <p className="text-[10px] text-slate-200/30 font-studio-mono mt-px">{reel.audioId}</p>}
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
                <p className="text-[12px] text-slate-200/65 leading-[1.6]">{analysis.remixSuggestion}</p>
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
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {isAnalyzing ? `⟳ ${t("studio_panel_analyzing")}` : `✦ ${t("studio_panel_runAnalysis")}`}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── History tab ──────────────────────────────────────────────────────────── */

function HistoryTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useGenerationHistory();

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-2">
        {[1, 2, 3].map((i) => <div key={i} className="studio-skeleton h-[60px]" />)}
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="text-[40px] opacity-50">✦</span>
        <p className="text-[14px] font-semibold text-slate-200/50">{t("studio_history_empty")}</p>
        <p className="text-[12px] text-slate-200/25">{t("studio_history_emptySub")}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <div
          key={item.id}
          className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] p-3 cursor-pointer transition-colors hover:border-studio-accent/30"
        >
          <p className="text-[12px] font-semibold text-studio-fg leading-[1.4] mb-1 line-clamp-2">
            {item.generatedHook ?? t("studio_history_noHook")}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-slate-200/30">
            <StatusBadge status={item.status} />
            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
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
    { label: analysis.hookCategory,    type: "category" },
    ...(analysis.emotionalTrigger?.split(",").map((e) => ({ label: e.trim(), type: "emotion" })) ?? []),
    { label: analysis.formatPattern,   type: "format" },
    { label: analysis.ctaType,         type: "cta" },
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
              border: `1px solid ${(colors?.text ?? "rgba(226,232,240,0.3)")}30`,
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
    draft:  "bg-white/[0.06] text-slate-200/40",
    queued: "bg-amber-400/15 text-amber-400",
    posted: "bg-green-400/15 text-green-400",
    failed: "bg-red-400/15 text-red-400",
  };
  return (
    <span className={cn("text-[9px] font-bold px-1.5 py-px rounded-full uppercase tracking-[0.5px]", styles[status] ?? styles.draft)}>
      {status}
    </span>
  );
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md border border-white/10 bg-white/[0.05] text-slate-200/60 cursor-pointer font-studio transition-all hover:bg-white/10 hover:text-studio-fg"
    >
      {children}
    </button>
  );
}
