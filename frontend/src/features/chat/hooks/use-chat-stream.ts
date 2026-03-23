import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { authenticatedFetch } from "@/shared/services/api/authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import {
  invalidateChatSessionQuery,
  invalidateReelsUsageAndUsageStats,
} from "@/shared/lib/query-invalidation";
import { debugLog } from "@/shared/utils/debug/debug";
import type { ChatMessage } from "../types/chat.types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default overlay id; overridden per send via streamingIdRef. */
export const STREAMING_MESSAGE_ID = "streaming-ai-response";

const STREAM_REQUEST_TIMEOUT_MS = 120_000;

/**
 * Tools that persist content — drives the “saving” indicator in the UI.
 */
const CONTENT_WRITING_TOOLS = new Set([
  "save_content",
  "iterate_content",
  "edit_content_field",
]);

// ---------------------------------------------------------------------------
// Query cache shape (session detail)
// ---------------------------------------------------------------------------

type ChatSessionQueryData = {
  session: unknown;
  messages: ChatMessage[];
};

// ---------------------------------------------------------------------------
// SSE / stream parsing (module scope keeps the hook thin)
// ---------------------------------------------------------------------------

/**
 * Strips `<tool_call>...</tool_call>` from streamed text so the chat UI stays clean
 * when models emit tool XML as plain text (e.g. some OpenRouter models).
 */
function filterToolCallXml(text: string): string {
  let filtered = text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
    .trimEnd();
  const openIdx = filtered.lastIndexOf("<tool_call>");
  if (openIdx !== -1) {
    filtered = filtered.substring(0, openIdx).trimEnd();
  }
  return filtered;
}

type StreamIngestState = {
  accumulated: string;
  textDeltaCount: number;
};

type StreamIngestSetters = {
  setStreamingContent: (value: string | null) => void;
  setIsSavingContent: (value: boolean) => void;
  setStreamingContentId: (value: number | null) => void;
  setStreamError: (value: string | null) => void;
};

function parseSseDataPayload(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("data: ")) return null;
  return trimmed.slice(6);
}

function accumulatedMentionsContentWritingTool(accumulated: string): boolean {
  if (!accumulated.includes("<tool_call>")) return false;
  for (const name of CONTENT_WRITING_TOOLS) {
    if (accumulated.includes(name)) return true;
  }
  return false;
}

function processStreamSseLine(
  line: string,
  state: StreamIngestState,
  setters: StreamIngestSetters
): void {
  const jsonStr = parseSseDataPayload(line);
  if (jsonStr === null) return;
  if (jsonStr === "[DONE]") {
    debugLog.info("[ChatStream] Received [DONE] signal");
    return;
  }

  try {
    const chunk = JSON.parse(jsonStr) as {
      type: string;
      [key: string]: unknown;
    };

    debugLog.debug("[ChatStream] Processed chunk", { chunk });

    switch (chunk.type) {
      case "text-delta": {
        state.textDeltaCount++;
        state.accumulated += (chunk.delta as string) ?? "";
        const displayText = filterToolCallXml(state.accumulated);
        setters.setStreamingContent(displayText || null);
        if (accumulatedMentionsContentWritingTool(state.accumulated)) {
          setters.setIsSavingContent(true);
        }
        if (state.textDeltaCount % 20 === 0) {
          debugLog.debug("[ChatStream] text-delta progress", {
            textDeltaCount: state.textDeltaCount,
            accumulatedLength: state.accumulated.length,
          });
        }
        break;
      }
      case "tool-input-start": {
        debugLog.info("[ChatStream] tool-input-start received", {
          toolName: chunk.toolName,
        });
        if (CONTENT_WRITING_TOOLS.has(chunk.toolName as string)) {
          setters.setIsSavingContent(true);
        }
        break;
      }
      case "tool-output-available": {
        const output = chunk.output as {
          contentId?: number;
          success?: boolean;
        } | null;
        debugLog.info("[ChatStream] tool-output-available received", {
          toolName: chunk.toolName,
          success: output?.success,
          contentId: output?.contentId,
        });
        if (output?.contentId) {
          setters.setStreamingContentId(output.contentId);
        }
        setters.setIsSavingContent(false);
        break;
      }
      case "error": {
        const errorText = (chunk.errorText as string) || "An error occurred";
        debugLog.error("[ChatStream] Error chunk received from server", {
          errorText,
        });
        setters.setStreamError(errorText);
        break;
      }
      default:
        debugLog.debug("[ChatStream] SSE event", { type: chunk.type });
    }
  } catch {
    // malformed chunk — skip
  }
}

async function drainSseStreamIntoIngest(
  body: ReadableStream<Uint8Array>,
  ingest: StreamIngestState,
  setters: StreamIngestSetters
): Promise<{ chunkCount: number }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let chunkCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunkCount++;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      processStreamSseLine(line, ingest, setters);
    }
  }
  if (buffer) processStreamSseLine(buffer, ingest, setters);

  return { chunkCount };
}

// ---------------------------------------------------------------------------
// sendMessage helpers
// ---------------------------------------------------------------------------

function buildOptimisticUserMessage(
  sessionId: string,
  content: string,
  reelRefs?: number[],
  mediaRefs?: string[]
): ChatMessage {
  return {
    id: `optimistic-${Date.now()}`,
    sessionId,
    role: "user",
    content,
    reelRefs,
    mediaRefs,
    createdAt: new Date().toISOString(),
  };
}

function clearVisibleStreamMessages(
  setOptimisticUserMessage: (msg: ChatMessage | null) => void,
  setStreamingContent: (text: string | null) => void
): void {
  setOptimisticUserMessage(null);
  setStreamingContent(null);
}

/**
 * Handles 403 with usage-limit payload. Invalidates usage queries when applicable.
 * @returns whether the caller should abort (no further response handling).
 */
async function handleChatMessagesForbiddenResponse(
  response: Response,
  queryClient: QueryClient
): Promise<boolean> {
  if (response.status !== 403) return false;
  const body = await response.json().catch(() => ({}));
  const code = (body as { code?: string }).code;
  debugLog.warn("[ChatStream] 403 response", { code });
  if (code !== "USAGE_LIMIT_REACHED") return false;

  debugLog.warn("[ChatStream] Usage limit reached — aborting stream");
  void invalidateReelsUsageAndUsageStats(queryClient);
  return true;
}

/**
 * Merges optimistic user + pending assistant text into the session query cache
 * in one update so the UI does not flash four messages for a frame.
 *
 * Uses `ai-pending-*` (not `streamingIdRef`) so the overlay row and cache row
 * never share an id during the synchronous `setQueryData` → render window.
 */
function patchSessionCacheAfterStream(
  queryClient: QueryClient,
  sessionId: string,
  optimisticUser: ChatMessage,
  assistantText: string
): void {
  const pendingAssistant: ChatMessage[] = assistantText
    ? [
        {
          id: `ai-pending-${Date.now()}`,
          sessionId,
          role: "assistant",
          content: assistantText,
          createdAt: new Date().toISOString(),
        },
      ]
    : [];

  queryClient.setQueryData(
    queryKeys.api.chatSession(sessionId),
    (old: ChatSessionQueryData | undefined) => {
      if (!old) return old;
      return {
        ...old,
        messages: [...old.messages, optimisticUser, ...pendingAssistant],
      };
    }
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatStream(sessionId: string) {
  const queryClient = useQueryClient();
  const [optimisticUserMessage, setOptimisticUserMessage] =
    useState<ChatMessage | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [streamingContentId, setStreamingContentId] = useState<number | null>(
    null
  );
  const abortRef = useRef<AbortController | null>(null);
  const streamingIdRef = useRef<string>(STREAMING_MESSAGE_ID);

  useEffect(() => {
    abortRef.current?.abort();
    setOptimisticUserMessage(null);
    setStreamingContent(null);
    setIsStreaming(false);
    setStreamError(null);
    setIsSavingContent(false);
    setStreamingContentId(null);
  }, [sessionId]);

  const sendMessage = useCallback(
    async (
      content: string,
      reelRefs?: number[],
      activeContentId?: number,
      mediaRefs?: string[]
    ) => {
      if (!sessionId || isStreaming) return;

      debugLog.info("[ChatStream] sendMessage called", {
        sessionId,
        contentLength: content.length,
        reelRefsCount: reelRefs?.length ?? 0,
        reelRefs,
      });

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      streamingIdRef.current = `streaming-${sessionId}-${Date.now()}`;

      const optimisticMsg = buildOptimisticUserMessage(
        sessionId,
        content,
        reelRefs,
        mediaRefs
      );
      setOptimisticUserMessage(optimisticMsg);
      setStreamingContent("");
      setIsStreaming(true);
      setStreamError(null);
      setIsSavingContent(false);
      setStreamingContentId(null);

      debugLog.info(
        "[ChatStream] Optimistic user message set, sending HTTP POST"
      );

      try {
        const fetchStart = Date.now();
        const response = await authenticatedFetch(
          `/api/chat/sessions/${sessionId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content,
              reelRefs,
              activeContentId,
              mediaRefs,
            }),
            signal: controller.signal,
          },
          STREAM_REQUEST_TIMEOUT_MS
        );

        debugLog.info("[ChatStream] HTTP response received", {
          status: response.status,
          ok: response.ok,
          ttfbMs: Date.now() - fetchStart,
          contentType: response.headers.get("content-type"),
        });

        if (await handleChatMessagesForbiddenResponse(response, queryClient)) {
          setIsLimitReached(true);
          clearVisibleStreamMessages(
            setOptimisticUserMessage,
            setStreamingContent
          );
          return;
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error("No response body");

        debugLog.info("[ChatStream] Starting SSE stream read");

        const ingest: StreamIngestState = {
          accumulated: "",
          textDeltaCount: 0,
        };
        const setters: StreamIngestSetters = {
          setStreamingContent,
          setIsSavingContent,
          setStreamingContentId,
          setStreamError,
        };

        const { chunkCount } = await drainSseStreamIntoIngest(
          response.body,
          ingest,
          setters
        );

        debugLog.info("[ChatStream] Stream complete", {
          chunkCount,
          textDeltaCount: ingest.textDeltaCount,
          finalContentLength: ingest.accumulated.length,
        });

        patchSessionCacheAfterStream(
          queryClient,
          sessionId,
          optimisticMsg,
          ingest.accumulated
        );
        clearVisibleStreamMessages(
          setOptimisticUserMessage,
          setStreamingContent
        );

        debugLog.info("[ChatStream] Triggering background session refresh");
        void invalidateChatSessionQuery(queryClient, sessionId);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          debugLog.info("[ChatStream] Stream aborted by user");
        } else {
          debugLog.error("[ChatStream] Stream error", {
            name: err instanceof Error ? err.name : "Unknown",
            message: err instanceof Error ? err.message : String(err),
          });
          if (err instanceof Error) setStreamError(err.message);
        }
        clearVisibleStreamMessages(
          setOptimisticUserMessage,
          setStreamingContent
        );
      } finally {
        debugLog.info(
          "[ChatStream] sendMessage finished — resetting streaming state"
        );
        setIsStreaming(false);
        setIsSavingContent(false);
      }
    },
    [sessionId, isStreaming, queryClient]
  );

  const resetLimitReached = useCallback(() => {
    setIsLimitReached(false);
  }, []);

  return {
    sendMessage,
    optimisticUserMessage,
    streamingContent,
    streamingMessageId: streamingIdRef.current,
    isStreaming,
    streamError,
    isLimitReached,
    isSavingContent,
    streamingContentId,
    resetLimitReached,
  };
}
