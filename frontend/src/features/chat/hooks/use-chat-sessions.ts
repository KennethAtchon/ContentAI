import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatService } from "../services/chat.service";
import type { CreateSessionRequest, UpdateSessionRequest } from "../types/chat.types";

export const useChatSessions = (projectId?: string) => {
  return useQuery({
    queryKey: ["chat-sessions", projectId],
    queryFn: () => chatService.getChatSessions(projectId),
  });
};

export const useChatSession = (id: string) => {
  return useQuery({
    queryKey: ["chat-sessions", id],
    queryFn: () => chatService.getChatSession(id),
    enabled: !!id,
  });
};

export const useCreateChatSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (session: CreateSessionRequest) =>
      chatService.createChatSession(session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
  });
};

export const useDeleteChatSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => chatService.deleteChatSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
  });
};

export const useUpdateChatSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateSessionRequest }) =>
      chatService.updateChatSession(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
    },
  });
};
