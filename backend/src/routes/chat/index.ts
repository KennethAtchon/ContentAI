import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { streamText, stepCountIs } from "ai";
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
import { createChatTools, type ToolContext } from "../../lib/chat-tools";

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

      debugLog.info("[chat:sendMessage] Request received", {
        service: "chat-route",
        operation: "sendMessage",
        sessionId,
        userId: auth.user.id,
        contentLength: content.length,
        reelRefsCount: reelRefs?.length ?? 0,
        reelRefs,
      });

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
        debugLog.warn("[chat:sendMessage] Session not found", {
          service: "chat-route",
          operation: "sendMessage",
          sessionId,
          userId: auth.user.id,
        });
        return c.json({ error: "Session not found" }, 404);
      }

      debugLog.info("[chat:sendMessage] Session verified", {
        service: "chat-route",
        operation: "sendMessage",
        sessionId,
        sessionTitle: session.title,
        projectId: session.projectId,
        projectName: session.project?.name,
      });

      // Load conversation history BEFORE saving current message (last 20, reelRefs stripped)
      const historyRows = await db
        .select({ role: chatMessages.role, content: chatMessages.content })
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(desc(chatMessages.createdAt))
        .limit(20);
      const history = historyRows.reverse();

      debugLog.info("[chat:sendMessage] History loaded", {
        service: "chat-route",
        operation: "sendMessage",
        sessionId,
        historyMessageCount: history.length,
      });

      // Save user message immediately (before streaming starts)
      const userMessageId = crypto.randomUUID();
      await db.insert(chatMessages).values({
        id: userMessageId,
        sessionId,
        role: "user",
        content,
        reelRefs: reelRefs || null,
      });

      debugLog.info("[chat:sendMessage] User message saved to DB", {
        service: "chat-route",
        operation: "sendMessage",
        messageId: userMessageId,
        sessionId,
      });

      // Auto-title session from first message
      if (session.title === "New Chat Session") {
        const autoTitle =
          content.substring(0, 50) + (content.length > 50 ? "..." : "");
        await db
          .update(chatSessions)
          .set({ title: autoTitle })
          .where(eq(chatSessions.id, sessionId));
        debugLog.info("[chat:sendMessage] Session auto-titled", {
          service: "chat-route",
          operation: "sendMessage",
          sessionId,
          autoTitle,
        });
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

      debugLog.info("[chat:sendMessage] Prompt context built", {
        service: "chat-route",
        operation: "sendMessage",
        sessionId,
        hasReelContext: !!reelRefs?.length,
        userPromptLength: userPrompt.length,
        systemPromptLength: systemPrompt.length,
      });

      const modelInfo = getModelInfo("generation");
      const streamStartMs = Date.now();

      debugLog.info("[chat:sendMessage] Starting AI stream", {
        service: "chat-route",
        operation: "sendMessage",
        sessionId,
        provider: modelInfo.provider,
        model: modelInfo.model,
        historyMessages: history.length,
        maxOutputTokens: 2048,
      });

      // Closure variable: captured by save_content / iterate_content execute handlers,
      // read by onFinish to link the assistant chatMessage to the saved content row.
      let savedContentId: number | null = null;

      // Create tool context
      const toolContext: ToolContext = {
        auth,
        content,
        reelRefs,
        get savedContentId() { return savedContentId || undefined; },
        set savedContentId(value: number | undefined) { savedContentId = value || null; },
      };

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
        stopWhen: stepCountIs(5),
        tools: createChatTools(toolContext),

        onFinish: async ({ text, totalUsage }) => {
          try {
            const durationMs = Date.now() - streamStartMs;
            const { inputTokens, outputTokens } = extractUsageTokens(totalUsage);

            debugLog.info("[chat:onFinish] Stream completed", {
              service: "chat-route",
              operation: "onFinish",
              sessionId,
              responseLength: text.length,
              durationMs,
              inputTokens,
              outputTokens,
              savedContentId,
            });

            // Record usage FIRST (before any DB work that might fail)
            await recordUsage(
              auth.user.id,
              "generation",
              { sessionId, promptLength: content.length },
              { textLength: text.length },
            ).catch(() => {});

            debugLog.info("[chat:onFinish] Usage recorded", {
              service: "chat-route",
              operation: "onFinish",
              sessionId,
            });

            // Insert assistant message linked to any content saved by tools
            const assistantMessageId = crypto.randomUUID();
            await db.insert(chatMessages).values({
              id: assistantMessageId,
              sessionId,
              role: "assistant",
              content: text,
              generatedContentId: savedContentId,
              reelRefs: reelRefs || null,
            });

            debugLog.info("[chat:onFinish] Assistant message saved to DB", {
              service: "chat-route",
              operation: "onFinish",
              messageId: assistantMessageId,
              sessionId,
              linkedContentId: savedContentId,
            });

            await db
              .update(chatSessions)
              .set({ updatedAt: new Date() })
              .where(eq(chatSessions.id, sessionId));

            debugLog.info("[chat:onFinish] Session timestamp updated", {
              service: "chat-route",
              operation: "onFinish",
              sessionId,
            });

            await recordAiCost({
              userId: auth.user.id,
              provider: modelInfo.provider,
              model: modelInfo.model,
              featureType: "generation",
              inputTokens,
              outputTokens,
              durationMs,
            }).catch(() => {});

            debugLog.info("[chat:onFinish] AI cost recorded", {
              service: "chat-route",
              operation: "onFinish",
              sessionId,
              provider: modelInfo.provider,
              model: modelInfo.model,
              inputTokens,
              outputTokens,
              durationMs,
            });
          } catch (err) {
            debugLog.error("Failed to persist assistant message", {
              service: "chat-route",
              operation: "onFinish",
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        },
      });

      debugLog.info("[chat:sendMessage] Returning SSE stream to client", {
        service: "chat-route",
        operation: "sendMessage",
        sessionId,
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
