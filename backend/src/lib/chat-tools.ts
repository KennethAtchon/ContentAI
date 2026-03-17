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
      "Save a complete generated content piece (hook, structured script, clean script, caption, hashtags, CTA, sceneDescription) to the database. Call this after writing a full generation. The script field should contain VISUAL descriptions of what to show on screen with timestamps [0-3s], while cleanScript should be the spoken narration without timestamps for audio/TTS generation. sceneDescription sets the overall visual aesthetic for all shots. Never output raw content as plain text — always call this tool.",
    inputSchema: z.object({
      hook: z
        .string()
        .min(10)
        .max(200)
        .describe("Scroll-stopping opening line (1–2 sentences)"),
      script: z
        .string()
        .min(50)
        .describe(
          "Scene-by-scene VISUAL shot list with timing, e.g. [0-3s] Close-up of person looking shocked at phone screen. Describes what to SHOW on screen, not what to say.",
        ),
      cleanScript: z
        .string()
        .min(30)
        .describe(
          "Spoken narration without timestamps for audio/TTS — natural speech, no visual cues",
        ),
      sceneDescription: z
        .string()
        .min(10)
        .describe(
          "Overall visual style for the reel, e.g. 'Cinematic documentary style, warm colour grading, handheld camera, close-ups'. Applied to all shots for visual coherence.",
        ),
      caption: z.string().min(20).describe("Full caption text with emojis"),
      hashtags: z
        .array(z.string())
        .min(3)
        .max(15)
        .describe("3–15 relevant hashtags (without #)"),
      cta: z
        .string()
        .describe("Call-to-action (comment, save, share, follow, etc.)"),
      contentType: z.enum(["hook_only", "caption_only", "full_script"]),
    }),
    execute: async ({
      hook,
      script,
      cleanScript,
      sceneDescription,
      caption,
      hashtags,
      cta,
      contentType,
    }: {
      hook: string;
      script: string;
      cleanScript: string;
      sceneDescription: string;
      caption: string;
      hashtags: string[];
      cta: string;
      contentType: "hook_only" | "caption_only" | "full_script";
    }) => {
      debugLog.info("[tool:save_content] Tool invoked", {
        service: "chat-tools",
        operation: "save_content",
        contentType,
        hookLength: hook.length,
        scriptLength: script.length,
        cleanScriptLength: cleanScript.length,
        captionLength: caption.length,
        hashtagCount: hashtags.length,
        userId: context.auth.user.id,
      });
      try {
        const [row] = await db
          .insert(generatedContent)
          .values({
            userId: context.auth.user.id,
            prompt: context.content,
            generatedHook: hook,
            generatedCaption: caption,
            generatedScript: script,
            cleanScriptForAudio: cleanScript,
            sceneDescription,
            generatedMetadata: { hashtags, cta, contentType },
            outputType: contentType,
            status: "draft",
            version: 1,
          })
          .returning();
        context.savedContentId = row.id;
        debugLog.info("[tool:save_content] Content saved to DB", {
          service: "chat-tools",
          operation: "save_content",
          contentId: row.id,
          userId: context.auth.user.id,
        });
        return { success: true as const, contentId: row.id };
      } catch (err) {
        debugLog.error("[tool:save_content] Tool failed", {
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
    inputSchema: z.object({
      reelId: z
        .number()
        .describe("The numeric ID of the reel to fetch analysis for"),
    }),
    execute: async ({ reelId }: { reelId: number }) => {
      debugLog.info("[tool:get_reel_analysis] Tool invoked", {
        service: "chat-tools",
        operation: "get_reel_analysis",
        reelId,
        allowedReelRefs: context.reelRefs,
      });
      // Security: only allow reels that were attached to this message
      if (!context.reelRefs || !context.reelRefs.includes(reelId)) {
        debugLog.warn(
          "[tool:get_reel_analysis] Reel not in context — blocked",
          {
            service: "chat-tools",
            operation: "get_reel_analysis",
            reelId,
            allowedReelRefs: context.reelRefs,
          },
        );
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
          debugLog.info("[tool:get_reel_analysis] No analysis found for reel", {
            service: "chat-tools",
            operation: "get_reel_analysis",
            reelId,
          });
          return {
            error: "no_analysis_found",
            message:
              "No deep analysis available for this reel. Proceed to generate content using only the basic reel info already provided in the context (username, hook, view count).",
          };
        }
        debugLog.info("[tool:get_reel_analysis] Analysis returned", {
          service: "chat-tools",
          operation: "get_reel_analysis",
          reelId,
          hasHookCategory: !!analysis.hookCategory,
          replicabilityScore: analysis.replicabilityScore,
        });
        return analysis;
      } catch (err) {
        debugLog.error("[tool:get_reel_analysis] Tool failed", {
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
      "Create a new version of an existing piece of generated content. Call this when the user asks to modify, shorten, rewrite, or change a specific piece. Provide all fields you want to keep or change. If modifying the script, provide both script (with timestamps for video) and cleanScript (without timestamps for audio) if applicable.",
    inputSchema: z.object({
      parentContentId: z
        .number()
        .describe("The ID of the content piece to iterate on"),
      hook: z.string().max(200).optional(),
      script: z.string().optional(),
      cleanScript: z.string().optional(),
      sceneDescription: z.string().optional(),
      caption: z.string().optional(),
      hashtags: z.array(z.string()).optional(),
      cta: z.string().optional(),
      changeDescription: z
        .string()
        .describe(
          'Brief description of what changed, e.g. "made hook shorter and more aggressive"',
        ),
    }),
    execute: async ({
      parentContentId,
      hook,
      script,
      cleanScript,
      sceneDescription,
      caption,
      hashtags,
      cta,
      changeDescription,
    }: {
      parentContentId: number;
      hook?: string;
      script?: string;
      cleanScript?: string;
      sceneDescription?: string;
      caption?: string;
      hashtags?: string[];
      cta?: string;
      changeDescription: string;
    }) => {
      debugLog.info("[tool:iterate_content] Tool invoked", {
        service: "chat-tools",
        operation: "iterate_content",
        parentContentId,
        changeDescription,
        fieldsOverridden: {
          hook: hook !== undefined,
          script: script !== undefined,
          cleanScript: cleanScript !== undefined,
          sceneDescription: sceneDescription !== undefined,
          caption: caption !== undefined,
          hashtags: hashtags !== undefined,
          cta: cta !== undefined,
        },
        userId: context.auth.user.id,
      });
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
          debugLog.warn(
            "[tool:iterate_content] Parent content not found or unauthorized",
            {
              service: "chat-tools",
              operation: "iterate_content",
              parentContentId,
              userId: context.auth.user.id,
            },
          );
          return { error: "not_found" };
        }

        // Resolve to the tip of the chain to prevent branching.
        // If the AI passes an outdated parentId, walk forward to the latest version.
        let effectiveParent = parent;
        while (true) {
          const [child] = await db
            .select()
            .from(generatedContent)
            .where(
              and(
                eq(generatedContent.parentId, effectiveParent.id),
                eq(generatedContent.userId, context.auth.user.id),
              ),
            )
            .limit(1);
          if (!child) break;
          effectiveParent = child;
        }

        debugLog.info(
          "[tool:iterate_content] Parent content found, creating new version",
          {
            service: "chat-tools",
            operation: "iterate_content",
            parentContentId,
            resolvedParentId: effectiveParent.id,
            parentVersion: effectiveParent.version,
            newVersion: effectiveParent.version + 1,
          },
        );

        const [row] = await db
          .insert(generatedContent)
          .values({
            userId: context.auth.user.id,
            prompt: context.content,
            generatedHook: hook ?? effectiveParent.generatedHook,
            generatedCaption: caption ?? effectiveParent.generatedCaption,
            generatedScript: script ?? effectiveParent.generatedScript,
            cleanScriptForAudio:
              cleanScript ?? effectiveParent.cleanScriptForAudio,
            sceneDescription:
              sceneDescription ?? effectiveParent.sceneDescription,
            generatedMetadata: {
              hashtags:
                hashtags ??
                (effectiveParent.generatedMetadata as any)?.hashtags,
              cta: cta ?? (effectiveParent.generatedMetadata as any)?.cta,
              changeDescription,
            },
            outputType: effectiveParent.outputType,
            status: "draft",
            version: effectiveParent.version + 1,
            parentId: effectiveParent.id,
          })
          .returning();

        context.savedContentId = row.id;
        debugLog.info("[tool:iterate_content] New version saved to DB", {
          service: "chat-tools",
          operation: "iterate_content",
          newContentId: row.id,
          parentContentId,
          version: row.version,
        });
        return { success: true as const, contentId: row.id };
      } catch (err) {
        debugLog.error("[tool:iterate_content] Tool failed", {
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
