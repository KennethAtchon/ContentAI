import { z } from "zod";

/** Structured output from the reel-analysis AI tool (persisted to `reel_analyses`). */
export const reelAnalysisToolSchema = z.object({
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
    .describe(
      "1-10: how easily any creator can replicate this (10 = very easy)",
    ),
  replicabilityNotes: z
    .string()
    .nullable()
    .describe("Explanation of the replicability score"),
});

export type ReelAnalysisToolArgs = z.infer<typeof reelAnalysisToolSchema>;

export type ReelAnalysisUpsertParams = ReelAnalysisToolArgs & {
  reelId: number;
  analysisModel: string;
  rawResponse: Record<string, unknown>;
};
