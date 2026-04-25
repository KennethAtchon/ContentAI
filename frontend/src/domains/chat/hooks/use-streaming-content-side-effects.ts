import { useEffect, useRef } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { authenticatedFetchJson } from "@/shared/api/authenticated-fetch";
import {
  ensureSessionDraftVisible,
  invalidateChatProjectsQueries,
  invalidateEditorProjectsQueries,
  invalidateQueueQueries,
} from "@/app/query/query-invalidation";
import { debugLog } from "@/shared/debug/debug";
import { chatService } from "../api/chat.service";

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
      void ensureSessionDraftVisible(queryClient, sessionId, contentId, () =>
        chatService.getSessionDrafts(sessionId)
      ).catch((err) => {
        debugLog.error("Failed to refresh session drafts after streaming", {
          service: "chat-layout",
          operation: "ensure-session-draft-visible",
          sessionId,
          contentId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
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
