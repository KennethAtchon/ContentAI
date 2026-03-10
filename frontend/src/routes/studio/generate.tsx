import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";
import { AuthGuard } from "@/features/auth/components/auth-guard";
import { StudioTopBar } from "@/features/studio/components/StudioTopBar";
import {
  useGenerateContent,
  useGenerationHistory,
  useQueueContent,
} from "@/features/generation/hooks/use-generation";
import { useReels } from "@/features/reels/hooks/use-reels";
import type { GeneratedContent } from "@/features/reels/types/reel.types";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-white/[0.06] text-slate-200/40",
  queued: "bg-amber-400/15 text-amber-400",
  posted: "bg-green-400/15 text-green-400",
  failed: "bg-red-400/15 text-red-400",
};

function GeneratePage() {
  const { t } = useTranslation();
  const [niche] = useState("personal finance");
  const [selectedReelId, setSelectedReelId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [outputType, setOutputType] = useState<"full" | "hook" | "caption">(
    "full"
  );
  const [result, setResult] = useState<GeneratedContent | null>(null);

  const { data: reelsData } = useReels(niche);
  const { data: historyData } = useGenerationHistory();
  const reels = reelsData?.reels ?? [];
  const history = historyData?.items ?? [];

  const generateContent = useGenerateContent();
  const queueContent = useQueueContent();

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
      /* mutation error state handles UI */
    }
  };

  return (
    <AuthGuard authType="user">
      <div className="h-screen bg-studio-bg text-studio-fg font-studio grid grid-rows-[48px_1fr] overflow-hidden">
        <StudioTopBar variant="studio" activeTab="generate" />

        <div
          className="grid overflow-hidden"
          style={{ gridTemplateColumns: "280px 1fr 320px" }}
        >
          {/* Left: reel picker */}
          <aside className="bg-studio-surface border-r border-white/[0.05] flex flex-col overflow-hidden">
            <div className="px-3.5 pt-3 pb-2 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-semibold tracking-[1.5px] uppercase text-slate-200/25">
                {t("studio_sidebar_sourceReels")}
              </span>
              <span className="bg-studio-accent/15 text-studio-accent text-[9px] font-bold px-1.5 py-px rounded-full">
                {reels.length}
              </span>
            </div>
            <div className="overflow-y-auto flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {reels.map((reel) => {
                const isActive = selectedReelId === reel.id;
                return (
                  <button
                    key={reel.id}
                    onClick={() => setSelectedReelId(reel.id)}
                    className={cn(
                      "w-full px-3.5 py-2.5 flex items-center gap-2.5 text-left",
                      "border-0 border-l-2 transition-colors duration-100 font-studio cursor-pointer",
                      isActive
                        ? "bg-studio-accent/[0.08] border-l-studio-accent"
                        : "bg-transparent border-l-transparent hover:bg-white/[0.03]"
                    )}
                  >
                    <div
                      className={cn(
                        "w-[34px] h-[34px] rounded-[6px] flex items-center justify-center text-base shrink-0",
                        isActive ? "bg-studio-accent/15" : "bg-white/[0.06]"
                      )}
                    >
                      {reel.thumbnailEmoji ?? "🎬"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-studio-fg truncate">
                        {reel.username}
                      </p>
                      <p className="text-[10px] text-slate-200/35 mt-px">
                        {reel.hasAnalysis ? (
                          <span className="text-studio-accent">✦ Analyzed</span>
                        ) : (
                          "Not analyzed"
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Center: generation workspace */}
          <main className="flex flex-col overflow-y-auto bg-studio-bg px-8 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="max-w-[560px] mx-auto w-full">
              <h2 className="text-[20px] font-bold text-slate-100 mb-1.5">
                ✦ {t("studio_generate_label")}
              </h2>
              <p className="text-[12px] text-slate-200/35 mb-6">
                {t("studio_generate_description")}
              </p>

              {!selectedReelId && (
                <div className="bg-studio-accent/[0.06] border border-dashed border-studio-accent/25 rounded-xl p-5 text-center mb-5 text-[12px] text-slate-200/40">
                  {t("studio_generate_selectReel")}
                </div>
              )}

              {/* Output type pills */}
              <div className="flex gap-1.5 mb-4">
                {(["full", "hook", "caption"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setOutputType(type)}
                    className={cn(
                      "text-[11px] font-medium px-3 py-1.5 rounded-full border cursor-pointer font-studio transition-all duration-150",
                      outputType === type
                        ? "bg-studio-accent/15 text-studio-accent border-studio-accent/30"
                        : "bg-white/[0.03] text-slate-200/40 border-white/[0.08] hover:text-slate-200/70"
                    )}
                  >
                    {t(`studio_generate_type_${type}`)}
                  </button>
                ))}
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("studio_generate_placeholder")}
                disabled={!selectedReelId}
                className={cn(
                  "w-full bg-white/[0.04] border border-white/[0.08] rounded-[10px]",
                  "text-studio-fg text-[12px] px-3 py-2.5 outline-none resize-none min-h-[100px] font-studio box-border",
                  "placeholder:text-slate-200/20 transition-colors duration-200",
                  "focus:border-studio-ring/40 disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              />

              <div className="mt-3">
                <button
                  onClick={handleGenerate}
                  disabled={
                    generateContent.isPending ||
                    !prompt.trim() ||
                    !selectedReelId
                  }
                  className={cn(
                    "w-full relative overflow-hidden rounded-lg border-0",
                    "bg-gradient-to-br from-studio-accent to-studio-purple",
                    "text-white text-[13px] font-bold py-3 cursor-pointer font-studio transition-opacity",
                    "hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  {generateContent.isPending && (
                    <div className="studio-gen-bar" />
                  )}
                  <span className="relative z-10">
                    {generateContent.isPending
                      ? t("studio_generate_generating")
                      : `✦ ${t("studio_generate_button")}`}
                  </span>
                </button>
                {generateContent.isError && (
                  <p className="text-[11px] text-red-400 mt-2">
                    {t("studio_generate_error")}
                  </p>
                )}
              </div>

              {result && (
                <div className="mt-5 bg-studio-accent/[0.08] border border-studio-accent/20 rounded-xl p-4">
                  <p className="text-[9px] font-bold tracking-[1.5px] uppercase text-studio-accent mb-3">
                    ✦ {t("studio_generate_generated")}
                  </p>
                  {result.generatedHook && (
                    <p className="text-[15px] font-bold text-slate-100 leading-[1.4] mb-2">
                      {result.generatedHook}
                    </p>
                  )}
                  {result.generatedCaption && (
                    <p className="text-[12px] text-slate-200/55 leading-[1.6] mb-3">
                      {result.generatedCaption}
                    </p>
                  )}
                  {result.generatedScript && (
                    <ul className="list-disc pl-5 space-y-1 mb-3">
                      {(JSON.parse(result.generatedScript) as string[]).map(
                        (note, i) => (
                          <li key={i} className="text-[11px] text-slate-200/50">
                            {note}
                          </li>
                        )
                      )}
                    </ul>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {result.generatedHook && (
                      <CopyBtn
                        onClick={() =>
                          navigator.clipboard.writeText(result.generatedHook!)
                        }
                      >
                        Copy Hook
                      </CopyBtn>
                    )}
                    {result.generatedCaption && (
                      <CopyBtn
                        onClick={() =>
                          navigator.clipboard.writeText(
                            result.generatedCaption!
                          )
                        }
                      >
                        Copy Caption
                      </CopyBtn>
                    )}
                    <button
                      onClick={async () => {
                        await queueContent.mutateAsync({
                          contentId: result.id,
                        });
                        setResult(null);
                      }}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg border-0 bg-gradient-to-br from-studio-accent to-studio-purple text-white cursor-pointer font-studio hover:opacity-85 transition-opacity"
                    >
                      + {t("studio_queue_add")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Right: history */}
          <aside className="bg-studio-surface border-l border-white/[0.05] flex flex-col overflow-hidden">
            <div className="flex items-center justify-center px-4 py-2.5 border-b border-white/[0.05] shrink-0">
              <span className="text-[11px] font-semibold text-studio-accent">
                {t("studio_panel_history")}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {history.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <span className="text-[36px] opacity-40">✦</span>
                  <p className="text-[13px] font-semibold text-slate-200/40">
                    {t("studio_history_empty")}
                  </p>
                </div>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white/[0.03] border border-white/[0.06] rounded-[10px] p-3 cursor-pointer transition-colors hover:border-studio-accent/30"
                  >
                    <p className="text-[12px] font-semibold text-studio-fg leading-[1.4] mb-1 line-clamp-2">
                      {item.generatedHook ?? t("studio_history_noHook")}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-200/30">
                      <span
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-px rounded-full uppercase tracking-[0.5px]",
                          STATUS_STYLES[item.status] ?? STATUS_STYLES.draft
                        )}
                      >
                        {item.status}
                      </span>
                      <span>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </AuthGuard>
  );
}

function CopyBtn({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.05] text-slate-200/60 cursor-pointer font-studio transition-all hover:bg-white/10 hover:text-studio-fg"
    >
      {children}
    </button>
  );
}

export const Route = createFileRoute("/studio/generate")({
  component: GeneratePage,
});
