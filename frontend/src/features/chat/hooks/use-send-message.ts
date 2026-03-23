import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateAfterChatMessageSent } from "@/shared/lib/query-invalidation";
import { chatService } from "../services/chat.service";
import type { SendMessageRequest } from "../types/chat.types";

export const useSendMessage = (sessionId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: SendMessageRequest) =>
      chatService.sendMessage(sessionId, message),
    onSuccess: () => {
      void invalidateAfterChatMessageSent(queryClient, sessionId);
    },
  });
};
