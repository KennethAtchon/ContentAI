import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatService } from "../services/chat.service";
import { debugLog } from "@/shared/utils/debug/debug";
import type { SendMessageRequest } from "../types/chat.types";

export const useChatStream = (sessionId: string) => {
  const queryClient = useQueryClient();
  const sendMessageMutation = useMutation({
    mutationFn: (message: SendMessageRequest) =>
      chatService.sendMessage(sessionId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
    onError: (error) => {
      debugLog.error("Chat streaming error", {
        service: "chat-hooks",
        operation: "useChatStream",
        error: error instanceof Error ? error.message : String(error),
      });
    },
  });

  // Mock streaming interface for compatibility
  const messages = []; // Will be populated by useChatSession
  const input = "";
  const handleInputChange = () => {};
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // This is handled by the individual components
  };
  const isLoading = sendMessageMutation.isPending;

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages: () => {}, // No-op for compatibility
  };
};
