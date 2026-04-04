import { useState, useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateChatSessionQuery } from "@/shared/lib/query-invalidation";
import { debugLog } from "@/shared/utils/debug/debug";
import type { ChatMessage } from "../types/chat.types";
import { chatService } from "../services/chat.service";
import {
  drainSseStreamIntoIngest,
  type StreamIngestState,
  type StreamIngestSetters,
} from "../streaming/sse-client";
import {
  STREAMING_MESSAGE_ID,
  STREAM_REQUEST_TIMEOUT_MS,
  buildOptimisticUserMessage,
  clearVisibleStreamMessages,
  handleChatMessagesForbiddenResponse,
  patchSessionCacheAfterStream,
} from "./chat-stream-helpers";

export { STREAMING_MESSAGE_ID } from "./chat-stream-helpers";

export function useChatStream(sessionId: string) {
  const queryClient = useQueryClient();
  const [optimisticUserMessage, setOptimisticUserMessage] =
    useState<ChatMessage | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [streamingContentIds, setStreamingContentIds] = useState<number[]>([]);
  const [latestStreamingContentId, setLatestStreamingContentId] = useState<
    number | null
  >(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingIdRef = useRef<string>(STREAMING_MESSAGE_ID);

  useEffect(() => {
    abortRef.current?.abort();
    setOptimisticUserMessage(null);
    setStreamingContent(null);
    setIsStreaming(false);
    setStreamError(null);
    setIsSavingContent(false);
    setStreamingContentIds([]);
    setLatestStreamingContentId(null);
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
      setStreamingContentIds([]);
      setLatestStreamingContentId(null);

      debugLog.info(
        "[ChatStream] Optimistic user message set, sending HTTP POST"
      );

      try {
        const fetchStart = Date.now();
        const response = await chatService.streamMessage(
          sessionId,
          { content, reelRefs, activeContentId, mediaRefs },
          STREAM_REQUEST_TIMEOUT_MS,
          controller.signal
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
          appendStreamingContentId: (contentId) => {
            setStreamingContentIds((current) =>
              current.includes(contentId) ? current : [...current, contentId]
            );
            setLatestStreamingContentId(contentId);
          },
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
    streamingContentIds,
    latestStreamingContentId,
    resetLimitReached,
  };
}
