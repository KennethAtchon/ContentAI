import { useTranslation } from "react-i18next";
import { Loader2, MessageSquarePlus, PanelRight } from "lucide-react";
import { ProjectSidebar } from "./projects/ProjectSidebar";
import { ChatPanel } from "./ChatPanel";
import { ContentWorkspace } from "./ContentWorkspace";
import { useSubscription } from "@/domains/subscriptions/hooks/use-subscription";
import { useChatLayout } from "../hooks/use-chat-layout";
import type { Project } from "../model/chat.types";

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
  const { hasEnterpriseAccess } = useSubscription();

  const {
    selectedProject,
    selectedSession,
    isSessionResolving,
    workspaceOpen,
    setWorkspaceOpen,
    activeContentId,
    persistedActiveContentId,
    setActiveContentId,
    displayMessages,
    isStreaming,
    streamError,
    isLimitReached,
    isSavingContent,
    streamingMessageId,
    latestStreamingContentId,
    activeDraftLabel,
    activeReelRefs,
    resetLimitReached,
    workspaceToggleClass,
    showReelProgressRecall,
    handleShowReelProgressToast,
    handleSendMessage,
    handleProjectSelect,
    handleSessionSelect,
    handleSessionDeleted,
    videoJobId,
    videoJobData,
    handleVideoJobStarted,
  } = useChatLayout(projects);

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
        onSessionDeleted={handleSessionDeleted}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {isSessionResolving ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {t("studio_loading")}
            </p>
          </div>
        ) : selectedSession ? (
          <>
            <div className="border-b px-5 py-3 shrink-0 flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold truncate">
                  {selectedSession.title}
                </h2>
                {selectedProject && (
                  <p className="text-sm text-muted-foreground truncate">
                    {selectedProject.name}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {showReelProgressRecall ? (
                  <button
                    type="button"
                    onClick={handleShowReelProgressToast}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground text-sm font-medium transition-colors"
                    aria-label={t("workspace_video_generating_toast_show_aria")}
                  >
                    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                    <span className="hidden sm:inline">
                      {t("workspace_video_generating_toast_show")}
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setWorkspaceOpen((prev) => !prev)}
                  className={workspaceToggleClass}
                  aria-label={t("workspace_open")}
                >
                  <PanelRight className="w-3.5 h-3.5" />
                  {t("workspace_open")}
                </button>
              </div>
            </div>

            <ChatPanel
              messages={displayMessages}
              streamingMessageId={isStreaming ? streamingMessageId : undefined}
              onSendMessage={handleSendMessage}
              isStreaming={isStreaming}
              streamError={streamError}
              isLimitReached={isLimitReached}
              isMaxPlan={hasEnterpriseAccess}
              isSavingContent={isSavingContent}
              activeReelRefs={activeReelRefs}
              activeDraftLabel={activeDraftLabel}
              onOpenWorkspace={() => setWorkspaceOpen(true)}
              onResetLimitReached={resetLimitReached}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <MessageSquarePlus className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">
                {selectedProject
                  ? selectedProject.name
                  : t("studio_chat_selectProject")}
              </h2>
              <p className="text-base text-muted-foreground max-w-xs">
                {selectedProject
                  ? t("studio_chat_projectSelected")
                  : t("studio_chat_selectProjectDescription")}
              </p>
            </div>
          </div>
        )}
      </div>

      {workspaceOpen && selectedSession && (
        <ContentWorkspace
          sessionId={selectedSession.id}
          activeContentId={activeContentId}
          persistedActiveContentId={persistedActiveContentId}
          latestStreamingContentId={latestStreamingContentId}
          onActiveContentChange={setActiveContentId}
          onClose={() => setWorkspaceOpen(false)}
          videoJobId={videoJobId}
          videoJobData={videoJobData}
          onVideoJobStarted={handleVideoJobStarted}
        />
      )}
    </div>
  );
}
