import { db } from "../db/db";
import {
  reels,
  reelAnalyses,
  generatedContent,
  queueItems,
} from "../../infrastructure/database/drizzle/schema";
import type { GeneratedContent } from "../../infrastructure/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { callAi, loadPrompt } from "../../lib/aiClient";
import { debugLog } from "../../utils/debug/debug";

export type OutputType = "hook" | "caption" | "full";

interface GenerateParams {
  reelId: number;
  prompt: string;
  userId: string;
  outputType: OutputType;
}

interface GenerationResult {
  hook?: string;
  caption?: string;
  scriptNotes?: string[];
}

export async function generateContent(
  params: GenerateParams,
): Promise<GeneratedContent> {
  const { reelId, prompt, userId, outputType } = params;

  const [reel] = await db.select().from(reels).where(eq(reels.id, reelId));
  if (!reel) throw new Error(`Reel ${reelId} not found`);

  const [analysis] = await db
    .select()
    .from(reelAnalyses)
    .where(eq(reelAnalyses.reelId, reelId));

  let parsed: GenerationResult;
  let usedModel: string;

  if (outputType === "hook") {
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
      debugLog.error("Failed to parse AI generation response", {
        service: "content-generator",
        operation: "generateContent",
        reelId,
        rawText,
      });
      throw new Error("AI returned invalid JSON for content generation");
    }
  }

  const [content] = await db
    .insert(generatedContent)
    .values({
      userId,
      sourceReelId: reelId,
      prompt,
      generatedHook: parsed.hook ?? null,
      generatedCaption: parsed.caption ?? null,
      generatedScript: parsed.scriptNotes
        ? JSON.stringify(parsed.scriptNotes)
        : null,
      outputType,
      model: usedModel,
      status: "draft",
    })
    .returning();

  // Auto-enroll every generated draft in the pipeline queue.
  await db.insert(queueItems).values({
    userId,
    generatedContentId: content.id,
    status: "draft",
  }).onConflictDoNothing();

  return content;
}
