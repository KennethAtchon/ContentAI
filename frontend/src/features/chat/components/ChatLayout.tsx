import React, { useState, useEffect } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { debugLog } from "@/shared/utils/debug/debug";
import { ProjectSidebar } from "./ProjectSidebar";
import { ChatPanel } from "./ChatPanel";
import { useChatSession } from "../hooks/use-chat-sessions";
import { useSendMessage } from "../hooks/use-send-message";
import type { Project, ChatSession } from "../types/chat.types";

interface ChatLayoutProps {
  projects: Project[];
  onNewProject: () => void;
  showNewProjectForm: boolean;
  onHideNewProjectForm: () => void;
}

export function ChatLayout({
  projects,
  onNewProject,
  showNewProjectForm,
  onHideNewProjectForm,
}: ChatLayoutProps) {
  const { t } = useTranslation();
  const search = useSearch({ strict: false }) as {
    projectId?: string;
    sessionId?: string;
  };
  const navigate = useNavigate();

  const [selectedProject, setSelectedProject] = useState<Project | undefined>();
  const [selectedSession, setSelectedSession] = useState<
    ChatSession | undefined
  >();

  const { data: sessionData, isLoading: sessionLoading } = useChatSession(
    search.sessionId || ""
  );
  const sendMessageMutation = useSendMessage(search.sessionId || "");

  // Update selected project from URL params
  useEffect(() => {
    if (search.projectId && projects) {
      const project = projects.find((p) => p.id === search.projectId);
      setSelectedProject(project);
    }
  }, [search.projectId, projects]);

  // Update selected session from URL params
  useEffect(() => {
    if (sessionData && !sessionLoading) {
      setSelectedSession(sessionData.session);
    }
  }, [sessionData, sessionLoading]);

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setSelectedSession(undefined);
    navigate({
      to: "/studio/generate",
      search: { projectId: project.id },
    });
  };

  const handleSessionSelect = (session: ChatSession) => {
    setSelectedSession(session);
    navigate({
      to: "/studio/generate",
      search: { projectId: session.projectId, sessionId: session.id },
    });
  };

  const handleSendMessage = async (content: string) => {
    if (!search.sessionId) return;

    try {
      await sendMessageMutation.mutateAsync({ content });
    } catch (error) {
      debugLog.error("Failed to send message", {
        service: "chat-layout",
        operation: "handleSendMessage",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const messages = sessionData?.messages || [];

  return (
    <div className="flex h-full">
      <ProjectSidebar
        selectedProjectId={selectedProject?.id}
        selectedSessionId={selectedSession?.id}
        onProjectSelect={handleProjectSelect}
        onSessionSelect={handleSessionSelect}
        onNewProject={onNewProject}
        showNewProjectForm={showNewProjectForm}
        onHideNewProjectForm={onHideNewProjectForm}
      />

      <div className="flex-1 flex flex-col">
        {selectedSession ? (
          <>
            <div className="border-b p-4">
              <h2 className="text-lg font-semibold">{selectedSession.title}</h2>
              {selectedProject && (
                <p className="text-sm text-muted-foreground">
                  {selectedProject.name}
                </p>
              )}
            </div>

            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={sendMessageMutation.isPending}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">
                {selectedProject
                  ? selectedProject.name
                  : t("studio_chat_selectProject")}
              </h2>
              <p className="text-muted-foreground">
                {selectedProject
                  ? t("studio_chat_projectSelected")
                  : t("studio_chat_selectProjectDescription")}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
