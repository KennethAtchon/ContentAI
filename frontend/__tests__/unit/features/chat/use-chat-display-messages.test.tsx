/// <reference lib="dom" />
import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, renderHook } from "@testing-library/react";
import { useChatDisplayMessages } from "@/domains/chat/hooks/use-chat-display-messages";

describe("useChatDisplayMessages", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps an assistant placeholder visible before the first text delta arrives", () => {
    const { result } = renderHook(() =>
      useChatDisplayMessages({
        serverMessages: [],
        optimisticUserMessage: null,
        streamingContent: "",
        streamingMessageId: "stream-1",
        sessionId: "session-1",
      })
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      id: "stream-1",
      sessionId: "session-1",
      role: "assistant",
      content: "",
    });
  });
});
