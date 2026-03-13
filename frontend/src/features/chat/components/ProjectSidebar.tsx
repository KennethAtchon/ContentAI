import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
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
      await createSessionMutation.mutateAsync({ projectId });
    } catch (error) {
      debugLog.error("Failed to create session", {
        service: "project-sidebar",
        operation: "handleCreateSession",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    // TODO: Replace with proper confirmation dialog
    if (window.confirm(t("studio_chat_deleteProjectConfirm"))) {
      try {
        await deleteProjectMutation.mutateAsync(projectId);
      } catch (error) {
        debugLog.error("Failed to delete project", {
          service: "project-sidebar",
          operation: "handleDeleteProject",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    // TODO: Replace with proper confirmation dialog
    if (window.confirm(t("studio_chat_deleteSessionConfirm"))) {
      try {
        await deleteSessionMutation.mutateAsync(sessionId);
      } catch (error) {
        debugLog.error("Failed to delete session", {
          service: "project-sidebar",
          operation: "handleDeleteSession",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  return (
    <div className="w-80 h-full border-r bg-background flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t("studio_chat_projects")}</h2>
          <Button size="sm" onClick={onNewProject}>
            <Plus className="h-4 w-4 mr-2" />
            {t("studio_chat_newProject")}
          </Button>
        </div>
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

      <div className="flex-1 overflow-y-auto">
        {projectsLoading ? (
          <div className="p-4 text-sm text-muted-foreground">
            {t("studio_chat_loadingProjects")}
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {projects?.map((project) => (
              <div key={project.id} className="space-y-2">
                <div
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedProjectId === project.id
                      ? "bg-primary/10 border-primary"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => onProjectSelect(project)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-sm">{project.name}</h3>
                      {project.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                {selectedProjectId === project.id && (
                  <div className="ml-4 space-y-1">
                    {sessionsLoading ? (
                      <div className="text-xs text-muted-foreground">
                        {t("studio_chat_loadingSessions")}
                      </div>
                    ) : (
                      sessions?.map((session) => (
                        <div
                          key={session.id}
                          className={`p-2 rounded border cursor-pointer text-xs transition-colors ${
                            selectedSessionId === session.id
                              ? "bg-primary/10 border-primary"
                              : "hover:bg-muted"
                          }`}
                          onClick={() => onSessionSelect(session)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-3 w-3" />
                              <span className="truncate">{session.title}</span>
                              {session.messageCount !== undefined && (
                                <span className="text-muted-foreground">
                                  ({session.messageCount})
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSession(session.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
