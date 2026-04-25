import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/app/query/query-keys";
import { chatService } from "../api/chat.service";

export function useSessionDrafts(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.api.sessionDrafts(sessionId ?? ""),
    queryFn: () => chatService.getSessionDrafts(sessionId!),
    enabled: !!sessionId,
  });
}
