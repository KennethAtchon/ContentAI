import { useMemo } from "react";
import type { ChatMessage } from "../types/chat.types";

export function useChatDisplayMessages(options: {
  serverMessages: ChatMessage[] | undefined;
  optimisticUserMessage: ChatMessage | null;
  streamingContent: string | null;
  streamingMessageId: string;
  sessionId: string;
}): ChatMessage[] {
  const {
    serverMessages,
    optimisticUserMessage,
    streamingContent,
    streamingMessageId,
    sessionId,
  } = options;

  return useMemo((): ChatMessage[] => {
    const server = serverMessages ?? [];
    const serverIds = new Set(server.map((m) => m.id));
    const extra: ChatMessage[] = [];

    if (optimisticUserMessage && !serverIds.has(optimisticUserMessage.id)) {
      extra.push(optimisticUserMessage);
    }
    if (streamingContent !== null) {
      extra.push({
        id: streamingMessageId,
        sessionId,
        role: "assistant",
        content: streamingContent,
        createdAt: new Date().toISOString(),
      });
    }

    return [...server, ...extra];
  }, [
    serverMessages,
    optimisticUserMessage,
    streamingContent,
    streamingMessageId,
    sessionId,
  ]);
}
