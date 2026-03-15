import { useQuery } from "@tanstack/react-query";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import type { SessionDraft } from "../types/chat.types";

export function useSessionDrafts(sessionId: string | null) {
  const fetcher = useQueryFetcher<{ drafts: SessionDraft[] }>();
  return useQuery({
    queryKey: queryKeys.api.sessionDrafts(sessionId ?? ""),
    queryFn: () => fetcher(`/api/chat/sessions/${sessionId}/content`),
    enabled: !!sessionId,
  });
}
