import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/shared/contexts/app-context";
import { queryKeys } from "@/shared/lib/query-keys";
import {
  invalidateChatProjectQueries,
  invalidateChatProjectsQueries,
} from "@/shared/lib/query-invalidation";
import { chatService } from "../services/chat.service";
import type {
  CreateProjectRequest,
  UpdateProjectRequest,
} from "../types/chat.types";

export const useProjects = () => {
  const { user } = useApp();
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
    onSuccess: () => {
      void invalidateChatProjectsQueries(queryClient);
    },
  });
};
