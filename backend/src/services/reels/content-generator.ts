import { db } from "../db/db";
import {
  reels,
  reelAnalyses,
  generatedContent,
} from "../../infrastructure/database/drizzle/schema";
import type { GeneratedContent } from "../../infrastructure/database/drizzle/schema";
import { eq } from "drizzle-orm";
import { claude, loadPrompt } from "../../lib/claude";
import { GENERATION_MODEL, ANALYSIS_MODEL } from "../../utils/config/envUtil";
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

  let systemPrompt: string;
  let userMessage: string;
  let parsed: GenerationResult;

  if (outputType === "hook") {
    systemPrompt = loadPrompt("hook-writer");
    userMessage = `Niche: ${reel.niche}
Hook Pattern: ${analysis?.hookPattern ?? "Unknown"} (${analysis?.hookCategory ?? "Unknown"})
Emotional Trigger: ${analysis?.emotionalTrigger ?? "Unknown"}

User instruction: ${prompt}

Generate 5 hook variations.`;

    const message = await claude.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "[]";

    try {
      const hooks = JSON.parse(rawText) as string[];
      parsed = {
        hook: hooks[0],
        scriptNotes: hooks.slice(1),
      };
    } catch {
      throw new Error("AI returned invalid JSON for hook generation");
    }
  } else {
    systemPrompt = loadPrompt("remix-generation");
    userMessage = `Source Reel Analysis:
- Niche: ${reel.niche}
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

    const message = await claude.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "{}";

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
      model: outputType === "hook" ? ANALYSIS_MODEL : GENERATION_MODEL,
      status: "draft",
    })
    .returning();

  return content;
}
