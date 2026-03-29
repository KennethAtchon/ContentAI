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
import {
  drainSseStreamIntoIngest,
  type StreamIngestState,
  type StreamIngestSetters,
} from "../services/sse-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default overlay id; overridden per send via streamingIdRef. */
export const STREAMING_MESSAGE_ID = "streaming-ai-response";

const STREAM_REQUEST_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Query cache shape
// ---------------------------------------------------------------------------

type ChatSessionQueryData = {
  session: unknown;
  messages: ChatMessage[];
};

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
  const [streamingContentId, setStreamingContentId] = useState<number | null>(null);
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

      const optimisticMsg = buildOptimisticUserMessage(sessionId, content, reelRefs, mediaRefs);
      setOptimisticUserMessage(optimisticMsg);
      setStreamingContent("");
      setIsStreaming(true);
      setStreamError(null);
      setIsSavingContent(false);
      setStreamingContentId(null);

      debugLog.info("[ChatStream] Optimistic user message set, sending HTTP POST");

      try {
        const fetchStart = Date.now();
        const response = await authenticatedFetch(
          `/api/chat/sessions/${sessionId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, reelRefs, activeContentId, mediaRefs }),
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
          clearVisibleStreamMessages(setOptimisticUserMessage, setStreamingContent);
          return;
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error("No response body");

        debugLog.info("[ChatStream] Starting SSE stream read");

        const ingest: StreamIngestState = { accumulated: "", textDeltaCount: 0 };
        const setters: StreamIngestSetters = {
          setStreamingContent,
          setIsSavingContent,
          setStreamingContentId,
          setStreamError,
        };

        const { chunkCount } = await drainSseStreamIntoIngest(response.body, ingest, setters);

        debugLog.info("[ChatStream] Stream complete", {
          chunkCount,
          textDeltaCount: ingest.textDeltaCount,
          finalContentLength: ingest.accumulated.length,
        });

        patchSessionCacheAfterStream(queryClient, sessionId, optimisticMsg, ingest.accumulated);
        clearVisibleStreamMessages(setOptimisticUserMessage, setStreamingContent);

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
        clearVisibleStreamMessages(setOptimisticUserMessage, setStreamingContent);
      } finally {
        debugLog.info("[ChatStream] sendMessage finished — resetting streaming state");
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
