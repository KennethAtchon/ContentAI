import { Button } from "@/shared/components/ui/button";
import { Check, Edit3, FolderOpen, MessageSquare, Plus, Trash2, X } from "lucide-react";
import type { Project, ChatSession } from "../../types/chat.types";

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
                    onChange={(e) => setEditingProjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSaveProjectName();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        onCancelEditingProject();
                      }
                    }}
                    className="flex-1 text-base bg-transparent border-b border-primary outline-none"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0 hover:text-primary shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSaveProjectName();
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
                      onCancelEditingProject();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-base font-medium truncate">{project.name}</p>
                  {project.description && (
                    <p className="text-sm text-muted-foreground truncate mt-0.5">
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
                    onCreateSession(project.id);
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
                    onStartEditingProject(project);
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
                    onDeleteProjectRequest(project.id);
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
                <div className="text-sm text-muted-foreground px-2 py-1">
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
                          onChange={(e) => setEditingSessionTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onSaveSessionTitle();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              onCancelEditingSession();
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
                            onSaveSessionTitle();
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
                            onCancelEditingSession();
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-sm truncate">{session.title}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0"
                            aria-label={t("studio_chat_renameSession")}
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartEditingSession(session);
                            }}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-4 w-4 p-0 hover:text-destructive"
                            aria-label={t("studio_chat_deleteSession")}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSessionRequest(session.id);
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
  );
}

