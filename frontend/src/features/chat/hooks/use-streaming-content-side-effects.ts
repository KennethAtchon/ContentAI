import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import {
  invalidateChatProjectsQueries,
  invalidateEditorProjectsQueries,
  invalidateQueueQueries,
  invalidateSessionDrafts,
} from "@/shared/lib/query-invalidation";
import { debugLog } from "@/shared/utils/debug/debug";

/**
 * When chat stream finishes saving generated content, refresh queue cache and
 * ensure an editor project exists for that content (409 project_exists is benign).
 */
export function useStreamingContentSideEffects(
  sessionId: string,
  streamingContentIds: number[],
  queryClient: QueryClient
): void {
  const processedIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    processedIdsRef.current.clear();
  }, [sessionId]);

  useEffect(() => {
    const newContentIds = streamingContentIds.filter((contentId) => {
      if (processedIdsRef.current.has(contentId)) {
        return false;
      }
      processedIdsRef.current.add(contentId);
      return true;
    });

    if (newContentIds.length === 0) return;

    for (const contentId of newContentIds) {
      void invalidateQueueQueries(queryClient);
      void invalidateSessionDrafts(queryClient, sessionId);
      void authenticatedFetchJson("/api/editor", {
        method: "POST",
        body: JSON.stringify({ generatedContentId: contentId }),
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
            contentId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }
  }, [sessionId, streamingContentIds, queryClient]);
}
