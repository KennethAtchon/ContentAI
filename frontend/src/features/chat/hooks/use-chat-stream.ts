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
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [streamingContentId, setStreamingContentId] = useState<number | null>(
    null
  );
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string, reelRefs?: number[]) => {
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
        reelRefs,
        createdAt: new Date().toISOString(),
      });
      setStreamingContent("");
      setIsStreaming(true);
      setStreamError(null);
      setIsSavingContent(false);
      setStreamingContentId(null);

      try {
        const response = await authenticatedFetch(
          `/api/chat/sessions/${sessionId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, reelRefs }),
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
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines (SSE format: "data: {...}\n\n")
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.slice(6); // strip "data: "
            if (jsonStr === "[DONE]") continue;

            try {
              const chunk = JSON.parse(jsonStr) as {
                type: string;
                [key: string]: unknown;
              };

              if (chunk.type === "text-delta") {
                accumulated += (chunk.delta as string) ?? "";
                setStreamingContent(accumulated);
              } else if (
                chunk.type === "tool-input-start" &&
                (chunk.toolName === "save_content" ||
                  chunk.toolName === "iterate_content")
              ) {
                setIsSavingContent(true);
              } else if (chunk.type === "tool-output-available") {
                const output = chunk.output as {
                  contentId?: number;
                  success?: boolean;
                } | null;
                if (output?.contentId) {
                  setStreamingContentId(output.contentId);
                }
                setIsSavingContent(false);
              }
            } catch {
              // skip malformed lines
            }
          }
        }

        // Flush remaining buffer
        if (buffer.trim().startsWith("data: ")) {
          try {
            const jsonStr = buffer.trim().slice(6);
            const chunk = JSON.parse(jsonStr) as {
              type: string;
              delta?: string;
            };
            if (chunk.type === "text-delta" && chunk.delta) {
              accumulated += chunk.delta;
              setStreamingContent(accumulated);
            }
          } catch {
            // ignore
          }
        }

        // Refresh persisted messages after stream ends
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
        setIsSavingContent(false);
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
    isSavingContent,
    streamingContentId,
  };
}
