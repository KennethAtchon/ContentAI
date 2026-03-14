import { tool } from "ai";
import { z } from "zod";
import { db } from "../services/db/db";
import {
  generatedContent,
  reelAnalyses,
} from "../infrastructure/database/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { debugLog } from "../utils/debug/debug";
import type { HonoEnv } from "../middleware/protection";

export interface ToolContext {
  auth: HonoEnv["Variables"]["auth"];
  content: string;
  reelRefs?: number[];
  savedContentId?: number;
}

export function createSaveContentTool(context: ToolContext) {
  return tool({
    description:
      "Save a complete generated content piece (hook, script, caption, hashtags, CTA) to the database. Call this after writing a full generation. Never print raw content as plain text — always call this tool.",
    parameters: z.object({
      hook: z
        .string()
        .min(10)
        .max(200)
        .describe("Scroll-stopping opening line (1–2 sentences)"),
      script: z
        .string()
        .min(50)
        .describe(
          "Scene-by-scene shot list with timing, e.g. [0-3s] Opening...",
        ),
      caption: z
        .string()
        .min(20)
        .describe("Full caption text with emojis"),
      hashtags: z
        .array(z.string())
        .min(3)
        .max(15)
        .describe("3–15 relevant hashtags (without #)"),
      cta: z
        .string()
        .describe(
          "Call-to-action (comment, save, share, follow, etc.)",
        ),
      contentType: z.enum(["hook_only", "caption_only", "full_script"]),
    }),
    // @ts-ignore - AI SDK v6 type issue
    execute: async ({
      hook,
      script,
      caption,
      hashtags,
      cta,
      contentType,
    }: {
      hook: string;
      script: string;
      caption: string;
      hashtags: string[];
      cta: string;
      contentType: "hook_only" | "caption_only" | "full_script";
    }) => {
      try {
        const [row] = await db
          .insert(generatedContent)
          .values({
            userId: context.auth.user.id,
            prompt: context.content,
            generatedHook: hook,
            generatedCaption: caption,
            generatedScript: script,
            generatedMetadata: { hashtags, cta, contentType },
            outputType: contentType,
            status: "draft",
            version: 1,
          })
          .returning();
        context.savedContentId = row.id;
        return { success: true as const, contentId: row.id };
      } catch (err) {
        debugLog.error("save_content tool failed", {
          service: "chat-tools",
          operation: "save_content",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "db_error" };
      }
    },
  });
}

export function createGetReelAnalysisTool(context: ToolContext) {
  return tool({
    description:
      "Fetch detailed analysis data for a reel that was attached to this message. Use this before generating content to understand the reel's hook patterns, emotional triggers, and format. Only call for reels explicitly attached by the user.",
    parameters: z.object({
      reelId: z
        .number()
        .describe("The numeric ID of the reel to fetch analysis for"),
    }),
    // @ts-ignore - AI SDK v6 type issue
    execute: async ({ reelId }: { reelId: number }) => {
      // Security: only allow reels that were attached to this message
      if (!context.reelRefs || !context.reelRefs.includes(reelId)) {
        return { error: "reel_not_in_context" };
      }
      try {
        const [analysis] = await db
          .select({
            hookCategory: reelAnalyses.hookCategory,
            emotionalTrigger: reelAnalyses.emotionalTrigger,
            formatPattern: reelAnalyses.formatPattern,
            ctaType: reelAnalyses.ctaType,
            remixSuggestion: reelAnalyses.remixSuggestion,
            captionFramework: reelAnalyses.captionFramework,
            curiosityGapStyle: reelAnalyses.curiosityGapStyle,
            replicabilityScore: reelAnalyses.replicabilityScore,
            commentBaitStyle: reelAnalyses.commentBaitStyle,
            engagementDrivers: reelAnalyses.engagementDrivers,
          })
          .from(reelAnalyses)
          .where(eq(reelAnalyses.reelId, reelId))
          .limit(1);
        if (!analysis) {
          return {
            error: "no_analysis_found",
            message:
              "No deep analysis available for this reel. Proceed to generate content using only the basic reel info already provided in the context (username, hook, view count).",
          };
        }
        return analysis;
      } catch (err) {
        debugLog.error("get_reel_analysis tool failed", {
          service: "chat-tools",
          operation: "get_reel_analysis",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { error: "db_error" };
      }
    },
  });
}

export function createIterateContentTool(context: ToolContext) {
  return tool({
    description:
      "Create a new version of an existing piece of generated content. Call this when the user asks to modify, shorten, rewrite, or change a specific piece. Provide all fields you want to keep or change.",
    parameters: z.object({
      parentContentId: z
        .number()
        .describe("The ID of the content piece to iterate on"),
      hook: z.string().max(200).optional(),
      script: z.string().optional(),
      caption: z.string().optional(),
      hashtags: z.array(z.string()).optional(),
      cta: z.string().optional(),
      changeDescription: z
        .string()
        .describe(
          'Brief description of what changed, e.g. "made hook shorter and more aggressive"',
        ),
    }),
    // @ts-ignore - AI SDK v6 type issue
    execute: async ({
      parentContentId,
      hook,
      script,
      caption,
      hashtags,
      cta,
      changeDescription,
    }: {
      parentContentId: number;
      hook?: string;
      script?: string;
      caption?: string;
      hashtags?: string[];
      cta?: string;
      changeDescription: string;
    }) => {
      try {
        // Ownership check: verify parentContentId belongs to this user
        const [parent] = await db
          .select()
          .from(generatedContent)
          .where(
            and(
              eq(generatedContent.id, parentContentId),
              eq(generatedContent.userId, context.auth.user.id),
            ),
          )
          .limit(1);

        // Return not_found regardless of whether ID exists (don't leak existence)
        if (!parent) {
          return { error: "not_found" };
        }

        const [row] = await db
          .insert(generatedContent)
          .values({
            userId: context.auth.user.id,
            prompt: context.content,
            generatedHook: hook ?? parent.generatedHook,
            generatedCaption: caption ?? parent.generatedCaption,
            generatedScript: script ?? parent.generatedScript,
            generatedMetadata: {
              hashtags:
                hashtags ?? (parent.generatedMetadata as any)?.hashtags,
              cta: cta ?? (parent.generatedMetadata as any)?.cta,
              changeDescription,
            },
            outputType: parent.outputType,
            status: "draft",
            version: parent.version + 1,
            parentId: parent.id,
          })
          .returning();

        context.savedContentId = row.id;
        return { success: true as const, contentId: row.id };
      } catch (err) {
        debugLog.error("iterate_content tool failed", {
          service: "chat-tools",
          operation: "iterate_content",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "db_error" };
      }
    },
  });
}

export function createChatTools(context: ToolContext) {
  return {
    save_content: createSaveContentTool(context),
    get_reel_analysis: createGetReelAnalysisTool(context),
    iterate_content: createIterateContentTool(context),
  };
}
