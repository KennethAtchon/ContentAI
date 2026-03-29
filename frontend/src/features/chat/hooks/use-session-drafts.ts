import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { chatService } from "../services/chat.service";

export function useSessionDrafts(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.api.sessionDrafts(sessionId ?? ""),
    queryFn: () => chatService.getSessionDrafts(sessionId!),
    enabled: !!sessionId,
  });
}
