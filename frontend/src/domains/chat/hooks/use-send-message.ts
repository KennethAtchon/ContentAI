import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateAfterChatMessageSent } from "@/app/query/query-invalidation";
import { chatService } from "../api/chat.service";
import type { SendMessageRequest } from "../model/chat.types";

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
