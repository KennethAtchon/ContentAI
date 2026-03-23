import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { invalidateChatSessionsQueries } from "@/shared/lib/query-invalidation";
import { chatService } from "../services/chat.service";
import type {
  CreateSessionRequest,
  UpdateSessionRequest,
} from "../types/chat.types";

export const useChatSessions = (projectId?: string) => {
  return useQuery({
    queryKey: [...queryKeys.api.chatSessionsRoot(), projectId],
    queryFn: () => chatService.getChatSessions(projectId),
  });
};

export const useChatSession = (id: string) => {
  return useQuery({
    queryKey: queryKeys.api.chatSession(id),
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
      void invalidateChatSessionsQueries(queryClient);
    },
  });
};

export const useDeleteChatSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => chatService.deleteChatSession(id),
    onSuccess: () => {
      void invalidateChatSessionsQueries(queryClient);
    },
  });
};

export const useUpdateChatSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateSessionRequest;
    }) => chatService.updateChatSession(id, updates),
    onSuccess: () => {
      void invalidateChatSessionsQueries(queryClient);
    },
  });
};
