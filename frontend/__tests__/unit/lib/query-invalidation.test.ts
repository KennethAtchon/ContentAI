import { describe, expect, it, spyOn } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import {
  ensureSessionDraftVisible,
  invalidateAfterChatMessageSent,
} from "@/app/query/query-invalidation";
import { queryKeys } from "@/app/query/query-keys";

describe("query-invalidation", () => {
  describe("ensureSessionDraftVisible", () => {
    it("keeps refetching until the streamed draft is visible", async () => {
      const client = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      const responses = [
        { drafts: [{ id: 1 }] },
        { drafts: [{ id: 1 }, { id: 42 }] },
      ];
      let fetchCount = 0;

      await ensureSessionDraftVisible(
        client,
        "session-1",
        42,
        async () => {
          const response =
            responses[Math.min(fetchCount, responses.length - 1)];
          fetchCount += 1;
          return response;
        },
        {
          retryDelaysMs: [0, 0],
          wait: async () => {},
        }
      );

      expect(fetchCount).toBe(2);
      expect(
        client.getQueryData<{ drafts: Array<{ id: number }> }>(
          queryKeys.api.sessionDrafts("session-1")
        )
      ).toEqual({ drafts: [{ id: 1 }, { id: 42 }] });
    });

    it("stops after the configured retry window when the draft never appears", async () => {
      const client = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      let fetchCount = 0;

      await ensureSessionDraftVisible(
        client,
        "session-2",
        99,
        async () => {
          fetchCount += 1;
          return { drafts: [{ id: 1 }] };
        },
        {
          retryDelaysMs: [0, 0, 0],
          wait: async () => {},
        }
      );

      expect(fetchCount).toBe(3);
      expect(
        client.getQueryData<{ drafts: Array<{ id: number }> }>(
          queryKeys.api.sessionDrafts("session-2")
        )
      ).toEqual({ drafts: [{ id: 1 }] });
    });
  });

  describe("invalidateAfterChatMessageSent", () => {
    it("refreshes session detail, session drafts, and session lists together", async () => {
      const client = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });
      const invalidateSpy = spyOn(client, "invalidateQueries");

      await invalidateAfterChatMessageSent(client, "session-3");

      const invalidatedKeys = invalidateSpy.mock.calls.map(([filters]) =>
        JSON.stringify((filters as { queryKey?: unknown }).queryKey)
      );

      expect(invalidatedKeys).toContain(
        JSON.stringify(queryKeys.api.chatSession("session-3"))
      );
      expect(invalidatedKeys).toContain(
        JSON.stringify(queryKeys.api.sessionDrafts("session-3"))
      );
      expect(invalidatedKeys).toContain(
        JSON.stringify(queryKeys.api.chatSessionsRoot())
      );

      invalidateSpy.mockRestore();
    });
  });
});
