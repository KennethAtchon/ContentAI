import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  streamText,
  stepCountIs,
  createUIMessageStreamResponse,
} from "ai";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../types/hono.types";
import { loadPrompt, getModel, getModelInfo } from "../../lib/aiClient";
import { usageGate, recordUsage } from "../../middleware/usage-gate";
import { recordAiCost } from "../../lib/cost-tracker";
import { extractUsageTokens } from "../../lib/ai/helpers";
import { createChatTools, type ToolContext } from "../../domain/chat/chat-tools";
import { uuidParam } from "../../validation/shared.schemas";
import { chatService } from "../../domain/singletons";
import { Errors } from "../../utils/errors/app-error";
import { debugLog } from "../../utils/debug/debug";
import { sendMessageSchema } from "./chat.schemas";
import { chatValidationErrorHook } from "./shared-validation";

function getChatSystemPrompt() {
  try {
    return loadPrompt("chat-generate");
  } catch {
    return `You are a helpful AI assistant for content creation. Help users create engaging social media content.`;
  }
}

const sendMessageRouter = new Hono<HonoEnv>();

sendMessageRouter.post(
  "/sessions/:id/messages",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("param", uuidParam, chatValidationErrorHook),
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

    const messages = await chatService.getRecentMessages(sessionId, 20);
    const history = [...messages].reverse();

    debugLog.info("[chat:sendMessage] History loaded", {
      service: "chat-route",
      operation: "sendMessage",
      sessionId,
      historyMessageCount: history.length,
    });

    const userMessageId = crypto.randomUUID();
    await chatService.createMessageSimple({
      id: userMessageId,
      sessionId,
      role: "user",
      content,
    });

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

    const projectName = "My Project";
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

    let savedContentId: number | null = null;

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

export default sendMessageRouter;
