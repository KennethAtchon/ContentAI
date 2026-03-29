import { Hono, type Context } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { streamText, stepCountIs, createUIMessageStreamResponse } from "ai";
import {
  authMiddleware,
  rateLimiter,
  csrfMiddleware,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { loadPrompt, getModel } from "../../lib/aiClient";
import { usageGate, recordUsage } from "../../middleware/usage-gate";
import { recordAiCost } from "../../lib/cost-tracker";
import { getModelInfo } from "../../lib/aiClient";
import { extractUsageTokens } from "../../lib/ai/helpers";
import { createChatTools, type ToolContext } from "../../lib/chat-tools";
import { uuidParam, uuidProjectParam } from "../../validation/shared.schemas";
import { contentService, chatService } from "../../domain/singletons";
import { Errors } from "../../utils/errors/app-error";
import { debugLog } from "../../utils/debug/debug";

const app = new Hono<HonoEnv>();
type ValidationResult = { success: boolean; error?: { issues: unknown[] } };

const validationErrorHook = (result: ValidationResult, c: Context) => {
  if (!result.success) {
    return c.json(
      {
        error: "Validation failed",
        code: "INVALID_INPUT",
        details: result.error?.issues ?? [],
      },
      422,
    );
  }
};

// Zod schemas for validation
const createSessionSchema = uuidProjectParam.extend({
  title: z.string().min(1).max(100).optional(),
});
const listSessionsQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  reelRefs: z.array(z.number()).optional(),
  mediaRefs: z.array(z.string()).optional(),
  activeContentId: z.number().optional(),
});

const updateSessionSchema = z.object({
  title: z.string().min(1).max(100),
});

// GET /api/chat/sessions - List user chat sessions (optionally filter by projectId)
app.get(
  "/sessions",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("query", listSessionsQuerySchema, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { projectId } = c.req.valid("query");

    const result = await chatService.listSessions(auth.user.id, projectId);

    return c.json(result);
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
    const auth = c.get("auth");
    const { projectId, title } = c.req.valid("json");

    const result = await chatService.createSession(auth.user.id, projectId, title);

    return c.json(result, 201);
  },
);

// POST /api/chat/sessions/resolve-for-content
// Finds or creates a chat session for a given generated_content id.
// Registered before /sessions/:id to avoid the :id wildcard capturing this path.
app.post(
  "/sessions/resolve-for-content",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator(
    "json",
    z.object({ generatedContentId: z.number().int().positive() }),
  ),
  async (c) => {
    const auth = c.get("auth");
    const { generatedContentId } = c.req.valid("json");

    const content = await contentService.getOwnedContentHook(
      generatedContentId,
      auth.user.id,
    );

    if (!content) {
      throw Errors.notFound("Content");
    }

    // Find existing session for this content or create new one
    const result = await chatService.findOrCreateSessionForContent(
      auth.user.id,
      String(generatedContentId),
    );

    return c.json({
      sessionId: result.session.id,
      projectId: result.session.projectId,
      isNew: result.isNew,
    });
  },
);

// GET /api/chat/sessions/:id - Get chat session with messages
app.get(
  "/sessions/:id",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", uuidParam, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id: sessionId } = c.req.valid("param");

    const result = await chatService.getSessionWithMessages(auth.user.id, sessionId);

    if (!result) {
      throw Errors.notFound("Session");
    }

    return c.json(result);
  },
);

// GET /api/chat/sessions/:id/content - Get chain-tip drafts for a session
app.get(
  "/sessions/:id/content",
  rateLimiter("customer"),
  authMiddleware("user"),
  zValidator("param", uuidParam, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id: sessionId } = c.req.valid("param");

    const drafts = await contentService.findChainTipDraftsForSession(
      auth.user.id,
      sessionId,
    );

    return c.json({ drafts });
  },
);

// DELETE /api/chat/sessions/:id - Delete chat session
app.delete(
  "/sessions/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", uuidParam, validationErrorHook),
  async (c) => {
    const auth = c.get("auth");
    const { id: sessionId } = c.req.valid("param");

    await chatService.deleteSession(auth.user.id, sessionId);

    return c.json({ message: "Session deleted successfully" });
  },
);

// PUT /api/chat/sessions/:id - Update chat session (e.g., rename title)
app.put(
  "/sessions/:id",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", uuidParam, validationErrorHook),
  zValidator("json", updateSessionSchema),
  async (c) => {
    const auth = c.get("auth");
    const { id: sessionId } = c.req.valid("param");
    const { title } = c.req.valid("json");

    const result = await chatService.updateSession(auth.user.id, sessionId, title);

    return c.json(result);
  },
);

// POST /api/chat/sessions/:id/messages - Send message and stream AI response
app.post(
  "/sessions/:id/messages",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", uuidParam, validationErrorHook),
  usageGate("generation"),
  zValidator("json", sendMessageSchema),
  async (c) => {
    const auth = c.get("auth");
    const { id: sessionId } = c.req.valid("param");
    const { content, reelRefs, mediaRefs, activeContentId } =
      c.req.valid("json");

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
      const session = await chatService.findSessionById(auth.user.id, sessionId);

      if (!session) {
        debugLog.warn("[chat:sendMessage] Session not found", {
          service: "chat-route",
          operation: "sendMessage",
          sessionId,
          userId: auth.user.id,
        });
        throw Errors.notFound("Session");
      }

      debugLog.info("[chat:sendMessage] Session verified", {
        service: "chat-route",
        operation: "sendMessage",
        sessionId,
        sessionTitle: session.title,
        projectId: session.projectId,
      });

      // Load conversation history BEFORE saving current message (last 20, reelRefs stripped)
      const messages = await chatService.getRecentMessages(sessionId, 20);
      const history = [...messages].reverse();

      debugLog.info("[chat:sendMessage] History loaded", {
        service: "chat-route",
        operation: "sendMessage",
        sessionId,
        historyMessageCount: history.length,
      });

      // Save user message immediately (before streaming starts)
      const userMessageId = crypto.randomUUID();
      await chatService.createMessageSimple({
        id: userMessageId,
        sessionId,
        role: "user",
        content,
      });

      // Insert attachments for reel refs and media refs
      const attachmentInserts = [
        ...(reelRefs ?? []).map((reelId) => ({
          messageId: userMessageId,
          type: "reel" as const,
          reelId,
        })),
        ...(mediaRefs ?? []).map((assetId) => ({
          messageId: userMessageId,
          type: "asset" as const,
          mediaAssetId: assetId,
        })),
      ];
      if (attachmentInserts.length > 0) {
        await chatService.createAttachmentsSimple(attachmentInserts);
      }

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
        await chatService.updateSession(auth.user.id, sessionId, autoTitle);
        debugLog.info("[chat:sendMessage] Session auto-titled", {
          service: "chat-route",
          operation: "sendMessage",
          sessionId,
          autoTitle,
        });
      }

      // Build prompt context
      // Get project name from session - session already verified above
      const projectName = "My Project"; // Simplified - project name not critical for chat context
      const context = await chatService.buildChatContext(
        auth.user.id,
        projectName,
        reelRefs,
        activeContentId,
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

      const { providerId: modelProvider, model: modelName } =
        await getModelInfo("generation");
      const streamStartMs = Date.now();

      debugLog.info("[chat:sendMessage] Starting AI stream", {
        service: "chat-route",
        operation: "sendMessage",
        sessionId,
        provider: modelProvider,
        model: modelName,
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
        get savedContentId() {
          return savedContentId || undefined;
        },
        set savedContentId(value: number | undefined) {
          savedContentId = value || null;
        },
      };

      const result = streamText({
        model: await getModel("generation"),
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

        onError: async ({ error }) => {
          debugLog.error("[chat:streamText] AI provider stream error", {
            service: "chat-route",
            operation: "onError",
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          });
        },

        onFinish: async ({ text: rawText, totalUsage }) => {
          // Strip <tool_call>...</tool_call> XML that some models emit as plain text
          // (non-native function calling fallback) to keep stored messages clean.
          const text = rawText
            .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
            .trimEnd();
          try {
            const durationMs = Date.now() - streamStartMs;
            const { inputTokens, outputTokens } =
              extractUsageTokens(totalUsage);

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
            await chatService.saveAssistantMessage({
              id: assistantMessageId,
              sessionId,
              content: text,
              generatedContentId: savedContentId,
            });

            debugLog.info("[chat:onFinish] Assistant message saved to DB", {
              service: "chat-route",
              operation: "onFinish",
              messageId: assistantMessageId,
              sessionId,
              linkedContentId: savedContentId,
            });

            await chatService.touchSession(sessionId);

            debugLog.info("[chat:onFinish] Session timestamp updated", {
              service: "chat-route",
              operation: "onFinish",
              sessionId,
            });

            await recordAiCost({
              userId: auth.user.id,
              provider: modelProvider,
              model: modelName,
              featureType: "generation",
              inputTokens,
              outputTokens,
              durationMs,
            }).catch(() => {});

            debugLog.info("[chat:onFinish] AI cost recorded", {
              service: "chat-route",
              operation: "onFinish",
              sessionId,
              provider: modelProvider,
              model: modelName,
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

      // Wrap the UI stream to catch provider errors and close gracefully,
      // preventing ERR_INCOMPLETE_CHUNKED_ENCODING on network/provider failures.
      const safeStream = new ReadableStream({
        start(controller) {
          const reader = result.toUIMessageStream().getReader();
          (async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  controller.close();
                  break;
                }
                controller.enqueue(value);
              }
            } catch (err) {
              debugLog.error("[chat:stream] Stream terminated with error", {
                service: "chat-route",
                operation: "stream-error",
                sessionId,
                error: err instanceof Error ? err.message : String(err),
              });
              try {
                controller.enqueue({
                  type: "error" as const,
                  errorText:
                    err instanceof Error
                      ? err.message
                      : "An error occurred while generating the response.",
                });
                controller.close();
              } catch {
                // stream already closed
              }
            }
          })();
        },
      });

    return createUIMessageStreamResponse({ stream: safeStream });
  },
);

// Helper functions
function getChatSystemPrompt() {
  try {
    return loadPrompt("chat-generate");
  } catch {
    return `You are a helpful AI assistant for content creation. Help users create engaging social media content.`;
  }
}

export default app;
