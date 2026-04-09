import { Button } from "@/shared/components/ui/button";
import { Check, Edit3, Plus, Trash2, X } from "lucide-react";
import type { Project, ChatSession } from "../../types/chat.types";
import { SessionListItem } from "./SessionListItem";

interface ProjectListItemProps {
  project: Project;
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
  usageLimitReached?: boolean;
  createSessionDisabledReason?: string;
  t: (key: string) => string;
}

export function ProjectListItem({
  project,
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
  usageLimitReached,
  createSessionDisabledReason,
  t,
}: ProjectListItemProps) {
  return (
    <div>
      <div
        className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
          selectedProjectId === project.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
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
                <p className="text-sm text-muted-foreground truncate mt-0.5">{project.description}</p>
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
              disabled={usageLimitReached}
              title={
                usageLimitReached
                  ? createSessionDisabledReason
                  : t("studio_chat_addSession")
              }
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
              <SessionListItem
                key={session.id}
                session={session}
                selectedSessionId={selectedSessionId}
                editingSessionId={editingSessionId}
                editingSessionTitle={editingSessionTitle}
                setEditingSessionTitle={setEditingSessionTitle}
                onSessionSelect={onSessionSelect}
                onStartEditingSession={onStartEditingSession}
                onCancelEditingSession={onCancelEditingSession}
                onSaveSessionTitle={onSaveSessionTitle}
                onDeleteSessionRequest={onDeleteSessionRequest}
                t={t}
              />
            ))
          ) : null}
        </div>
      )}
    </div>
  );
}
