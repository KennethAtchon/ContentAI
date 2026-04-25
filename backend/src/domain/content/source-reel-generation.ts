import { systemLogger } from "@/utils/system/system-logger";
import { callAi, loadPrompt } from "../../services/ai/ai-client";
import type { IContentRepository } from "./content.repository";

export type SourceReelOutputType = "hook_only" | "caption_only" | "full_script";

interface GenerationResult {
  hook?: string;
  caption?: string;
  scriptNotes?: string[];
}

/**
 * AI + persistence for POST /api/generation — source reel → generatedContent + queue row.
 * DB access only via `IContentRepository` (transactional enrollment).
 */
export async function generateContentFromSourceReel(
  content: IContentRepository,
  params: {
    reelId: number;
    prompt: string;
    userId: string;
    outputType: SourceReelOutputType;
  },
): ReturnType<
  IContentRepository["createReelGeneratedDraftWithQueueEnrollment"]
> {
  const { reelId, prompt, userId, outputType } = params;

  const row = await content.fetchReelAndAnalysisForGeneration(reelId);
  if (!row) throw new Error(`Reel ${reelId} not found`);

  const { reel, analysis } = row;

  let parsed: GenerationResult;
  let usedModel: string;

  if (outputType === "hook_only") {
    const system = loadPrompt("hook-writer");
    const userContent = `Niche ID: ${reel.nicheId}
Hook Pattern: ${analysis?.hookPattern ?? "Unknown"} (${analysis?.hookCategory ?? "Unknown"})
Emotional Trigger: ${analysis?.emotionalTrigger ?? "Unknown"}

User instruction: ${prompt}

Generate 5 hook variations.`;

    const { text: rawText, model } = await callAi({
      system,
      userContent,
      maxTokens: 512,
      modelTier: "analysis",
      featureType: "reel_generation",
      userId,
      metadata: { reelId, outputType },
    });

    usedModel = model;

    try {
      const hooks = JSON.parse(rawText) as string[];
      parsed = { hook: hooks[0], scriptNotes: hooks.slice(1) };
    } catch {
      throw new Error("AI returned invalid JSON for hook generation");
    }
  } else {
    const system = loadPrompt("remix-generation");
    const userContent = `Source Reel Analysis:
- Niche ID: ${reel.nicheId}
- Hook Pattern: ${analysis?.hookPattern ?? "Unknown"} (${analysis?.hookCategory ?? "Unknown"})
- Emotional Trigger: ${analysis?.emotionalTrigger ?? "Unknown"}
- Format: ${analysis?.formatPattern ?? "Unknown"}
- CTA Type: ${analysis?.ctaType ?? "Unknown"}
- Caption Framework: ${analysis?.captionFramework ?? "Unknown"}

Original Hook (for structural reference only — do NOT copy):
"${reel.hook ?? ""}"

User Instruction:
${prompt}

Generate an original variation following the same viral structure.`;

    const { text: rawText, model } = await callAi({
      system,
      userContent,
      maxTokens: 1024,
      modelTier: "generation",
      featureType: "reel_generation",
      userId,
      metadata: { reelId, outputType },
    });

    usedModel = model;

    try {
      parsed = JSON.parse(rawText) as GenerationResult;
    } catch {
      systemLogger.error("Failed to parse AI generation response", {
        service: "source-reel-generation",
        operation: "generateContentFromSourceReel",
        reelId,
        rawText,
      });
      throw new Error("AI returned invalid JSON for content generation");
    }
  }

  return content.createReelGeneratedDraftWithQueueEnrollment({
    userId,
    reelId,
    prompt,
    outputType,
    generatedHook: parsed.hook ?? null,
    postCaption: parsed.caption ?? null,
    generatedScript: parsed.scriptNotes
      ? JSON.stringify(parsed.scriptNotes)
      : null,
    model: usedModel,
  });
}
