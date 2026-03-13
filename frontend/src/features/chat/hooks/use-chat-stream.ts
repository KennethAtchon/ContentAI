import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authenticatedFetch } from "@/shared/services/api/authenticated-fetch";
import type { ChatMessage } from "../types/chat.types";

export const STREAMING_MESSAGE_ID = "streaming-ai-response";

export function useChatStream(sessionId: string) {
  const queryClient = useQueryClient();
  const [optimisticUserMessage, setOptimisticUserMessage] =
    useState<ChatMessage | null>(null);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId || isStreaming) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Show user message immediately
      setOptimisticUserMessage({
        id: `optimistic-${Date.now()}`,
        sessionId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      });
      setStreamingContent("");
      setIsStreaming(true);
      setStreamError(null);

      try {
        const response = await authenticatedFetch(
          `/api/chat/sessions/${sessionId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
            signal: controller.signal,
          },
          120_000 // 2-min timeout for streaming
        );

        if (response.status === 403) {
          const body = await response.json().catch(() => ({}));
          if ((body as { code?: string }).code === "USAGE_LIMIT_REACHED") {
            setIsLimitReached(true);
            return;
          }
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setStreamingContent(accumulated);
        }
        accumulated += decoder.decode(); // flush
        setStreamingContent(accumulated);

        // Refresh persisted messages — wait for cache to update before clearing local state
        await queryClient.invalidateQueries({
          queryKey: ["chat-sessions", sessionId],
        });
        await queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setStreamError(err.message);
        }
      } finally {
        setOptimisticUserMessage(null);
        setStreamingContent(null);
        setIsStreaming(false);
      }
    },
    [sessionId, isStreaming, queryClient]
  );

  return {
    sendMessage,
    optimisticUserMessage,
    streamingContent,
    isStreaming,
    streamError,
    isLimitReached,
  };
}
