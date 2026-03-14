import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/shared/components/ui/button";
import { useQueryFetcher } from "@/shared/hooks/use-query-fetcher";
import { queryKeys } from "@/shared/lib/query-keys";
import { useApp } from "@/shared/contexts/app-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  Plus,
  MessageSquare,
  Trash2,
  FolderOpen,
  Edit3,
  Check,
  X,
} from "lucide-react";
import { debugLog } from "@/shared/utils/debug/debug";
import {
  useProjects,
  useCreateProject,
  useDeleteProject,
  useUpdateProject,
} from "../hooks/use-projects";
import {
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
  useUpdateChatSession,
} from "../hooks/use-chat-sessions";
import { CreateProjectModal } from "./CreateProjectModal";
import type { Project, ChatSession } from "../types/chat.types";

interface ProjectSidebarProps {
  selectedProjectId?: string;
  selectedSessionId?: string;
  onProjectSelect: (project: Project) => void;
  onSessionSelect: (session: ChatSession) => void;
  onNewProject: () => void;
  showNewProjectForm: boolean;
  onHideNewProjectForm: () => void;
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const pct = limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const isNearLimit = pct >= 80;
  const isAtLimit = pct >= 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground truncate">{label}</span>
        <span
          className={
            isAtLimit
              ? "text-red-500 font-semibold"
              : isNearLimit
                ? "text-amber-500"
                : "text-muted-foreground"
          }
        >
          {used}/{limit === -1 ? "∞" : limit}
        </span>
      </div>
      {limit > 0 && (
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isAtLimit
                ? "bg-red-500"
                : isNearLimit
                  ? "bg-amber-500"
                  : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

interface UsageStats {
  contentGenerated: number;
  contentGeneratedLimit: number;
  reelsAnalyzed: number;
  reelsAnalyzedLimit: number;
}

export function ProjectSidebar({
  selectedProjectId,
  selectedSessionId,
  onProjectSelect,
  onSessionSelect,
  onNewProject,
  showNewProjectForm,
  onHideNewProjectForm,
}: ProjectSidebarProps) {
  const { t } = useTranslation();
  const { user } = useApp();
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
    } catch (error) {
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
    } catch (error) {
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

  return (
    <div className="w-72 h-full border-r bg-background flex flex-col shrink-0">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("studio_chat_projects")}</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={onNewProject}
          className="h-7 w-7 p-0"
          aria-label={t("studio_chat_newProject")}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <CreateProjectModal
        open={showNewProjectForm}
        onOpenChange={onHideNewProjectForm}
        projectName={newProjectName}
        projectDescription={newProjectDescription}
        onProjectNameChange={setNewProjectName}
        onProjectDescriptionChange={setNewProjectDescription}
        onCreateProject={handleCreateProject}
        isCreating={createProjectMutation.isPending}
      />

      <div className="flex-1 overflow-y-auto py-2">
        {projectsLoading ? (
          <div className="px-4 py-3 text-xs text-muted-foreground">
            {t("studio_chat_loadingProjects")}
          </div>
        ) : !projects?.length ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center gap-3">
            <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("studio_chat_noProjects")}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {t("studio_chat_noProjectsDescription")}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onNewProject}
              className="mt-1"
            >
              <Plus className="h-3 w-3 mr-1.5" />
              {t("studio_chat_newProject")}
            </Button>
          </div>
        ) : (
          <div className="space-y-1 px-2">
            {projects.map((project) => (
              <div key={project.id}>
                <div
                  className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    selectedProjectId === project.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => onProjectSelect(project)}
                >
                  <div className="flex-1 min-w-0">
                    {editingProjectId === project.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingProjectName}
                          onChange={(e) =>
                            setEditingProjectName(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveProjectName();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              handleCancelEditingProject();
                            }
                          }}
                          className="flex-1 text-sm bg-transparent border-b border-primary outline-none"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 hover:text-primary shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveProjectName();
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 hover:text-muted-foreground shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEditingProject();
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium truncate">
                          {project.name}
                        </p>
                        {project.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {project.description}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  {editingProjectId !== project.id && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 shrink-0"
                        aria-label={t("studio_chat_addSession")}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateSession(project.id);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 shrink-0"
                        aria-label={t("studio_chat_renameProject")}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditingProject(project);
                        }}
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:text-destructive"
                        aria-label={t("studio_chat_deleteProject")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteProjectId(project.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {selectedProjectId === project.id && (
                  <div className="ml-3 pl-3 border-l mt-1 mb-1 space-y-0.5">
                    {sessionsLoading ? (
                      <div className="text-xs text-muted-foreground px-2 py-1">
                        {t("studio_chat_loadingSessions")}
                      </div>
                    ) : sessions?.length ? (
                      sessions.map((session) => (
                        <div
                          key={session.id}
                          className={`group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                            selectedSessionId === session.id
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-muted"
                          }`}
                          onClick={() => onSessionSelect(session)}
                        >
                          <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {editingSessionId === session.id ? (
                            <div className="flex-1 flex items-center gap-1">
                              <input
                                type="text"
                                value={editingSessionTitle}
                                onChange={(e) =>
                                  setEditingSessionTitle(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveSessionTitle();
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    handleCancelEditingSession();
                                  }
                                }}
                                className="flex-1 text-xs bg-transparent border-b border-primary outline-none"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-4 w-4 p-0 hover:text-primary shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveSessionTitle();
                                }}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-4 w-4 p-0 hover:text-muted-foreground shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEditingSession();
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <span className="flex-1 text-xs truncate">
                                {session.title}
                              </span>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-4 w-4 p-0 shrink-0"
                                  aria-label={t("studio_chat_renameSession")}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEditingSession(session);
                                  }}
                                >
                                  <Edit3 className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-4 w-4 p-0 hover:text-destructive shrink-0"
                                  aria-label={t("studio_chat_deleteSession")}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteSessionId(session.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage summary */}
      {usageData && (
        <div className="p-3 border-t space-y-2">
          <UsageBar
            label={t("studio_generate_usage_generations")}
            used={usageData.contentGenerated}
            limit={usageData.contentGeneratedLimit}
          />
          <UsageBar
            label={t("studio_generate_usage_analyses")}
            used={usageData.reelsAnalyzed}
            limit={usageData.reelsAnalyzedLimit}
          />
          {(usageData.contentGenerated >= usageData.contentGeneratedLimit ||
            usageData.reelsAnalyzed >= usageData.reelsAnalyzedLimit) && (
            <a
              href="/pricing"
              className="block w-full text-center text-[11px] font-semibold py-1.5 rounded-md bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 transition-colors"
            >
              {t("studio_generate_upgrade")}
            </a>
          )}
        </div>
      )}

      <AlertDialog
        open={!!deleteProjectId}
        onOpenChange={(open) => !open && setDeleteProjectId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("studio_chat_deleteProjectTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("studio_chat_deleteProjectDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("studio_chat_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("studio_chat_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteSessionId}
        onOpenChange={(open) => !open && setDeleteSessionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("studio_chat_deleteSessionTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("studio_chat_deleteSessionDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("studio_chat_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("studio_chat_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
