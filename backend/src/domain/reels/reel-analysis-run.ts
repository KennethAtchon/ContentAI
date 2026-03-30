import { generateText, tool } from "ai";
import { getModel, getModelInfo, loadPrompt } from "../../lib/aiClient";
import { trackAiCall } from "../../lib/ai/helpers";
import { debugLog } from "../../utils/debug/debug";
import type { ReelAnalysis } from "../../infrastructure/database/drizzle/schema";
import type { IReelsRepository } from "./reels.repository";
import {
  reelAnalysisToolSchema,
  type ReelAnalysisToolArgs,
} from "./reel-analysis.schemas";

/**
 * AI reel breakdown + upsert into `reel_analyses`. DB only via `IReelsRepository`.
 */
export async function runReelAiAnalysis(
  repo: IReelsRepository,
  reelId: number,
  userId?: string,
): Promise<ReelAnalysis> {
  const reel = await repo.findReelById(reelId);
  if (!reel) throw new Error(`Reel ${reelId} not found`);

  const system = loadPrompt("reel-analysis");
  const userContent = `Niche ID: ${reel.nicheId}
Hook: ${reel.hook ?? "(none)"}
Caption: ${reel.caption ?? "(none)"}
Audio: ${reel.audioName ?? "(none)"}
Views: ${reel.views} | Engagement: ${reel.engagementRate ?? "unknown"}%

Analyze this viral reel and call the analyze_reel tool with your findings.`;

  const { providerId: provider, model } = await getModelInfo("analysis");
  const resolvedModel = await getModel("analysis");
  const startMs = Date.now();

  let savedAnalysis: ReelAnalysis | null = null;

  const analyzeTool = tool({
    description:
      "Record the structured analysis of a viral reel. Call this once after completing the analysis.",
    inputSchema: reelAnalysisToolSchema,
    execute: async (args: ReelAnalysisToolArgs): Promise<string> => {
      const row = await repo.upsertReelAnalysis({
        ...args,
        reelId,
        analysisModel: model,
        rawResponse: args as unknown as Record<string, unknown>,
      });
      savedAnalysis = row;
      return "Analysis saved.";
    },
  });

  const { usage } = await generateText({
    model: resolvedModel,
    system,
    messages: [{ role: "user", content: userContent }],
    tools: { analyze_reel: analyzeTool },
    toolChoice: "required",
    maxOutputTokens: 1024,
  });

  await trackAiCall({
    userId,
    providerId: provider,
    model,
    featureType: "reel_analysis",
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    durationMs: Date.now() - startMs,
    metadata: { reelId },
  });

  if (!savedAnalysis) {
    throw new Error("AI did not call the analyze_reel tool");
  }

  debugLog.info("Reel analysis completed", {
    service: "reel-analysis-run",
    operation: "runReelAiAnalysis",
    reelId,
    provider,
    model,
  });

  return savedAnalysis;
}
