import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatService } from "../services/chat.service";
import type { SendMessageRequest } from "../types/chat.types";

export const useSendMessage = (sessionId: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (message: SendMessageRequest) => chatService.sendMessage(sessionId, message),
    onSuccess: () => {
      // Invalidate the specific session to refetch messages
      queryClient.invalidateQueries({ queryKey: ["chat-sessions", sessionId] });
      // Invalidate the sessions list to update message count
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
  });
};
