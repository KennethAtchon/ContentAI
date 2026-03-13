import React, { useState, useEffect, useMemo } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MessageSquarePlus } from "lucide-react";
import { debugLog } from "@/shared/utils/debug/debug";
import { ProjectSidebar } from "./ProjectSidebar";
import { ChatPanel } from "./ChatPanel";
import { useChatSession } from "../hooks/use-chat-sessions";
import { useChatStream, STREAMING_MESSAGE_ID } from "../hooks/use-chat-stream";
import type { Project, ChatSession, ChatMessage } from "../types/chat.types";

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

  const sessionId = search.sessionId || "";
  const { data: sessionData, isLoading: sessionLoading } =
    useChatSession(sessionId);
  const {
    sendMessage,
    optimisticUserMessage,
    streamingContent,
    isStreaming,
    streamError,
    isLimitReached,
  } = useChatStream(sessionId);

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
    if (!sessionId) return;
    try {
      await sendMessage(content);
    } catch (error) {
      debugLog.error("Failed to send message", {
        service: "chat-layout",
        operation: "handleSendMessage",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Combine server messages with optimistic/streaming overlay
  const displayMessages = useMemo((): ChatMessage[] => {
    const server = sessionData?.messages ?? [];
    const extra: ChatMessage[] = [];

    if (optimisticUserMessage) {
      extra.push(optimisticUserMessage);
    }
    if (streamingContent !== null) {
      extra.push({
        id: STREAMING_MESSAGE_ID,
        sessionId,
        role: "assistant",
        content: streamingContent,
        createdAt: new Date().toISOString(),
      });
    }

    return [...server, ...extra];
  }, [
    sessionData?.messages,
    optimisticUserMessage,
    streamingContent,
    sessionId,
  ]);

  return (
    <div className="flex h-full overflow-hidden">
      <ProjectSidebar
        selectedProjectId={selectedProject?.id}
        selectedSessionId={selectedSession?.id}
        onProjectSelect={handleProjectSelect}
        onSessionSelect={handleSessionSelect}
        onNewProject={onNewProject}
        showNewProjectForm={showNewProjectForm}
        onHideNewProjectForm={onHideNewProjectForm}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedSession ? (
          <>
            <div className="border-b px-5 py-3 shrink-0">
              <h2 className="text-sm font-semibold truncate">
                {selectedSession.title}
              </h2>
              {selectedProject && (
                <p className="text-xs text-muted-foreground truncate">
                  {selectedProject.name}
                </p>
              )}
            </div>

            <ChatPanel
              messages={displayMessages}
              streamingMessageId={
                isStreaming ? STREAMING_MESSAGE_ID : undefined
              }
              onSendMessage={handleSendMessage}
              isStreaming={isStreaming}
              streamError={streamError}
              isLimitReached={isLimitReached}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <MessageSquarePlus className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <div>
              <h2 className="text-base font-semibold mb-1">
                {selectedProject
                  ? selectedProject.name
                  : t("studio_chat_selectProject")}
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs">
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
