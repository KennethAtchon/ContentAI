import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
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
import { Plus, MessageSquare, Trash2, FolderOpen } from "lucide-react";
import { debugLog } from "@/shared/utils/debug/debug";
import {
  useProjects,
  useCreateProject,
  useDeleteProject,
} from "../hooks/use-projects";
import {
  useChatSessions,
  useCreateChatSession,
  useDeleteChatSession,
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
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { data: sessions, isLoading: sessionsLoading } =
    useChatSessions(selectedProjectId);
  const createProjectMutation = useCreateProject();
  const deleteProjectMutation = useDeleteProject();
  const createSessionMutation = useCreateChatSession();
  const deleteSessionMutation = useDeleteChatSession();

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

  return (
    <div className="w-72 h-full border-r bg-background flex flex-col shrink-0">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("studio_chat_projects")}</h2>
        <Button size="sm" variant="ghost" onClick={onNewProject} className="h-7 w-7 p-0" aria-label={t("studio_chat_newProject")}>
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
            <Button size="sm" variant="outline" onClick={onNewProject} className="mt-1">
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
                    <p className="text-sm font-medium truncate">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
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
                          <span className="flex-1 text-xs truncate">{session.title}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive shrink-0"
                            aria-label={t("studio_chat_deleteSession")}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteSessionId(session.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
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

      <AlertDialog
        open={!!deleteProjectId}
        onOpenChange={(open) => !open && setDeleteProjectId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("studio_chat_deleteProjectTitle")}</AlertDialogTitle>
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
            <AlertDialogTitle>{t("studio_chat_deleteSessionTitle")}</AlertDialogTitle>
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
