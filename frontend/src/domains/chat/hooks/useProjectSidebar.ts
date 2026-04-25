import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { debugLog } from "@/shared/debug/debug";
import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import { queryKeys } from "@/app/query/query-keys";
import { useApp } from "@/app/state/app-context";
import { useSubscription } from "@/domains/subscriptions/hooks/use-subscription";
import { chatService } from "../api/chat.service";
import {
  useProjects,
  useCreateProject,
  useDeleteProject,
  useUpdateProject,
} from "./use-projects";
import {
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
  useUpdateChatSession,
} from "./use-chat-sessions";
import type { Project, ChatSession } from "../model/chat.types";

interface UsageStats {
  contentGenerated: number;
  contentGeneratedLimit: number;
  reelsAnalyzed: number;
  reelsAnalyzedLimit: number;
}

interface UseProjectSidebarParams {
  selectedProjectId?: string;
  selectedSessionId?: string;
  onHideNewProjectForm: () => void;
  onSessionSelect: (session: ChatSession) => void;
  onSessionDeleted?: () => void;
}

export function useProjectSidebar({
  selectedProjectId,
  selectedSessionId,
  onHideNewProjectForm,
  onSessionSelect,
  onSessionDeleted,
}: UseProjectSidebarParams) {
  const { t } = useTranslation();
  const { user } = useApp();
  const { hasEnterpriseAccess } = useSubscription();
  const usageFetcher = useQueryFetcher<UsageStats>();

  const { data: usageData } = useQuery({
    queryKey: queryKeys.api.usageStats(),
    queryFn: () => usageFetcher("/api/customer/usage"),
    enabled: !!user,
    staleTime: 60_000,
  });

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: sessions, isLoading: sessionsLoading } =
    useChatSessions(selectedProjectId);
  const createProjectMutation = useCreateProject();
  const deleteProjectMutation = useDeleteProject();
  const updateProjectMutation = useUpdateProject();
  const createSessionMutation = useCreateChatSession();
  const deleteSessionMutation = useDeleteChatSession();
  const updateSessionMutation = useUpdateChatSession();
  const { data: deleteSessionPreview, isLoading: deleteSessionPreviewLoading } =
    useQuery({
      queryKey: ["chat-session-delete-preview", deleteSessionId],
      queryFn: () => chatService.getDeleteSessionPreview(deleteSessionId!),
      enabled: !!deleteSessionId,
    });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName) return;

    try {
      await createProjectMutation.mutateAsync({
        name: newProjectName,
        description: newProjectDescription,
      });
      setNewProjectName("");
      setNewProjectDescription("");
      onHideNewProjectForm();
    } catch (error) {
      debugLog.error("Failed to create project", {
        service: "project-sidebar",
        operation: "handleCreateProject",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleCreateSession = async (projectId: string) => {
    try {
      const newSession = await createSessionMutation.mutateAsync({ projectId });
      onSessionSelect(newSession);
    } catch (error) {
      debugLog.error("Failed to create session", {
        service: "project-sidebar",
        operation: "handleCreateSession",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleConfirmDeleteProject = async () => {
    if (!deleteProjectId) return;
    try {
      await deleteProjectMutation.mutateAsync(deleteProjectId);
      if (deleteProjectId === selectedProjectId && onSessionDeleted) {
        onSessionDeleted();
      }
    } catch (error) {
      toast.error("Failed to delete project");
      debugLog.error("Failed to delete project", {
        service: "project-sidebar",
        operation: "handleConfirmDeleteProject",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setDeleteProjectId(null);
    }
  };

  const handleConfirmDeleteSession = async () => {
    if (!deleteSessionId) return;
    try {
      await deleteSessionMutation.mutateAsync(deleteSessionId);
      if (deleteSessionId === selectedSessionId && onSessionDeleted) {
        onSessionDeleted();
      }
    } catch (error) {
      toast.error("Failed to delete session");
      debugLog.error("Failed to delete session", {
        service: "project-sidebar",
        operation: "handleConfirmDeleteSession",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setDeleteSessionId(null);
    }
  };

  const handleStartEditingSession = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditingSessionTitle(session.title);
  };

  const handleCancelEditingSession = () => {
    setEditingSessionId(null);
    setEditingSessionTitle("");
  };

  const handleSaveSessionTitle = async () => {
    if (!editingSessionId || !editingSessionTitle.trim()) return;

    try {
      await updateSessionMutation.mutateAsync({
        id: editingSessionId,
        updates: { title: editingSessionTitle.trim() },
      });
      setEditingSessionId(null);
      setEditingSessionTitle("");
    } catch (error) {
      debugLog.error("Failed to update session", {
        service: "project-sidebar",
        operation: "handleSaveSessionTitle",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleStartEditingProject = (project: Project) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  const handleCancelEditingProject = () => {
    setEditingProjectId(null);
    setEditingProjectName("");
  };

  const handleSaveProjectName = async () => {
    if (!editingProjectId || !editingProjectName.trim()) return;

    try {
      await updateProjectMutation.mutateAsync({
        id: editingProjectId,
        updates: { name: editingProjectName.trim() },
      });
      setEditingProjectId(null);
      setEditingProjectName("");
    } catch (error) {
      debugLog.error("Failed to update project", {
        service: "project-sidebar",
        operation: "handleSaveProjectName",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const usageLimitReached =
    !!usageData &&
    (usageData.contentGenerated >= usageData.contentGeneratedLimit ||
      usageData.reelsAnalyzed >= usageData.reelsAnalyzedLimit);

  return {
    t,
    hasEnterpriseAccess,
    usageData,
    usageLimitReached,
    projects,
    projectsLoading,
    sessions,
    sessionsLoading,
    newProjectName,
    setNewProjectName,
    newProjectDescription,
    setNewProjectDescription,
    deleteProjectId,
    setDeleteProjectId,
    deleteSessionId,
    setDeleteSessionId,
    editingSessionId,
    editingSessionTitle,
    setEditingSessionTitle,
    editingProjectId,
    editingProjectName,
    setEditingProjectName,
    handleCreateProject,
    handleCreateSession,
    handleConfirmDeleteProject,
    handleConfirmDeleteSession,
    handleStartEditingSession,
    handleCancelEditingSession,
    handleSaveSessionTitle,
    handleStartEditingProject,
    handleCancelEditingProject,
    handleSaveProjectName,
    isCreatingProject: createProjectMutation.isPending,
    isDeletingProject: deleteProjectMutation.isPending,
    isDeletingSession: deleteSessionMutation.isPending,
    deleteSessionPreview,
    deleteSessionPreviewLoading,
  };
}
