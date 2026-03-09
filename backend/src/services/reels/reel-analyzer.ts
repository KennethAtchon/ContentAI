import { db } from "../db/db";
import { reels, reelAnalyses } from "../../infrastructure/database/drizzle/schema";
import type { ReelAnalysis } from "../../infrastructure/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { claude, loadPrompt } from "../../lib/claude";
import { ANALYSIS_MODEL } from "../../utils/config/envUtil";
import { debugLog } from "../../utils/debug/debug";

interface AnalysisResult {
  hookPattern: string;
  hookCategory: string;
  emotionalTrigger: string;
  formatPattern: string;
  ctaType: string;
  captionFramework: string;
  curiosityGapStyle: string | null;
  remixSuggestion: string;
}

export async function analyzeReel(reelId: number): Promise<ReelAnalysis> {
  const [reel] = await db.select().from(reels).where(eq(reels.id, reelId));
  if (!reel) throw new Error(`Reel ${reelId} not found`);

  const systemPrompt = loadPrompt("reel-analysis");

  const userMessage = `Niche: ${reel.niche}
Hook: ${reel.hook ?? "(none)"}
Caption: ${reel.caption ?? "(none)"}
Audio: ${reel.audioName ?? "(none)"}
Views: ${reel.views} | Engagement: ${reel.engagementRate ?? "unknown"}%

Analyze this viral reel and return structured JSON.`;

  const message = await claude.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const rawText =
    message.content[0].type === "text" ? message.content[0].text : "";

  let parsed: AnalysisResult;
  try {
    parsed = JSON.parse(rawText) as AnalysisResult;
  } catch {
    debugLog.error("Failed to parse AI analysis response", {
      service: "reel-analyzer",
      operation: "analyzeReel",
      reelId,
      rawText,
    });
    throw new Error("AI returned invalid JSON for reel analysis");
  }

  const [analysis] = await db
    .insert(reelAnalyses)
    .values({
      reelId,
      hookPattern: parsed.hookPattern,
      hookCategory: parsed.hookCategory,
      emotionalTrigger: parsed.emotionalTrigger,
      formatPattern: parsed.formatPattern,
      ctaType: parsed.ctaType,
      captionFramework: parsed.captionFramework,
      curiosityGapStyle: parsed.curiosityGapStyle,
      remixSuggestion: parsed.remixSuggestion,
      analysisModel: ANALYSIS_MODEL,
      rawResponse: rawText as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: reelAnalyses.reelId,
      set: {
        hookPattern: parsed.hookPattern,
        hookCategory: parsed.hookCategory,
        emotionalTrigger: parsed.emotionalTrigger,
        formatPattern: parsed.formatPattern,
        ctaType: parsed.ctaType,
        captionFramework: parsed.captionFramework,
        curiosityGapStyle: parsed.curiosityGapStyle,
        remixSuggestion: parsed.remixSuggestion,
        analysisModel: ANALYSIS_MODEL,
        rawResponse: rawText as unknown as Record<string, unknown>,
      },
    })
    .returning();

  return analysis;
}
