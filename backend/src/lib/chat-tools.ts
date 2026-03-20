import { tool } from "ai";
import { z } from "zod";
import { db } from "../services/db/db";
import {
  generatedContent,
  queueItems,
  reelAnalyses,
} from "../infrastructure/database/drizzle/schema";
import { eq, and, or, ilike, desc } from "drizzle-orm";
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
        const row = await db.transaction(async (tx) => {
          const [inserted] = await tx
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

          await tx
            .insert(queueItems)
            .values({
              userId: context.auth.user.id,
              generatedContentId: inserted.id,
              status: "draft",
            })
            .onConflictDoNothing();

          return inserted;
        });

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

export function createGetContentTool(context: ToolContext) {
  return tool({
    description:
      "Retrieve the full current content for a given content ID. Call this before making targeted edits so you can read all existing fields and understand what to preserve vs change. Also use when the user asks what you previously wrote ('what hashtags did you pick?', 'show me my current caption', etc.).",
    inputSchema: z.object({
      contentId: z
        .number()
        .describe("The ID of the content piece to retrieve"),
    }),
    execute: async ({ contentId }: { contentId: number }) => {
      debugLog.info("[tool:get_content] Tool invoked", {
        service: "chat-tools",
        operation: "get_content",
        contentId,
        userId: context.auth.user.id,
      });
      try {
        const [row] = await db
          .select({
            id: generatedContent.id,
            version: generatedContent.version,
            outputType: generatedContent.outputType,
            status: generatedContent.status,
            generatedHook: generatedContent.generatedHook,
            generatedCaption: generatedContent.generatedCaption,
            generatedScript: generatedContent.generatedScript,
            cleanScriptForAudio: generatedContent.cleanScriptForAudio,
            sceneDescription: generatedContent.sceneDescription,
            generatedMetadata: generatedContent.generatedMetadata,
            parentId: generatedContent.parentId,
            createdAt: generatedContent.createdAt,
          })
          .from(generatedContent)
          .where(
            and(
              eq(generatedContent.id, contentId),
              eq(generatedContent.userId, context.auth.user.id),
            ),
          )
          .limit(1);

        if (!row) {
          return { error: "not_found" };
        }

        const meta = row.generatedMetadata as Record<string, unknown> | null;

        debugLog.info("[tool:get_content] Content returned", {
          service: "chat-tools",
          operation: "get_content",
          contentId,
          version: row.version,
        });

        return {
          id: row.id,
          version: row.version,
          outputType: row.outputType,
          status: row.status,
          hook: row.generatedHook,
          caption: row.generatedCaption,
          script: row.generatedScript,
          cleanScript: row.cleanScriptForAudio,
          sceneDescription: row.sceneDescription,
          hashtags: meta?.hashtags ?? [],
          cta: meta?.cta ?? null,
          parentId: row.parentId,
          createdAt: row.createdAt,
        };
      } catch (err) {
        debugLog.error("[tool:get_content] Tool failed", {
          service: "chat-tools",
          operation: "get_content",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { error: "db_error" };
      }
    },
  });
}

export function createEditContentFieldTool(context: ToolContext) {
  return tool({
    description:
      "Edit one or more specific fields of existing generated content without changing the others. Use this instead of iterate_content when the user wants to change just a caption, hook, hashtags, CTA, or any single field. Always prefer this over iterate_content when only 1–3 fields are being changed. Call get_content first if you need to read the current values before editing.",
    inputSchema: z.object({
      contentId: z
        .number()
        .describe("ID of the content piece to edit"),
      edits: z
        .object({
          hook: z.string().max(200).optional(),
          caption: z.string().optional(),
          hashtags: z.array(z.string()).min(3).max(15).optional(),
          cta: z.string().optional(),
          script: z.string().optional(),
          cleanScript: z.string().optional(),
          sceneDescription: z.string().optional(),
        })
        .describe("Only include the fields being changed"),
      changeDescription: z
        .string()
        .describe(
          'Brief description of what changed, e.g. "shortened caption and made CTA more direct"',
        ),
    }),
    execute: async ({
      contentId,
      edits,
      changeDescription,
    }: {
      contentId: number;
      edits: {
        hook?: string;
        caption?: string;
        hashtags?: string[];
        cta?: string;
        script?: string;
        cleanScript?: string;
        sceneDescription?: string;
      };
      changeDescription: string;
    }) => {
      debugLog.info("[tool:edit_content_field] Tool invoked", {
        service: "chat-tools",
        operation: "edit_content_field",
        contentId,
        changeDescription,
        fieldsEdited: Object.keys(edits).filter(
          (k) => edits[k as keyof typeof edits] !== undefined,
        ),
        userId: context.auth.user.id,
      });
      try {
        // Ownership check
        const [parent] = await db
          .select()
          .from(generatedContent)
          .where(
            and(
              eq(generatedContent.id, contentId),
              eq(generatedContent.userId, context.auth.user.id),
            ),
          )
          .limit(1);

        if (!parent) {
          return { error: "not_found" };
        }

        // Resolve to the chain tip with a single recursive-style query
        const tip = await resolveChainTip(
          parent.id,
          context.auth.user.id,
        );

        const parentMeta = tip.generatedMetadata as
          | Record<string, unknown>
          | null;

        // Merge: only override fields that are explicitly provided
        const newMetadata = {
          hashtags: edits.hashtags ?? parentMeta?.hashtags,
          cta: edits.cta ?? parentMeta?.cta,
          changeDescription,
        };

        const row = await db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(generatedContent)
            .values({
              userId: context.auth.user.id,
              prompt: context.content,
              sourceReelId: tip.sourceReelId,
              generatedHook: edits.hook ?? tip.generatedHook,
              generatedCaption: edits.caption ?? tip.generatedCaption,
              generatedScript: edits.script ?? tip.generatedScript,
              cleanScriptForAudio:
                edits.cleanScript ?? tip.cleanScriptForAudio,
              sceneDescription:
                edits.sceneDescription ?? tip.sceneDescription,
              generatedMetadata: newMetadata,
              outputType: tip.outputType,
              status: "draft",
              version: tip.version + 1,
              parentId: tip.id,
            })
            .returning();

          await tx
            .insert(queueItems)
            .values({
              userId: context.auth.user.id,
              generatedContentId: inserted.id,
              status: "draft",
            })
            .onConflictDoNothing();

          return inserted;
        });

        context.savedContentId = row.id;

        debugLog.info("[tool:edit_content_field] Edit saved", {
          service: "chat-tools",
          operation: "edit_content_field",
          newContentId: row.id,
          parentId: tip.id,
          version: row.version,
        });
        return { success: true as const, contentId: row.id };
      } catch (err) {
        debugLog.error("[tool:edit_content_field] Tool failed", {
          service: "chat-tools",
          operation: "edit_content_field",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "db_error" };
      }
    },
  });
}

export function createIterateContentTool(context: ToolContext) {
  return tool({
    description:
      "Create a new version of an existing piece of generated content. Call this when the user asks to rewrite, heavily rework, or regenerate a full content piece from scratch. For targeted single-field changes (caption only, hashtags only, hook only, CTA only), use edit_content_field instead — it's faster and more precise.",
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

        // Resolve to the chain tip in a single DB round trip
        const effectiveParent = await resolveChainTip(
          parent.id,
          context.auth.user.id,
        );

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

        const parentMeta = effectiveParent.generatedMetadata as
          | Record<string, unknown>
          | null;

        const row = await db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(generatedContent)
            .values({
              userId: context.auth.user.id,
              prompt: context.content,
              sourceReelId: effectiveParent.sourceReelId,
              generatedHook: hook ?? effectiveParent.generatedHook,
              generatedCaption: caption ?? effectiveParent.generatedCaption,
              generatedScript: script ?? effectiveParent.generatedScript,
              cleanScriptForAudio:
                cleanScript ?? effectiveParent.cleanScriptForAudio,
              sceneDescription:
                sceneDescription ?? effectiveParent.sceneDescription,
              generatedMetadata: {
                hashtags: hashtags ?? parentMeta?.hashtags,
                cta: cta ?? parentMeta?.cta,
                changeDescription,
              },
              outputType: effectiveParent.outputType,
              status: "draft",
              version: effectiveParent.version + 1,
              parentId: effectiveParent.id,
            })
            .returning();

          await tx
            .insert(queueItems)
            .values({
              userId: context.auth.user.id,
              generatedContentId: inserted.id,
              status: "draft",
            })
            .onConflictDoNothing();

          return inserted;
        });

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

export function createUpdateContentStatusTool(context: ToolContext) {
  return tool({
    description:
      "Update the status of a piece of generated content. Use when the user says things like 'move this to the queue', 'mark it as ready', 'archive this draft', 'put it back to draft', etc.",
    inputSchema: z.object({
      contentId: z.number().describe("ID of the content to update"),
      status: z
        .enum(["draft", "queued", "archived"])
        .describe("The new status to set"),
    }),
    execute: async ({
      contentId,
      status,
    }: {
      contentId: number;
      status: "draft" | "queued" | "archived";
    }) => {
      debugLog.info("[tool:update_content_status] Tool invoked", {
        service: "chat-tools",
        operation: "update_content_status",
        contentId,
        status,
        userId: context.auth.user.id,
      });
      try {
        const [updated] = await db
          .update(generatedContent)
          .set({ status })
          .where(
            and(
              eq(generatedContent.id, contentId),
              eq(generatedContent.userId, context.auth.user.id),
            ),
          )
          .returning({ id: generatedContent.id });

        if (!updated) {
          return { error: "not_found" };
        }

        // Sync queue item status for draft/queued transitions
        if (status === "queued" || status === "draft") {
          await db
            .update(queueItems)
            .set({ status })
            .where(eq(queueItems.generatedContentId, contentId));
        }

        debugLog.info("[tool:update_content_status] Status updated", {
          service: "chat-tools",
          operation: "update_content_status",
          contentId,
          status,
        });
        return { success: true as const, contentId, status };
      } catch (err) {
        debugLog.error("[tool:update_content_status] Tool failed", {
          service: "chat-tools",
          operation: "update_content_status",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { success: false as const, reason: "db_error" };
      }
    },
  });
}

export function createSearchContentTool(context: ToolContext) {
  return tool({
    description:
      "Search through the user's previously generated content. Use when the user references past content they want to find, compare, or build on — e.g. 'find the reel about fitness I made last week', 'show me my published captions', 'what content do I have for this reel?'.",
    inputSchema: z.object({
      query: z
        .string()
        .optional()
        .describe("Text to search within hooks and captions"),
      status: z
        .enum(["draft", "queued", "processing", "published", "failed"])
        .optional()
        .describe("Filter by content status"),
      limit: z
        .number()
        .min(1)
        .max(10)
        .default(5)
        .describe("Number of results to return (max 10)"),
    }),
    execute: async ({
      query,
      status,
      limit,
    }: {
      query?: string;
      status?: "draft" | "queued" | "processing" | "published" | "failed";
      limit: number;
    }) => {
      debugLog.info("[tool:search_content] Tool invoked", {
        service: "chat-tools",
        operation: "search_content",
        query,
        status,
        limit,
        userId: context.auth.user.id,
      });
      try {
        const conditions = [eq(generatedContent.userId, context.auth.user.id)];

        if (status) {
          conditions.push(eq(generatedContent.status, status));
        }

        if (query) {
          conditions.push(
            or(
              ilike(generatedContent.generatedHook, `%${query}%`),
              ilike(generatedContent.generatedCaption, `%${query}%`),
            )!,
          );
        }

        const rows = await db
          .select({
            id: generatedContent.id,
            version: generatedContent.version,
            outputType: generatedContent.outputType,
            status: generatedContent.status,
            hook: generatedContent.generatedHook,
            caption: generatedContent.generatedCaption,
            createdAt: generatedContent.createdAt,
          })
          .from(generatedContent)
          .where(and(...conditions))
          .orderBy(desc(generatedContent.createdAt))
          .limit(limit);

        debugLog.info("[tool:search_content] Results returned", {
          service: "chat-tools",
          operation: "search_content",
          resultCount: rows.length,
        });

        return { results: rows, total: rows.length };
      } catch (err) {
        debugLog.error("[tool:search_content] Tool failed", {
          service: "chat-tools",
          operation: "search_content",
          error: err instanceof Error ? err.message : "Unknown",
        });
        return { error: "db_error" };
      }
    },
  });
}

export function createChatTools(context: ToolContext) {
  return {
    save_content: createSaveContentTool(context),
    get_reel_analysis: createGetReelAnalysisTool(context),
    get_content: createGetContentTool(context),
    edit_content_field: createEditContentFieldTool(context),
    iterate_content: createIterateContentTool(context),
    update_content_status: createUpdateContentStatusTool(context),
    search_content: createSearchContentTool(context),
  };
}

// ─── Chain Tip Resolution ────────────────────────────────────────────────────

/**
 * Resolves the latest version in a content chain from any node.
 * Finds the tip (the node with no children) in a single DB query
 * instead of an iterative loop.
 */
async function resolveChainTip(
  startId: number,
  userId: string,
) {
  // Find the tip: the content row with startId as an ancestor (or itself)
  // that has no child pointing to it.
  // Strategy: fetch all descendants in one shot, then return the tail.
  const MAX_CHAIN_DEPTH = 50;
  const visitedIds = new Set<number>();
  let current = await db
    .select()
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.id, startId),
        eq(generatedContent.userId, userId),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!current) throw new Error("Content not found");

  let depth = 0;
  visitedIds.add(current.id);

  while (depth < MAX_CHAIN_DEPTH) {
    const [child] = await db
      .select()
      .from(generatedContent)
      .where(
        and(
          eq(generatedContent.parentId, current.id),
          eq(generatedContent.userId, userId),
        ),
      )
      .orderBy(desc(generatedContent.createdAt))
      .limit(1);

    if (!child || visitedIds.has(child.id)) break;
    visitedIds.add(child.id);
    current = child;
    depth++;
  }

  return current;
}
