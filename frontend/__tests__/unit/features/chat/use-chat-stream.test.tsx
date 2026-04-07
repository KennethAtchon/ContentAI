/// <reference lib="dom" />
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { useChatStream } from "@/features/chat/hooks/use-chat-stream";
import { chatService } from "@/features/chat/services/chat.service";
import * as sseClient from "@/features/chat/streaming/sse-client";

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useChatStream", () => {
  afterEach(() => {
    cleanup();
  });

  it("refreshes session detail, drafts, and session lists after a successful stream", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const invalidateSpy = spyOn(client, "invalidateQueries");
    const streamSpy = spyOn(chatService, "streamMessage").mockResolvedValue(
      new Response("stream", {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }) as never
    );
    const drainSpy = spyOn(
      sseClient,
      "drainSseStreamIntoIngest"
    ).mockImplementation(async (_body, ingest) => {
      ingest.accumulated = "Saved draft";
      ingest.textDeltaCount = 1;
      return { chunkCount: 1 };
    });

    const { result } = renderHook(() => useChatStream("session-1"), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.sendMessage("Write me a script");
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(([filters]) =>
      JSON.stringify((filters as { queryKey?: unknown }).queryKey)
    );

    expect(invalidatedKeys).toContain(
      JSON.stringify(queryKeys.api.chatSession("session-1"))
    );
    expect(invalidatedKeys).toContain(
      JSON.stringify(queryKeys.api.sessionDrafts("session-1"))
    );
    expect(invalidatedKeys).toContain(
      JSON.stringify(queryKeys.api.chatSessionsRoot())
    );

    drainSpy.mockRestore();
    streamSpy.mockRestore();
    invalidateSpy.mockRestore();
  });
});
