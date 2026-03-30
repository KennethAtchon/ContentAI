import {
  streamText,
  stepCountIs,
  createUIMessageStreamResponse,
} from "ai";
import { loadPrompt, getModel, getModelInfo } from "../../lib/aiClient";
import { recordUsage } from "../../middleware/usage-gate";
import { recordAiCost } from "../../lib/cost-tracker";
import { extractUsageTokens } from "../../lib/ai/helpers";
import { createChatTools, type ToolContext } from "./chat-tools";
import { chatService } from "../singletons";
import { Errors } from "../../utils/errors/app-error";
import { debugLog } from "../../utils/debug/debug";
import type { AuthResult } from "../../types/hono.types";

function getChatSystemPrompt() {
  try {
    return loadPrompt("chat-generate");
  } catch {
    return `You are a helpful AI assistant for content creation. Help users create engaging social media content.`;
  }
}

export async function createChatSendMessageStreamResponse(input: {
  auth: AuthResult;
  sessionId: string;
  content: string;
  reelRefs?: number[];
  mediaRefs?: string[];
  activeContentId?: number;
}): Promise<Response> {
  const { auth, sessionId, content, reelRefs, mediaRefs, activeContentId } =
    input;

  const session = await chatService.findSessionById(auth.user.id, sessionId);
  if (!session) {
    throw Errors.notFound("Session");
  }

  const messages = await chatService.getRecentMessages(sessionId, 20);
  const history = [...messages].reverse();

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

  if (session.title === "New Chat Session") {
    const autoTitle =
      content.substring(0, 50) + (content.length > 50 ? "..." : "");
    await chatService.updateSession(auth.user.id, sessionId, autoTitle);
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

  const { providerId: modelProvider, model: modelName } =
    await getModelInfo("generation");
  const streamStartMs = Date.now();

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

        await recordUsage(
          auth.user.id,
          "generation",
          { sessionId, promptLength: content.length },
          { textLength: text.length },
        ).catch(() => {});

        const assistantMessageId = crypto.randomUUID();
        await chatService.saveAssistantMessage({
          id: assistantMessageId,
          sessionId,
          content: text,
          generatedContentId: savedContentId,
        });

        await chatService.touchSession(sessionId);

        await recordAiCost({
          userId: auth.user.id,
          provider: modelProvider,
          model: modelName,
          featureType: "generation",
          inputTokens,
          outputTokens,
          durationMs,
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
}
