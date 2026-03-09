import "@/styles/studio.css";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import { useGenerateContent, useGenerationHistory, useQueueContent } from "@/features/generation/hooks/use-generation";
import { useReels } from "@/features/reels/hooks/use-reels";
import type { GeneratedContent } from "@/features/reels/types/reel.types";

function GeneratePage() {
  const { t } = useTranslation();
  const [niche, setNiche] = useState("personal finance");
  const [inputNiche, setInputNiche] = useState("personal finance");
  const [selectedReelId, setSelectedReelId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [outputType, setOutputType] = useState<"full" | "hook" | "caption">("full");
  const [result, setResult] = useState<GeneratedContent | null>(null);

  const { data: reelsData } = useReels(niche);
  const reels = reelsData?.reels ?? [];

  const { data: historyData } = useGenerationHistory();
  const history = historyData?.items ?? [];

  const generateContent = useGenerateContent();
  const queueContent = useQueueContent();

  const handleScan = () => setNiche(inputNiche);

  const handleGenerate = async () => {
    if (!prompt.trim() || !selectedReelId) return;
    try {
      const res = await generateContent.mutateAsync({
        sourceReelId: selectedReelId,
        prompt,
        outputType,
      });
      setResult(res.content);
      setPrompt("");
    } catch {
      // error shown in UI
    }
  };

  const handleQueue = async () => {
    if (!result) return;
    await queueContent.mutateAsync({ contentId: result.id });
    setResult(null);
  };

  return (
    <AuthGuard authType="user">
      <div className="ais-root">
        <StudioTopBar
          niche={inputNiche}
          onNicheChange={setInputNiche}
          onScan={handleScan}
          activeTab="generate"
        />

        <div
          className="ais-layout"
          style={{ gridTemplateColumns: "280px 1fr 320px" }}
        >
          {/* Left: reel picker */}
          <div className="ais-sidebar">
            <div className="ais-sidebar-header">
              {t("studio_sidebar_sourceReels")}
              <span className="ais-sidebar-count">{reels.length}</span>
            </div>
            <div className="ais-asset-list">
              {reels.map((reel) => (
                <button
                  key={reel.id}
                  className={`ais-asset ${selectedReelId === reel.id ? "active" : ""}`}
                  onClick={() => setSelectedReelId(reel.id)}
                >
                  <div className="ais-asset-thumb">
                    {reel.thumbnailEmoji ?? "🎬"}
                  </div>
                  <div className="ais-asset-info">
                    <div className="ais-asset-user">{reel.username}</div>
                    <div className="ais-asset-stat">
                      {reel.hasAnalysis ? "✦ Analyzed" : "Not analyzed"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Center: generation workspace */}
          <div className="ais-canvas" style={{ padding: 32, overflow: "auto" }}>
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              <h2
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#F1F5F9",
                  marginBottom: 8,
                }}
              >
                ✦ {t("studio_generate_label")}
              </h2>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(226,232,240,0.35)",
                  marginBottom: 24,
                }}
              >
                {t("studio_generate_description")}
              </p>

              {!selectedReelId && (
                <div
                  style={{
                    background: "rgba(129,140,248,0.06)",
                    border: "1px dashed rgba(129,140,248,0.25)",
                    borderRadius: 12,
                    padding: 20,
                    textAlign: "center",
                    marginBottom: 20,
                    fontSize: 12,
                    color: "rgba(226,232,240,0.4)",
                  }}
                >
                  {t("studio_generate_selectReel")}
                </div>
              )}

              {/* Output type selector */}
              <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
                {(["full", "hook", "caption"] as const).map((type) => (
                  <button
                    key={type}
                    className={`ais-filter-btn ${outputType === type ? "active" : ""}`}
                    onClick={() => setOutputType(type)}
                  >
                    {t(`studio_generate_type_${type}`)}
                  </button>
                ))}
              </div>

              <textarea
                className="ais-generate-input"
                style={{ minHeight: 100 }}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("studio_generate_placeholder")}
                disabled={!selectedReelId}
              />

              <div className="ais-generate-row">
                <button
                  className="ais-generate-btn"
                  onClick={handleGenerate}
                  disabled={
                    generateContent.isPending || !prompt.trim() || !selectedReelId
                  }
                >
                  {generateContent.isPending && <div className="ais-generating-bar" />}
                  <span style={{ position: "relative", zIndex: 1 }}>
                    {generateContent.isPending
                      ? t("studio_generate_generating")
                      : `✦ ${t("studio_generate_button")}`}
                  </span>
                </button>
              </div>

              {generateContent.isError && (
                <p style={{ fontSize: 11, color: "#EF4444", marginTop: 8 }}>
                  {t("studio_generate_error")}
                </p>
              )}

              {result && (
                <div className="ais-generated-result" style={{ marginTop: 20 }}>
                  <div className="ais-generated-label">✦ {t("studio_generate_generated")}</div>
                  {result.generatedHook && (
                    <div className="ais-generated-hook">{result.generatedHook}</div>
                  )}
                  {result.generatedCaption && (
                    <div className="ais-generated-caption">{result.generatedCaption}</div>
                  )}
                  {result.generatedScript && (
                    <ul style={{ marginTop: 8, paddingLeft: 16 }}>
                      {(JSON.parse(result.generatedScript) as string[]).map(
                        (note, i) => (
                          <li
                            key={i}
                            style={{
                              fontSize: 11,
                              color: "rgba(226,232,240,0.5)",
                              marginBottom: 4,
                            }}
                          >
                            {note}
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                  <div className="ais-generated-actions">
                    {result.generatedHook && (
                      <button
                        className="ais-copy-btn"
                        onClick={() =>
                          navigator.clipboard.writeText(result.generatedHook!)
                        }
                      >
                        Copy Hook
                      </button>
                    )}
                    {result.generatedCaption && (
                      <button
                        className="ais-copy-btn"
                        onClick={() =>
                          navigator.clipboard.writeText(result.generatedCaption!)
                        }
                      >
                        Copy Caption
                      </button>
                    )}
                    <button className="ais-queue-btn" onClick={handleQueue}>
                      + {t("studio_queue_add")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: history */}
          <div className="ais-ai-panel">
            <div
              className="ais-panel-tabs"
              style={{ justifyContent: "center", padding: "10px 16px" }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "#818CF8" }}>
                {t("studio_panel_history")}
              </span>
            </div>
            <div className="ais-panel-body">
              {history.length === 0 ? (
                <div className="ais-empty">
                  <div className="ais-empty-icon">✦</div>
                  <div className="ais-empty-title">{t("studio_history_empty")}</div>
                </div>
              ) : (
                history.map((item) => (
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

export const Route = createFileRoute("/studio/generate")({
  component: GeneratePage,
});
