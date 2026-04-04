import { streamText, stepCountIs, createUIMessageStreamResponse } from "ai";
import { loadPrompt, getModel, getModelInfo } from "../../lib/aiClient";
import { recordUsage } from "../../middleware/usage-gate";
import { recordAiCost } from "../../lib/cost-tracker";
import { extractUsageTokens } from "../../lib/ai/helpers";
import { createChatTools, type ToolContext } from "./chat-tools";
import { chatService, syncService } from "../singletons";
import { Errors } from "../../utils/errors/app-error";
import { debugLog } from "../../utils/debug/debug";
import type { AuthResult } from "../../types/hono.types";
import {
  composeChatRequest,
  resolveEffectiveActiveContentId,
} from "./send-message.helpers";

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

  const requestedActiveContentId = activeContentId;
  if (requestedActiveContentId != null) {
    // The client can hint which draft is active, but the server stays
    // authoritative and only accepts drafts already attached to this session.
    const isAttached = await chatService.isContentAttachedToSession(
      sessionId,
      auth.user.id,
      requestedActiveContentId,
    );
    if (!isAttached) {
      throw Errors.badRequest(
        "Requested active draft is not attached to this session",
        "CONTENT_NOT_IN_SESSION",
      );
    }
  }

  let effectiveActiveContentId = resolveEffectiveActiveContentId({
    requestActiveContentId: requestedActiveContentId,
    sessionActiveContentId: session.activeContentId,
  });

  if (
    requestedActiveContentId == null &&
    session.activeContentId != null &&
    effectiveActiveContentId != null
  ) {
    // Repair stale session state instead of silently grounding the model on a
    // detached draft that no longer belongs in this workspace.
    const sessionActiveStillAttached =
      await chatService.isContentAttachedToSession(
        sessionId,
        auth.user.id,
        effectiveActiveContentId,
      );

    if (!sessionActiveStillAttached) {
      debugLog.warn("[chat:send-message] Session active draft was detached", {
        service: "chat-route",
        operation: "active-draft-repair",
        sessionId,
        contentId: effectiveActiveContentId,
      });
      await chatService.setActiveContentId(auth.user.id, sessionId, null);
      effectiveActiveContentId = undefined;
    }
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
    await chatService.updateSession(auth.user.id, sessionId, {
      title: autoTitle,
    });
  }

  const projectAndAttachmentContext =
    await chatService.buildProjectAndAttachmentContext(
      auth.user.id,
      session.projectId,
      reelRefs,
      mediaRefs,
    );
  const sessionDraftInventoryContext =
    await chatService.buildSessionDraftInventoryContext(
      sessionId,
      auth.user.id,
      effectiveActiveContentId,
    );
  const activeContentContext = await chatService.buildActiveContentContext(
    sessionId,
    auth.user.id,
    effectiveActiveContentId,
  );
  const { system, messages: requestMessages } = composeChatRequest({
    baseSystemPrompt: getChatSystemPrompt(),
    history: history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    userContent: content,
    projectAndAttachmentContext,
    sessionDraftInventoryContext,
    activeContentContext,
  });

  const { providerId: modelProvider, model: modelName } =
    await getModelInfo("generation");
  const streamStartMs = Date.now();

  const savedContentIds: number[] = [];

  const toolContext: ToolContext = {
    auth,
    sessionId,
    content,
    reelRefs,
    savedContentIds,
    // SyncService runs inside registerCreatedContent, before SSE fires.
    // Ordering: tool saves content + updates session draft state →
    //   onContentSaved fires → syncLinkedProjects writes editor projects →
    //   SSE reveals contentId → client waits for draft to be query-visible →
    //   editor queries re-fetch and merge via MERGE_TRACKS_FROM_SERVER.
    onContentSaved: (contentId) =>
      syncService.syncLinkedProjects(auth.user.id, contentId),
  };

  const result = streamText({
    model: await getModel("generation"),
    // Keep workspace grounding in the system prompt so the final user message
    // is only the raw text the user typed.
    system,
    messages: requestMessages,
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
        const { inputTokens, outputTokens } = extractUsageTokens(totalUsage);

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
