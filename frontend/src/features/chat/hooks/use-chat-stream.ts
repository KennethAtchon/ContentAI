import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authenticatedFetch } from "@/shared/services/api/authenticated-fetch";
import { queryKeys } from "@/shared/lib/query-keys";
import { debugLog } from "@/shared/utils/debug/debug";
import type { ChatMessage } from "../types/chat.types";

// Stable fallback used as default; overridden per-invocation via streamingIdRef.
export const STREAMING_MESSAGE_ID = "streaming-ai-response";

/**
 * Tools that write content to the DB — triggers the saving indicator in the UI.
 * Add a tool name here when it produces persisted content.
 */
const CONTENT_WRITING_TOOLS = new Set([
  "save_content",
  "iterate_content",
  "edit_content_field",
]);

/**
 * Strips <tool_call>...</tool_call> XML blocks from streamed text.
 * Some models (e.g. certain OpenRouter models without native function calling)
 * output tool invocations as raw XML text instead of structured tool calls.
 * This keeps the chat display clean while the SDK-level tool handling runs.
 */
function filterToolCallXml(text: string): string {
  // Remove fully-received tool call blocks
  let filtered = text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
    .trimEnd();
  // Remove an in-progress (partially streamed) block at the end
  const openIdx = filtered.lastIndexOf("<tool_call>");
  if (openIdx !== -1) {
    filtered = filtered.substring(0, openIdx).trimEnd();
  }
  return filtered;
}

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
  // Pinned once per sendMessage call so the streaming message key is stable
  // for the entire lifecycle of a single AI response.
  const streamingIdRef = useRef<string>(STREAMING_MESSAGE_ID);

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
      // Pin a stable ID for this response's streaming message so the React
      // key never changes mid-stream (avoids unnecessary remounts).
      streamingIdRef.current = `streaming-${sessionId}-${Date.now()}`;

      // Show user message immediately — keep a local ref to reuse in setQueryData.
      const optimisticMsg: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        sessionId,
        role: "user",
        content,
        reelRefs,
        mediaRefs,
        createdAt: new Date().toISOString(),
      };
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
            body: JSON.stringify({ content, reelRefs, activeContentId, mediaRefs }),
            signal: controller.signal,
          },
          120_000 // 2-min timeout for streaming
        );

        debugLog.info("[ChatStream] HTTP response received", {
          status: response.status,
          ok: response.ok,
          ttfbMs: Date.now() - fetchStart,
          contentType: response.headers.get("content-type"),
        });

        if (response.status === 403) {
          const body = await response.json().catch(() => ({}));
          const code = (body as { code?: string }).code;
          debugLog.warn("[ChatStream] 403 response", { code });
          if (code === "USAGE_LIMIT_REACHED") {
            debugLog.warn("[ChatStream] Usage limit reached — aborting stream");
            setIsLimitReached(true);
            setOptimisticUserMessage(null);
            setStreamingContent(null);
            queryClient.invalidateQueries({
              queryKey: queryKeys.api.reelsUsage(),
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.api.usageStats(),
            });
            return;
          }
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error("No response body");

        debugLog.info("[ChatStream] Starting SSE stream read");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        let chunkCount = 0;
        let textDeltaCount = 0;

        const processLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) return;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") {
            debugLog.info("[ChatStream] Received [DONE] signal");
            return;
          }

          try {
            const chunk = JSON.parse(jsonStr) as {
              type: string;
              [key: string]: unknown;
            };

            if (chunk.type === "text-delta") {
              textDeltaCount++;
              accumulated += (chunk.delta as string) ?? "";
              // Filter tool call XML that some models emit as plain text
              // instead of structured function calls (e.g. certain OpenRouter models)
              const displayText = filterToolCallXml(accumulated);
              setStreamingContent(displayText || null);
              // Detect text-based tool calls (XML fallback path) to show saving indicator
              if (accumulated.includes("<tool_call>")) {
                const isWritingTool = [...CONTENT_WRITING_TOOLS].some((name) =>
                  accumulated.includes(name)
                );
                if (isWritingTool) setIsSavingContent(true);
              }
              if (textDeltaCount % 20 === 0) {
                debugLog.debug("[ChatStream] text-delta progress", {
                  textDeltaCount,
                  accumulatedLength: accumulated.length,
                });
              }
            } else if (chunk.type === "tool-input-start") {
              debugLog.info("[ChatStream] tool-input-start received", {
                toolName: chunk.toolName,
              });
              if (CONTENT_WRITING_TOOLS.has(chunk.toolName as string)) {
                setIsSavingContent(true);
              }
            } else if (chunk.type === "tool-output-available") {
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
                setStreamingContentId(output.contentId);
              }
              setIsSavingContent(false);
            } else if (chunk.type === "error") {
              const errorText =
                (chunk.errorText as string) || "An error occurred";
              debugLog.error("[ChatStream] Error chunk received from server", {
                errorText,
              });
              setStreamError(errorText);
            } else {
              debugLog.debug("[ChatStream] SSE event", { type: chunk.type });
            }
          } catch {
            // skip malformed chunk
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            debugLog.info("[ChatStream] Reader done", { chunkCount });
            break;
          }
          chunkCount++;
          buffer += decoder.decode(value, { stream: true });

          // Split on newlines; keep the last incomplete line in the buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) processLine(line);
        }

        // Flush any data remaining in the buffer after the stream closes
        if (buffer) processLine(buffer);

        debugLog.info("[ChatStream] Stream complete", {
          totalChunks: chunkCount,
          textDeltaCount,
          finalContentLength: accumulated.length,
        });

        // Inject the final messages into the TanStack Query cache and clear
        // optimistic state in the same synchronous batch. This prevents the
        // 4-message flash (server user + server AI + optimistic user +
        // streaming AI all visible simultaneously for one render frame).
        queryClient.setQueryData(
          ["chat-sessions", sessionId],
          (old: { session: unknown; messages: ChatMessage[] } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              messages: [
                ...old.messages,
                optimisticMsg,
                ...(accumulated
                  ? [
                      {
                        // Use a distinct temp ID — not streamingIdRef.current —
                        // to avoid a duplicate-key collision: useSyncExternalStore
                        // forces a synchronous render from setQueryData before the
                        // setStreamingContent(null) setState is committed, so the
                        // overlay message (id=streamingIdRef.current) briefly
                        // coexists with the injected cache entry.
                        id: `ai-pending-${Date.now()}`,
                        sessionId,
                        role: "assistant" as const,
                        content: accumulated,
                        createdAt: new Date().toISOString(),
                      },
                    ]
                  : []),
              ],
            };
          }
        );
        setOptimisticUserMessage(null);
        setStreamingContent(null);

        // Background refetch to replace temp IDs with real server IDs.
        debugLog.info("[ChatStream] Triggering background session refresh");
        void queryClient.invalidateQueries({
          queryKey: ["chat-sessions", sessionId],
        });
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
        setOptimisticUserMessage(null);
        setStreamingContent(null);
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
