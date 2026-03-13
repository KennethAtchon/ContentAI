import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
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
} from "../../infrastructure/database/drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { debugLog } from "../../utils/debug/debug";
import { streamText } from "ai";
import { loadPrompt, getModel } from "../../lib/aiClient";

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

// POST /api/chat/sessions/:id/messages - Send message and get AI response
app.post(
  "/sessions/:id/messages",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
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
            nicheId: projects.nicheId,
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

      // Save user message
      await db
        .insert(chatMessages)
        .values({
          id: crypto.randomUUID(),
          sessionId,
          role: "user",
          content,
          reelRefs: reelRefs || null,
        })
        .returning();

      // Update session title if this is the first message and title is generic
      if (session.title === "New Chat Session") {
        const autoTitle =
          content.substring(0, 50) + (content.length > 50 ? "..." : "");
        await db
          .update(chatSessions)
          .set({ title: autoTitle })
          .where(eq(chatSessions.id, sessionId));
      }

      // Build context for AI generation
      const context = await buildChatContext(
        auth.user.id,
        session.project,
        reelRefs,
      );

      // Get AI response using existing callAi function
      const systemPrompt = getChatSystemPrompt();
      const userPrompt = `Context: ${context}\n\nUser message: ${content}`;

      // Stream AI response
      const result = await streamText({
        model: getModel("generation"),
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
        maxOutputTokens: 1024,
      });

      // Save the initial AI response (we'll update it with the full content later)
      await db
        .insert(chatMessages)
        .values({
          id: crypto.randomUUID(),
          sessionId,
          role: "assistant",
          content: "", // Will be updated
        })
        .returning();

      // Return streaming response
      return result.toTextStreamResponse();
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
    // Build context from project niche and referenced reels
    let context = `Project: ${project.name}`;

    if (project.nicheId) {
      context += ` (Niche ID: ${project.nicheId})`;
    }

    // If reel references are provided, fetch information about those reels
    if (reelRefs && reelRefs.length > 0) {
      // This is a placeholder - you would fetch actual reel data here
      context += `\nReferenced reels: ${reelRefs.join(", ")}`;
    }

    return context;
  } catch (error) {
    debugLog.error("Failed to build chat context", {
      service: "chat-route",
      operation: "buildChatContext",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return "Context unavailable";
  }
}

function getChatSystemPrompt() {
  try {
    return loadPrompt("chat-generate");
  } catch {
    return `You are a helpful AI assistant for content creation. You help users create engaging social media content including hooks, scripts, captions, and hashtags.

When responding:
1. Be creative and practical
2. Provide actionable advice
3. Consider the platform and audience
4. Suggest specific examples when helpful
5. Keep responses concise but comprehensive

Focus on creating content that performs well on social media platforms.`;
  }
}

export default app;
