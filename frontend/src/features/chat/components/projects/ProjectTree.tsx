import { Button } from "@/shared/components/ui/button";
import { FolderOpen, Plus } from "lucide-react";
import type { Project, ChatSession } from "../../types/chat.types";
import { ProjectListItem } from "./ProjectListItem";

interface ProjectTreeProps {
  projects?: Project[];
  projectsLoading: boolean;
  sessions?: ChatSession[];
  sessionsLoading: boolean;
  selectedProjectId?: string;
  selectedSessionId?: string;
  editingProjectId: string | null;
  editingProjectName: string;
  setEditingProjectName: (value: string) => void;
  editingSessionId: string | null;
  editingSessionTitle: string;
  setEditingSessionTitle: (value: string) => void;
  onNewProject: () => void;
  onProjectSelect: (project: Project) => void;
  onSessionSelect: (session: ChatSession) => void;
  onCreateSession: (projectId: string) => void;
  onStartEditingProject: (project: Project) => void;
  onCancelEditingProject: () => void;
  onSaveProjectName: () => void;
  onStartEditingSession: (session: ChatSession) => void;
  onCancelEditingSession: () => void;
  onSaveSessionTitle: () => void;
  onDeleteProjectRequest: (projectId: string) => void;
  onDeleteSessionRequest: (sessionId: string) => void;
  t: (key: string) => string;
}

export function ProjectTree({
  projects,
  projectsLoading,
  sessions,
  sessionsLoading,
  selectedProjectId,
  selectedSessionId,
  editingProjectId,
  editingProjectName,
  setEditingProjectName,
  editingSessionId,
  editingSessionTitle,
  setEditingSessionTitle,
  onNewProject,
  onProjectSelect,
  onSessionSelect,
  onCreateSession,
  onStartEditingProject,
  onCancelEditingProject,
  onSaveProjectName,
  onStartEditingSession,
  onCancelEditingSession,
  onSaveSessionTitle,
  onDeleteProjectRequest,
  onDeleteSessionRequest,
  t,
}: ProjectTreeProps) {
  if (projectsLoading) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground">
        {t("studio_chat_loadingProjects")}
      </div>
    );
  }

  if (!projects?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center gap-3">
        <FolderOpen className="h-8 w-8 text-muted-foreground/40" />
        <div>
          <p className="text-base font-medium text-muted-foreground">
            {t("studio_chat_noProjects")}
          </p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {t("studio_chat_noProjectsDescription")}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onNewProject} className="mt-1">
          <Plus className="h-3 w-3 mr-1.5" />
          {t("studio_chat_newProject")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1 px-2">
      {projects.map((project) => (
        <ProjectListItem
          key={project.id}
          project={project}
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          selectedProjectId={selectedProjectId}
          selectedSessionId={selectedSessionId}
          editingProjectId={editingProjectId}
          editingProjectName={editingProjectName}
          setEditingProjectName={setEditingProjectName}
          editingSessionId={editingSessionId}
          editingSessionTitle={editingSessionTitle}
          setEditingSessionTitle={setEditingSessionTitle}
          onProjectSelect={onProjectSelect}
          onSessionSelect={onSessionSelect}
          onCreateSession={onCreateSession}
          onStartEditingProject={onStartEditingProject}
          onCancelEditingProject={onCancelEditingProject}
          onSaveProjectName={onSaveProjectName}
          onStartEditingSession={onStartEditingSession}
          onCancelEditingSession={onCancelEditingSession}
          onSaveSessionTitle={onSaveSessionTitle}
          onDeleteProjectRequest={onDeleteProjectRequest}
          onDeleteSessionRequest={onDeleteSessionRequest}
          t={t}
        />
      ))}
    </div>
  );
}
