import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/app/state/auth-context";
import { queryKeys } from "@/app/query/query-keys";
import {
  invalidateChatSessionsQueries,
  invalidateChatProjectQueries,
  invalidateChatProjectsQueries,
  removeDeletedChatProjectQueries,
} from "@/app/query/query-invalidation";
import { chatService } from "../api/chat.service";
import type {
  CreateProjectRequest,
  UpdateProjectRequest,
} from "../model/chat.types";

export const useProjects = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.api.projects(),
    queryFn: () => chatService.getProjects(),
    enabled: !!user,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
};

export const useProject = (id: string) => {
  return useQuery({
    queryKey: queryKeys.api.project(id),
    queryFn: () => chatService.getProject(id),
    enabled: !!id,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (project: CreateProjectRequest) =>
      chatService.createProject(project),
    onSuccess: () => {
      void invalidateChatProjectsQueries(queryClient);
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateProjectRequest;
    }) => chatService.updateProject(id, updates),
    onSuccess: (_, { id }) => {
      void invalidateChatProjectQueries(queryClient, id);
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => chatService.deleteProject(id),
    onSuccess: (_result, id) => {
      removeDeletedChatProjectQueries(queryClient, id);
      void Promise.all([
        invalidateChatProjectsQueries(queryClient),
        invalidateChatSessionsQueries(queryClient),
      ]);
    },
    onError: () => {
      toast.error("Failed to delete project");
    },
  });
};
