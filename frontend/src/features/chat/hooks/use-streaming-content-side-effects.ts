import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import {
  invalidateChatProjectsQueries,
  invalidateEditorProjectsQueries,
  invalidateQueueQueries,
} from "@/shared/lib/query-invalidation";
import { debugLog } from "@/shared/utils/debug/debug";

/**
 * When chat stream finishes saving generated content, refresh queue cache and
 * ensure an editor project exists for that content (409 project_exists is benign).
 */
export function useStreamingContentSideEffects(
  streamingContentId: number | null,
  queryClient: QueryClient
): void {
  useEffect(() => {
    if (!streamingContentId) return;
    void invalidateQueueQueries(queryClient);
  }, [streamingContentId, queryClient]);

  useEffect(() => {
    if (!streamingContentId) return;
    void authenticatedFetchJson("/api/editor", {
      method: "POST",
      body: JSON.stringify({ generatedContentId: streamingContentId }),
    })
      .then(() => {
        void invalidateEditorProjectsQueries(queryClient);
        void invalidateChatProjectsQueries(queryClient);
      })
      .catch((err) => {
        const status = (err as { status?: number }).status;
        const body = (err as { body?: { error?: string } }).body;
        if (status === 409 && body?.error === "project_exists") {
          void invalidateEditorProjectsQueries(queryClient);
          void invalidateChatProjectsQueries(queryClient);
          return;
        }
        debugLog.error("Failed to auto-create editor project", {
          service: "chat-layout",
          operation: "auto-create-editor",
          contentId: streamingContentId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, [streamingContentId, queryClient]);
}
