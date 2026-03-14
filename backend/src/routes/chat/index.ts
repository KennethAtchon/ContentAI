import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { streamText, tool, stepCountIs } from "ai";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  chatSessions,
  chatMessages,
  projects,
  generatedContent,
  reels,
  reelAnalyses,
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { loadPrompt, getModel } from "../../lib/aiClient";
import { usageGate, recordUsage } from "../../middleware/usage-gate";
import { recordAiCost } from "../../lib/cost-tracker";
import { getModelInfo } from "../../lib/aiClient";

function extractUsageTokens(usage: unknown): {
  inputTokens: number;
  outputTokens: number;
} {
  if (!usage || typeof usage !== "object") {
    return { inputTokens: 0, outputTokens: 0 };
  }

  const record = usage as Record<string, unknown>;
  const inputTokens =
    typeof record.inputTokens === "number"
      ? record.inputTokens
      : typeof record.promptTokens === "number"
        ? record.promptTokens
        : 0;
  const outputTokens =
    typeof record.outputTokens === "number"
      ? record.outputTokens
      : typeof record.completionTokens === "number"
        ? record.completionTokens
        : 0;

  return { inputTokens, outputTokens };
}

const app = new Hono<HonoEnv>();

// Zod schemas for validation
const createSessionSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(100).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  reelRefs: z.array(z.number()).optional(),
});

// GET /api/chat/sessions - List user chat sessions (optionally filter by projectId)
app.get(
  "/sessions",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const projectId = c.req.query("projectId");

      const whereClause = projectId
        ? and(
            eq(chatSessions.userId, auth.user.id),
            eq(chatSessions.projectId, projectId),
          )
        : eq(chatSessions.userId, auth.user.id);

      const sessions = await db
        .select({
          id: chatSessions.id,
          title: chatSessions.title,
          projectId: chatSessions.projectId,
          project: {
            id: projects.id,
            name: projects.name,
          },
          createdAt: chatSessions.createdAt,
          updatedAt: chatSessions.updatedAt,
          messageCount:
            sql<number>`(SELECT COUNT(*) FROM ${chatMessages} WHERE ${chatMessages.sessionId} = ${chatSessions.id})`.mapWith(
              Number,
            ),
        })
        .from(chatSessions)
        .leftJoin(projects, eq(chatSessions.projectId, projects.id))
        .where(whereClause)
        .orderBy(desc(chatSessions.updatedAt));

      return c.json({ sessions });
    } catch (error) {
      debugLog.error("Failed to fetch chat sessions", {
        service: "chat-route",
        operation: "getSessions",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch sessions" }, 500);
    }
  },
);

// POST /api/chat/sessions - Create new chat session
app.post(
  "/sessions",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createSessionSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { projectId, title } = c.req.valid("json");

      // Verify project exists and belongs to user
      const [project] = await db
        .select()
        .from(projects)
        .where(
          and(eq(projects.id, projectId), eq(projects.userId, auth.user.id)),
        )
        .limit(1);

      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const sessionTitle = title || "New Chat Session";
      const [newSession] = await db
        .insert(chatSessions)
        .values({
          id: crypto.randomUUID(),
          userId: auth.user.id,
          projectId,
          title: sessionTitle,
        })
        .returning();

      return c.json({ session: newSession }, 201);
    } catch (error) {
      debugLog.error("Failed to create chat session", {
        service: "chat-route",
        operation: "createSession",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to create session" }, 500);
    }
  },
);

// GET /api/chat/sessions/:id - Get chat session with messages
app.get(
  "/sessions/:id",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const sessionId = c.req.param("id");

      // Verify session exists and belongs to user
      const [session] = await db
        .select({
          id: chatSessions.id,
          title: chatSessions.title,
          projectId: chatSessions.projectId,
          project: {
            id: projects.id,
            name: projects.name,
          },
          createdAt: chatSessions.createdAt,
          updatedAt: chatSessions.updatedAt,
        })
        .from(chatSessions)
        .leftJoin(projects, eq(chatSessions.projectId, projects.id))
        .where(
          and(
            eq(chatSessions.id, sessionId),
            eq(chatSessions.userId, auth.user.id),
          ),
        )
        .limit(1);

      if (!session) {
        return c.json({ error: "Session not found" }, 404);
      }

      // Get messages for this session
      const messages = await db
        .select({
          id: chatMessages.id,
          role: chatMessages.role,
          content: chatMessages.content,
          reelRefs: chatMessages.reelRefs,
          generatedContentId: chatMessages.generatedContentId,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.createdAt);

      return c.json({ session, messages });
    } catch (error) {
      debugLog.error("Failed to fetch chat session", {
        service: "chat-route",
        operation: "getSession",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch session" }, 500);
    }
  },
);

// DELETE /api/chat/sessions/:id - Delete chat session
app.delete(
  "/sessions/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const sessionId = c.req.param("id");

      const [deletedSession] = await db
        .delete(chatSessions)
        .where(
          and(
            eq(chatSessions.id, sessionId),
            eq(chatSessions.userId, auth.user.id),
          ),
        )
        .returning();

      if (!deletedSession) {
        return c.json({ error: "Session not found" }, 404);
      }

      return c.json({ message: "Session deleted successfully" });
    } catch (error) {
      debugLog.error("Failed to delete chat session", {
        service: "chat-route",
        operation: "deleteSession",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to delete session" }, 500);
    }
  },
);

// POST /api/chat/sessions/:id/messages - Send message and stream AI response
app.post(
  "/sessions/:id/messages",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  usageGate("generation"),
  zValidator("json", sendMessageSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const sessionId = c.req.param("id");
      const { content, reelRefs } = c.req.valid("json");

      // Verify session exists and belongs to user
      const [session] = await db
        .select({
          id: chatSessions.id,
          title: chatSessions.title,
          projectId: chatSessions.projectId,
          project: {
            id: projects.id,
            name: projects.name,
          },
        })
        .from(chatSessions)
        .leftJoin(projects, eq(chatSessions.projectId, projects.id))
        .where(
          and(
            eq(chatSessions.id, sessionId),
            eq(chatSessions.userId, auth.user.id),
          ),
        )
        .limit(1);

      if (!session) {
        return c.json({ error: "Session not found" }, 404);
      }

      // Load conversation history BEFORE saving current message (last 20, reelRefs stripped)
      const historyRows = await db
        .select({ role: chatMessages.role, content: chatMessages.content })
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(20);
      const history = historyRows.reverse();

      // Save user message immediately (before streaming starts)
      await db.insert(chatMessages).values({
        id: crypto.randomUUID(),
        sessionId,
        role: "user",
        content,
        reelRefs: reelRefs || null,
      });

      // Auto-title session from first message
      if (session.title === "New Chat Session") {
        const autoTitle =
          content.substring(0, 50) + (content.length > 50 ? "..." : "");
        await db
          .update(chatSessions)
          .set({ title: autoTitle })
          .where(eq(chatSessions.id, sessionId));
      }

      // Build prompt context
      const context = await buildChatContext(
        auth.user.id,
        session.project,
        reelRefs,
      );
      const systemPrompt = getChatSystemPrompt();
      const userPrompt = context
        ? `Context:\n${context}\n\nUser message: ${content}`
        : content;

      const modelInfo = getModelInfo("generation");
      const streamStartMs = Date.now();

      // Closure variable: captured by save_content / iterate_content execute handlers,
      // read by onFinish to link the assistant chatMessage to the saved content row.
      let savedContentId: number | null = null;

      const result = streamText({
        model: getModel("generation"),
        system: systemPrompt,
        messages: [
          ...history.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user", content: userPrompt },
        ],
        maxOutputTokens: 2048,
        toolChoice: "auto",
        stopWhen: stepCountIs(1),
        tools: {
          save_content: tool({
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
                    userId: auth.user.id,
                    prompt: content,
                    generatedHook: hook,
                    generatedCaption: caption,
                    generatedScript: script,
                    generatedMetadata: { hashtags, cta, contentType },
                    outputType: contentType,
                    status: "draft",
                    version: 1,
                  })
                  .returning();
                savedContentId = row.id;
                return { success: true as const, contentId: row.id };
              } catch (err) {
                debugLog.error("save_content tool failed", {
                  service: "chat-route",
                  operation: "save_content",
                  error: err instanceof Error ? err.message : "Unknown",
                });
                return { success: false as const, reason: "db_error" };
              }
            },
          }),

          get_reel_analysis: tool({
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
              if (!reelRefs || !reelRefs.includes(reelId)) {
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
                  return { error: "no_analysis_found" };
                }
                return analysis;
              } catch (err) {
                debugLog.error("get_reel_analysis tool failed", {
                  service: "chat-route",
                  operation: "get_reel_analysis",
                  error: err instanceof Error ? err.message : "Unknown",
                });
                return { error: "db_error" };
              }
            },
          }),

          iterate_content: tool({
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
                      eq(generatedContent.userId, auth.user.id),
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
                    userId: auth.user.id,
                    prompt: content,
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

                savedContentId = row.id;
                return { success: true as const, contentId: row.id };
              } catch (err) {
                debugLog.error("iterate_content tool failed", {
                  service: "chat-route",
                  operation: "iterate_content",
                  error: err instanceof Error ? err.message : "Unknown",
                });
                return { success: false as const, reason: "db_error" };
              }
            },
          }),
        },

        onFinish: async ({ text, totalUsage }) => {
          try {
            // Record usage FIRST (before any DB work that might fail)
            await recordUsage(
              auth.user.id,
              "generation",
              { sessionId, promptLength: content.length },
              { textLength: text.length },
            ).catch(() => {});

            // Insert assistant message linked to any content saved by tools
            await db.insert(chatMessages).values({
              id: crypto.randomUUID(),
              sessionId,
              role: "assistant",
              content: text,
              generatedContentId: savedContentId,
            });

            await db
              .update(chatSessions)
              .set({ updatedAt: new Date() })
              .where(eq(chatSessions.id, sessionId));

            const { inputTokens, outputTokens } =
              extractUsageTokens(totalUsage);
            await recordAiCost({
              userId: auth.user.id,
              provider: modelInfo.provider,
              model: modelInfo.model,
              featureType: "generation",
              inputTokens,
              outputTokens,
              durationMs: Date.now() - streamStartMs,
            }).catch(() => {});
          } catch (err) {
            debugLog.error("Failed to persist assistant message", {
              service: "chat-route",
              operation: "onFinish",
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        },
      });

      return result.toUIMessageStreamResponse();
    } catch (error) {
      debugLog.error("Failed to send chat message", {
        service: "chat-route",
        operation: "sendMessage",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to send message" }, 500);
    }
  },
);

// Helper functions
async function buildChatContext(
  userId: string,
  project: any,
  reelRefs?: number[],
) {
  try {
    let context = `Project: ${project.name}`;

    if (reelRefs && reelRefs.length > 0) {
      const reelRows = await db
        .select({
          id: reels.id,
          username: reels.username,
          hook: reels.hook,
          views: reels.views,
          niche: sql<string>`(SELECT n.name FROM niche n WHERE n.id = ${reels.nicheId})`,
        })
        .from(reels)
        .where(inArray(reels.id, reelRefs));

      if (reelRows.length > 0) {
        const reelContext = reelRows
          .map(
            (r) =>
              `Reel ID ${r.id} @${r.username} (${r.views.toLocaleString()} views, ${r.niche ?? "unknown niche"}): hook="${r.hook ?? "N/A"}"`,
          )
          .join("\n");
        context += `\nAttached reels (use get_reel_analysis to fetch deep analysis before generating):\n${reelContext}`;
      }
    }

    return context;
  } catch (error) {
    debugLog.error("Failed to build chat context", {
      service: "chat-route",
      operation: "buildChatContext",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return "";
  }
}

function getChatSystemPrompt() {
  try {
    return loadPrompt("chat-generate");
  } catch {
    return `You are a helpful AI assistant for content creation. Help users create engaging social media content.`;
  }
}

export default app;
