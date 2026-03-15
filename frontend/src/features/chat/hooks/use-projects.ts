import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/shared/contexts/app-context";
import { chatService } from "../services/chat.service";
import type {
  CreateProjectRequest,
  UpdateProjectRequest,
} from "../types/chat.types";

export const useProjects = () => {
  const { user } = useApp();
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => chatService.getProjects(),
    enabled: !!user,
  });
};

export const useProject = (id: string) => {
  return useQuery({
    queryKey: ["projects", id],
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
      queryClient.invalidateQueries({ queryKey: ["projects"] });
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
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => chatService.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};
