import { db } from "../db/db";
import {
  reels,
  reelAnalyses,
} from "../../infrastructure/database/drizzle/schema";
import type { ReelAnalysis } from "../../infrastructure/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { generateText, tool } from "ai";
import { z } from "zod";
import { getModel, getModelInfo, loadPrompt } from "../../lib/aiClient";
import { trackAiCall } from "../../lib/ai/helpers";
import { debugLog } from "../../utils/debug/debug";

const analysisSchema = z.object({
  hookPattern: z
    .string()
    .describe("Concise label for the hook formula, e.g. 'If X Stop Y'"),
  hookCategory: z
    .enum([
      "Warning",
      "Authority",
      "Question",
      "Curiosity",
      "List",
      "POV",
      "MythBust",
      "SocialProof",
    ])
    .describe("Category of the hook"),
  emotionalTrigger: z
    .string()
    .describe(
      "Primary emotions triggered, comma-separated from: Fear, Curiosity, Aspiration, Authority, Shock, FOMO, Relatability",
    ),
  formatPattern: z
    .enum([
      "Fast-cut talking head",
      "Single-shot",
      "B-roll overlay",
      "Text-only",
      "Reaction",
      "Storytime",
      "Tutorial",
      "Transformation",
    ])
    .describe("Video format pattern"),
  ctaType: z
    .enum(["Save", "Comment", "Share", "Tag", "Follow", "Link in bio"])
    .describe("Primary call to action"),
  captionFramework: z
    .string()
    .describe(
      "Caption structure pattern, e.g. 'Problem → Proof → Solution → CTA'",
    ),
  curiosityGapStyle: z
    .string()
    .nullable()
    .describe("How the hook creates an open loop, or null if not applicable"),
  remixSuggestion: z
    .string()
    .describe(
      "Specific, actionable suggestion to adapt this structure for a new variation",
    ),
  shotBreakdown: z
    .array(
      z.object({
        timestamp: z.string().describe("Time range, e.g. '0-3s'"),
        description: z.string().describe("What happens in this shot"),
        textOverlay: z
          .string()
          .nullable()
          .describe("On-screen text if any, or null"),
      }),
    )
    .min(3)
    .max(6)
    .nullable()
    .describe("3-6 key moments of the video"),
  engagementDrivers: z
    .array(z.string())
    .nullable()
    .describe(
      "Specific factors driving engagement, e.g. 'trending_audio', 'pattern_interrupt'",
    ),
  replicabilityScore: z
    .number()
    .int()
    .min(1)
    .max(10)
    .nullable()
    .describe("1-10: how easily any creator can replicate this (10 = very easy)"),
  replicabilityNotes: z
    .string()
    .nullable()
    .describe("Explanation of the replicability score"),
});

type AnalysisArgs = z.infer<typeof analysisSchema>;

export async function analyzeReel(
  reelId: number,
  userId?: string,
): Promise<ReelAnalysis> {
  const [reel] = await db.select().from(reels).where(eq(reels.id, reelId));
  if (!reel) throw new Error(`Reel ${reelId} not found`);

  const system = loadPrompt("reel-analysis");
  const userContent = `Niche ID: ${reel.nicheId}
Hook: ${reel.hook ?? "(none)"}
Caption: ${reel.caption ?? "(none)"}
Audio: ${reel.audioName ?? "(none)"}
Views: ${reel.views} | Engagement: ${reel.engagementRate ?? "unknown"}%

Analyze this viral reel and call the analyze_reel tool with your findings.`;

  const { provider, model } = getModelInfo("analysis");
  const resolvedModel = getModel("analysis");
  const startMs = Date.now();

  let savedAnalysis: ReelAnalysis | null = null;

  const analyzeTool = tool({
    description:
      "Record the structured analysis of a viral reel. Call this once after completing the analysis.",
    inputSchema: analysisSchema,
    execute: async (args: AnalysisArgs): Promise<string> => {
      const [analysis] = await db
        .insert(reelAnalyses)
        .values({
          reelId,
          hookPattern: args.hookPattern,
          hookCategory: args.hookCategory,
          emotionalTrigger: args.emotionalTrigger,
          formatPattern: args.formatPattern,
          ctaType: args.ctaType,
          captionFramework: args.captionFramework,
          curiosityGapStyle: args.curiosityGapStyle,
          remixSuggestion: args.remixSuggestion,
          shotBreakdown: args.shotBreakdown as unknown as Record<
            string,
            unknown
          >,
          engagementDrivers: args.engagementDrivers as unknown as Record<
            string,
            unknown
          >,
          replicabilityScore: args.replicabilityScore,
          replicabilityNotes: args.replicabilityNotes,
          analysisModel: model,
          rawResponse: args as unknown as Record<string, unknown>,
        })
        .onConflictDoUpdate({
          target: reelAnalyses.reelId,
          set: {
            hookPattern: args.hookPattern,
            hookCategory: args.hookCategory,
            emotionalTrigger: args.emotionalTrigger,
            formatPattern: args.formatPattern,
            ctaType: args.ctaType,
            captionFramework: args.captionFramework,
            curiosityGapStyle: args.curiosityGapStyle,
            remixSuggestion: args.remixSuggestion,
            shotBreakdown: args.shotBreakdown as unknown as Record<
              string,
              unknown
            >,
            engagementDrivers: args.engagementDrivers as unknown as Record<
              string,
              unknown
            >,
            replicabilityScore: args.replicabilityScore,
            replicabilityNotes: args.replicabilityNotes,
            analysisModel: model,
            rawResponse: args as unknown as Record<string, unknown>,
          },
        })
        .returning();

      savedAnalysis = analysis;
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
    provider,
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
    service: "reel-analyzer",
    operation: "analyzeReel",
    reelId,
    provider,
    model,
  });

  return savedAnalysis;
}
