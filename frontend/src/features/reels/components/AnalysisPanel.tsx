import { useState } from "react";
import { useTranslation } from "react-i18next";
import { fmtNum } from "../hooks/use-reels";
import { useAnalyzeReel } from "../hooks/use-reels";
import { useGenerateContent, useQueueContent, useGenerationHistory } from "@/features/generation/hooks/use-generation";
import type { ReelDetail, ReelAnalysis, GeneratedContent } from "../types/reel.types";

const HOOK_CATEGORY_COLORS: Record<string, string> = {
  Warning: "rgba(239,68,68,0.15)",
  Authority: "rgba(129,140,248,0.15)",
  Question: "rgba(245,158,11,0.15)",
  Curiosity: "rgba(192,132,252,0.15)",
  List: "rgba(20,184,166,0.15)",
  POV: "rgba(56,189,248,0.15)",
  MythBust: "rgba(249,115,22,0.15)",
  SocialProof: "rgba(34,197,94,0.15)",
};

const HOOK_CATEGORY_TEXT: Record<string, string> = {
  Warning: "#EF4444",
  Authority: "#818CF8",
  Question: "#F59E0B",
  Curiosity: "#C084FC",
  List: "#14B8A6",
  POV: "#38BDF8",
  MythBust: "#F97316",
  SocialProof: "#22C55E",
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
  const [generatedItem, setGeneratedItem] = useState<GeneratedContent | null>(null);
  const [copiedHook, setCopiedHook] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const analyzeReel = useAnalyzeReel();
  const generateContent = useGenerateContent();
  const queueContent = useQueueContent();

  const handleAnalyze = () => {
    analyzeReel.mutate(reel.id);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    try {
      const result = await generateContent.mutateAsync({
        sourceReelId: reel.id,
        prompt,
        outputType: "full",
      });
      setGeneratedItem(result.content);
      setPrompt("");
    } catch {
      // error handled by mutation state
    }
  };

  const copyToClipboard = async (text: string, type: "hook" | "caption") => {
    await navigator.clipboard.writeText(text);
    if (type === "hook") {
      setCopiedHook(true);
      setTimeout(() => setCopiedHook(false), 1500);
    } else {
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 1500);
    }
  };

  const handleAddToQueue = () => {
    if (!generatedItem) return;
    queueContent.mutate({ contentId: generatedItem.id });
    setGeneratedItem(null);
  };

  const tabs: PanelTab[] = ["Analysis", "Generate", "History"];

  return (
    <div className="ais-ai-panel">
      <div className="ais-panel-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`ais-panel-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(`studio_panel_${tab.toLowerCase()}`)}
          </button>
        ))}
      </div>

      {activeTab === "Analysis" && (
        <AnalysisTabContent
          reel={reel}
          analysis={analysis}
          onRunAnalysis={handleAnalyze}
          isAnalyzing={analyzeReel.isPending}
        />
      )}

      {activeTab === "Generate" && (
        <>
          <div className="ais-panel-body" style={{ paddingBottom: 0 }}>
            <AnalysisTagsStrip analysis={analysis} />
          </div>
          <div className="ais-generate-section">
            <div className="ais-generate-label">{t("studio_generate_label")}</div>
            <textarea
              className="ais-generate-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("studio_generate_placeholder")}
            />
            <div className="ais-generate-row">
              <button
                className="ais-generate-btn"
                onClick={handleGenerate}
                disabled={generateContent.isPending || !prompt.trim()}
              >
                {generateContent.isPending && (
                  <div className="ais-generating-bar" />
                )}
                <span style={{ position: "relative", zIndex: 1 }}>
                  {generateContent.isPending
                    ? t("studio_generate_generating")
                    : `✦ ${t("studio_generate_button")}`}
                </span>
              </button>
            </div>
            {generateContent.isError && (
              <p style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}>
                {t("studio_generate_error")}
              </p>
            )}
            {generatedItem && (
              <div className="ais-generated-result">
                <div className="ais-generated-label">✦ {t("studio_generate_generated")}</div>
                {generatedItem.generatedHook && (
                  <div className="ais-generated-hook">{generatedItem.generatedHook}</div>
                )}
                {generatedItem.generatedCaption && (
                  <div className="ais-generated-caption">
                    {generatedItem.generatedCaption.slice(0, 200)}...
                  </div>
                )}
                <div className="ais-generated-actions">
                  {generatedItem.generatedHook && (
                    <button
                      className="ais-copy-btn"
                      onClick={() => copyToClipboard(generatedItem.generatedHook!, "hook")}
                    >
                      {copiedHook ? "✓ Copied" : "Copy Hook"}
                    </button>
                  )}
                  {generatedItem.generatedCaption && (
                    <button
                      className="ais-copy-btn"
                      onClick={() => copyToClipboard(generatedItem.generatedCaption!, "caption")}
                    >
                      {copiedCaption ? "✓ Copied" : "Copy Caption"}
                    </button>
                  )}
                  <button className="ais-queue-btn" onClick={handleAddToQueue}>
                    + {t("studio_queue_add")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "History" && <HistoryTab />}
    </div>
  );
}

function AnalysisTabContent({
  reel,
  analysis,
  onRunAnalysis,
  isAnalyzing,
}: {
  reel: ReelDetail;
  analysis: ReelAnalysis | null;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="ais-panel-body">
      <div className="ais-section-label">{t("studio_panel_metrics")}</div>
      <div className="ais-metrics-2">
        {[
          { l: t("studio_panel_views"), v: fmtNum(reel.views) },
          { l: t("studio_panel_likes"), v: fmtNum(reel.likes) },
          { l: t("studio_panel_comments"), v: fmtNum(reel.comments) },
          { l: t("studio_panel_engagement"), v: `${reel.engagementRate ?? 0}%` },
        ].map((m) => (
          <div className="ais-metric-tile" key={m.l}>
            <div className="ais-metric-tile-lbl">{m.l}</div>
            <div className="ais-metric-tile-val">{m.v}</div>
          </div>
        ))}
      </div>

      {reel.hook && (
        <>
          <div className="ais-section-label">{t("studio_panel_hook")}</div>
          <div className="ais-hook-display">{reel.hook}</div>
        </>
      )}

      {reel.caption && (
        <>
          <div className="ais-section-label">{t("studio_panel_caption")}</div>
          <div className="ais-caption-display">{reel.caption.slice(0, 180)}...</div>
        </>
      )}

      {reel.audioName && (
        <>
          <div className="ais-section-label">{t("studio_panel_audio")}</div>
          <div className="ais-audio-row">
            <div className="ais-audio-icon">♪</div>
            <div>
              <div className="ais-audio-name">{reel.audioName}</div>
              {reel.audioId && (
                <div className="ais-audio-id">{reel.audioId}</div>
              )}
            </div>
          </div>
        </>
      )}

      {analysis ? (
        <>
          <div className="ais-section-label">{t("studio_panel_aiAnalysis")}</div>
          <AnalysisTagsStrip analysis={analysis} />
          {analysis.remixSuggestion && (
            <>
              <div className="ais-section-label">{t("studio_panel_remixSuggestion")}</div>
              <div className="ais-remix-display">
                <div className="ais-remix-label">AI</div>
                {analysis.remixSuggestion}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="ais-section-label">{t("studio_panel_aiAnalysis")}</div>
          <button
            className="ais-run-analysis-btn"
            onClick={onRunAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>⟳ {t("studio_panel_analyzing")}</>
            ) : (
              <>✦ {t("studio_panel_runAnalysis")}</>
            )}
          </button>
        </>
      )}
    </div>
  );
}

function AnalysisTagsStrip({ analysis }: { analysis: ReelAnalysis | null }) {
  if (!analysis) return null;

  const tags = [
    { label: analysis.hookCategory, type: "category" },
    ...(analysis.emotionalTrigger?.split(",").map((e) => ({ label: e.trim(), type: "emotion" })) ?? []),
    { label: analysis.formatPattern, type: "format" },
    { label: analysis.ctaType, type: "cta" },
  ].filter((t) => t.label);

  if (tags.length === 0) return null;

  return (
    <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 4 }}>
      {tags.map((tag, i) => {
        const bg = tag.type === "category"
          ? HOOK_CATEGORY_COLORS[tag.label!] ?? "rgba(255,255,255,0.06)"
          : "rgba(255,255,255,0.06)";
        const color = tag.type === "category"
          ? HOOK_CATEGORY_TEXT[tag.label!] ?? "#E2E8F0"
          : "rgba(226,232,240,0.5)";
        return (
          <span
            key={i}
            className="ais-analysis-tag"
            style={{ background: bg, color, border: `1px solid ${color}30` }}
          >
            {tag.label}
          </span>
        );
      })}
    </div>
  );
}

function HistoryTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useGenerationHistoryInPanel();

  if (isLoading) {
    return (
      <div className="ais-panel-body">
        {[1, 2, 3].map((i) => (
          <div key={i} className="ais-skeleton" style={{ height: 60, marginBottom: 8 }} />
        ))}
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="ais-panel-body">
        <div className="ais-empty">
          <div className="ais-empty-icon">✦</div>
          <div className="ais-empty-title">{t("studio_history_empty")}</div>
          <div className="ais-empty-sub">{t("studio_history_emptySub")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ais-panel-body">
      {items.map((item) => (
        <div key={item.id} className="ais-history-item">
          <div className="ais-history-hook">
            {item.generatedHook ?? t("studio_history_noHook")}
          </div>
          <div className="ais-history-meta">
            <span className={`ais-status-badge ais-status-${item.status}`}>
              {item.status}
            </span>
            <span>{new Date(item.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function useGenerationHistoryInPanel() {
  return useGenerationHistory();
}
