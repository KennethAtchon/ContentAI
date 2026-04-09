import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { CreateProjectModal } from "../CreateProjectModal";
import { ProjectTree } from "./ProjectTree";
import { ProjectSidebarUsage } from "./ProjectSidebarUsage";
import { ProjectSidebarDeleteDialogs } from "./ProjectSidebarDeleteDialogs";
import { useProjectSidebar } from "../../hooks/useProjectSidebar";
import type { Project, ChatSession } from "../../types/chat.types";

interface ProjectSidebarProps {
  selectedProjectId?: string;
  selectedSessionId?: string;
  onProjectSelect: (project: Project) => void;
  onSessionSelect: (session: ChatSession) => void;
  onNewProject: () => void;
  showNewProjectForm: boolean;
  onHideNewProjectForm: () => void;
  onSessionDeleted?: () => void;
}

export function ProjectSidebar({
  selectedProjectId,
  selectedSessionId,
  onProjectSelect,
  onSessionSelect,
  onNewProject,
  showNewProjectForm,
  onHideNewProjectForm,
  onSessionDeleted,
}: ProjectSidebarProps) {
  const sidebar = useProjectSidebar({
    selectedProjectId,
    selectedSessionId,
    onHideNewProjectForm,
    onSessionSelect,
    onSessionDeleted,
  });

  return (
    <div className="w-72 h-full border-r bg-background flex flex-col shrink-0">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-base font-semibold">{sidebar.t("studio_chat_projects")}</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={onNewProject}
          className="h-7 w-7 p-0"
          aria-label={sidebar.t("studio_chat_newProject")}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <CreateProjectModal
        open={showNewProjectForm}
        onOpenChange={onHideNewProjectForm}
        projectName={sidebar.newProjectName}
        projectDescription={sidebar.newProjectDescription}
        onProjectNameChange={sidebar.setNewProjectName}
        onProjectDescriptionChange={sidebar.setNewProjectDescription}
        onCreateProject={sidebar.handleCreateProject}
        isCreating={sidebar.isCreatingProject}
      />

      <div className="flex-1 overflow-y-auto py-2">
        <ProjectTree
          projects={sidebar.projects}
          projectsLoading={sidebar.projectsLoading}
          sessions={sidebar.sessions}
          sessionsLoading={sidebar.sessionsLoading}
          selectedProjectId={selectedProjectId}
          selectedSessionId={selectedSessionId}
          editingProjectId={sidebar.editingProjectId}
          editingProjectName={sidebar.editingProjectName}
          setEditingProjectName={sidebar.setEditingProjectName}
          editingSessionId={sidebar.editingSessionId}
          editingSessionTitle={sidebar.editingSessionTitle}
          setEditingSessionTitle={sidebar.setEditingSessionTitle}
          onNewProject={onNewProject}
          onProjectSelect={onProjectSelect}
          onSessionSelect={onSessionSelect}
          onCreateSession={sidebar.handleCreateSession}
          onStartEditingProject={sidebar.handleStartEditingProject}
          onCancelEditingProject={sidebar.handleCancelEditingProject}
          onSaveProjectName={sidebar.handleSaveProjectName}
          onStartEditingSession={sidebar.handleStartEditingSession}
          onCancelEditingSession={sidebar.handleCancelEditingSession}
          onSaveSessionTitle={sidebar.handleSaveSessionTitle}
          onDeleteProjectRequest={sidebar.setDeleteProjectId}
          onDeleteSessionRequest={sidebar.setDeleteSessionId}
          usageLimitReached={sidebar.usageLimitReached}
          createSessionDisabledReason={
            sidebar.usageLimitReached ? sidebar.t("studio_chat_limit_reached") : undefined
          }
          t={sidebar.t}
        />
      </div>

      {sidebar.usageData && (
        <ProjectSidebarUsage
          usageData={sidebar.usageData}
          usageLimitReached={sidebar.usageLimitReached}
          hasEnterpriseAccess={sidebar.hasEnterpriseAccess}
          t={sidebar.t}
        />
      )}

      <ProjectSidebarDeleteDialogs
        deleteProjectId={sidebar.deleteProjectId}
        setDeleteProjectId={sidebar.setDeleteProjectId}
        deleteSessionId={sidebar.deleteSessionId}
        setDeleteSessionId={sidebar.setDeleteSessionId}
        onConfirmDeleteProject={sidebar.handleConfirmDeleteProject}
        onConfirmDeleteSession={sidebar.handleConfirmDeleteSession}
        isDeletingProject={sidebar.isDeletingProject}
        isDeletingSession={sidebar.isDeletingSession}
        deleteSessionPreview={sidebar.deleteSessionPreview}
        deleteSessionPreviewLoading={sidebar.deleteSessionPreviewLoading}
        t={sidebar.t}
      />
    </div>
  );
}
