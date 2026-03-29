import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2, MessageSquarePlus, PanelRight } from "lucide-react";
import { debugLog } from "@/shared/utils/debug/debug";
import { useQueryClient } from "@tanstack/react-query";
import { REDIRECT_PATHS } from "@/shared/utils/redirect/redirect-util";
import {
  invalidateChatProjectsQueries,
  invalidateEditorProjectsQueries,
  invalidateQueueQueries,
} from "@/shared/lib/query-invalidation";
import { useApp } from "@/shared/contexts/app-context";
import { reelsService } from "@/features/reels/services/reels.service";
import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import { ProjectSidebar } from "./projects/ProjectSidebar";
import { ChatPanel } from "./ChatPanel";
import { ContentWorkspace } from "./ContentWorkspace";
import { useChatSession } from "../hooks/use-chat-sessions";
import { useChatStream } from "../hooks/use-chat-stream";
import { useSessionDrafts } from "../hooks/use-session-drafts";
import { useVideoJobManager } from "../hooks/use-video-job-manager";
import { useSubscription } from "@/features/subscriptions/hooks/use-subscription";
import type { Project, ChatSession, ChatMessage } from "../types/chat.types";
import type { Reel } from "@/features/reels/types/reel.types";

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
    reelId?: string;
  };
  const navigate = useNavigate();
  const { user } = useApp();
  const queryClient = useQueryClient();

  const { hasEnterpriseAccess } = useSubscription();
  const sessionId = search.sessionId || "";
  const { data: sessionData, isLoading: sessionLoading } = useChatSession(sessionId);
  const { data: sessionDraftsData } = useSessionDrafts(sessionId.length > 0 ? sessionId : null);
  const {
    sendMessage,
    optimisticUserMessage,
    streamingContent,
    streamingMessageId,
    isStreaming,
    streamError,
    isLimitReached,
    isSavingContent,
    streamingContentId,
    resetLimitReached,
  } = useChatStream(sessionId);

  const [activeReelRefs, setActiveReelRefs] = useState<Reel[]>([]);
  const [pendingReelIds, setPendingReelIds] = useState<number[]>([]);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [activeContentId, setActiveContentId] = useState<number | null>(null);
  const [requestAudioForContentId, setRequestAudioForContentId] = useState<number | null>(null);

  const {
    videoJobId,
    videoJobData,
    showReelProgressRecall,
    handleVideoJobStarted,
    handleShowReelProgressToast,
  } = useVideoJobManager({
    sessionId,
    userId: user?.uid,
    drafts: sessionDraftsData?.drafts,
  });

  // Derive selection from URL + loaded data
  const selectedProject = useMemo((): Project | undefined => {
    if (!projects?.length) return undefined;
    if (search.projectId) {
      const fromUrl = projects.find((p) => p.id === search.projectId);
      if (fromUrl) return fromUrl;
    }
    const sessionPid = sessionData?.session?.projectId;
    if (sessionPid) return projects.find((p) => p.id === sessionPid);
    return undefined;
  }, [projects, search.projectId, sessionData?.session?.projectId]);

  const selectedSession = sessionData?.session;
  const isSessionResolving = Boolean(sessionId) && sessionLoading && !sessionData;

  // Reset per-session state when session changes
  const prevSessionIdForResetRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionIdForResetRef.current === sessionId) return;
    prevSessionIdForResetRef.current = sessionId;
    setActiveReelRefs([]);
    setActiveContentId(null);
    setWorkspaceOpen(false);
    setRequestAudioForContentId(null);
  }, [sessionId]);

  const lastReelRefs = useMemo(() => {
    if (isStreaming && pendingReelIds.length > 0) return pendingReelIds;
    if (!sessionData) return [];
    const userMessages = sessionData.messages.filter((m) => m.role === "user");
    const lastMessage = userMessages[userMessages.length - 1];
    return lastMessage?.reelRefs || [];
  }, [sessionData, isStreaming, pendingReelIds]);

  // Load reels from messages or URL parameter as fallback
  useEffect(() => {
    let cancelled = false;

    const loadReels = async () => {
      try {
        if (lastReelRefs.length > 0) {
          const data = await reelsService.getBulkReels(lastReelRefs);
          if (!cancelled) setActiveReelRefs(data.reels);
        } else if (search.reelId && sessionData) {
          const data = await reelsService.getReel(Number(search.reelId));
          if (!cancelled && data.reel) setActiveReelRefs([data.reel as unknown as Reel]);
        } else {
          if (!cancelled) setActiveReelRefs([]);
        }
      } catch (error) {
        debugLog.error("Failed to load reels", {
          service: "chat-layout",
          operation: "loadReels",
          error: error instanceof Error ? error.message : String(error),
        });
        if (!cancelled) setActiveReelRefs([]);
      }
    };

    void loadReels();
    return () => { cancelled = true; };
  }, [lastReelRefs, search.reelId]);

  // Invalidate queue when new content is generated
  useEffect(() => {
    if (!streamingContentId) return;
    void invalidateQueueQueries(queryClient);
  }, [streamingContentId, queryClient]);

  // Auto-create editor project after generation
  useEffect(() => {
    if (!streamingContentId) return;
    void authenticatedFetchJson("/api/editor", {
      method: "POST",
      body: JSON.stringify({ generatedContentId: streamingContentId }),
    })
      .then(() => {
        void invalidateEditorProjectsQueries(queryClient);
        void invalidateChatProjectsQueries(queryClient);
      })
      .catch((err) => {
        const status = (err as { status?: number }).status;
        const body = (err as { body?: { error?: string } }).body;
        if (status === 409 && body?.error === "project_exists") {
          void invalidateEditorProjectsQueries(queryClient);
          void invalidateChatProjectsQueries(queryClient);
          return;
        }
        debugLog.error("Failed to auto-create editor project", {
          service: "chat-layout",
          operation: "auto-create-editor",
          contentId: streamingContentId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, [streamingContentId, queryClient]);

  const handleProjectSelect = (project: Project) => {
    navigate({
      to: REDIRECT_PATHS.STUDIO_GENERATE,
      search: { projectId: project.id, sessionId: undefined, reelId: undefined },
    });
  };

  const handleSessionSelect = (session: ChatSession) => {
    navigate({
      to: REDIRECT_PATHS.STUDIO_GENERATE,
      search: { projectId: session.projectId, sessionId: session.id, reelId: undefined },
    });
  };

  const handleSendMessage = async (
    content: string,
    reelRefs?: number[],
    mediaRefs?: string[]
  ) => {
    if (!sessionId) return;
    setPendingReelIds(reelRefs ?? []);
    try {
      await sendMessage(content, reelRefs, activeContentId ?? undefined, mediaRefs);
    } catch (error) {
      debugLog.error("Failed to send message", {
        service: "chat-layout",
        operation: "handleSendMessage",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setPendingReelIds([]);
    }
  };

  const handleSessionDeleted = () => {
    navigate({
      to: REDIRECT_PATHS.STUDIO_GENERATE,
      search: selectedProject
        ? { projectId: selectedProject.id, sessionId: undefined, reelId: undefined }
        : { sessionId: undefined, projectId: undefined, reelId: undefined },
    });
  };

  const handleOpenAudio = useCallback((contentId: number) => {
    setActiveContentId(contentId);
    setRequestAudioForContentId(contentId);
    setWorkspaceOpen(true);
  }, []);

  const workspaceToggleClass = useMemo(() => {
    const base =
      "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm font-medium transition-all duration-150";
    if (workspaceOpen) {
      return `${base} border-primary/30 bg-primary/[0.06] text-primary hover:bg-primary/[0.10] hover:border-primary/40`;
    }
    return `${base} border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-border`;
  }, [workspaceOpen]);

  // Combine server messages with optimistic/streaming overlay
  const displayMessages = useMemo((): ChatMessage[] => {
    const server = sessionData?.messages ?? [];
    const serverIds = new Set(server.map((m) => m.id));
    const extra: ChatMessage[] = [];

    if (optimisticUserMessage && !serverIds.has(optimisticUserMessage.id)) {
      extra.push(optimisticUserMessage);
    }
    if (streamingContent) {
      extra.push({
        id: streamingMessageId,
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
    streamingMessageId,
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
        onSessionDeleted={handleSessionDeleted}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {isSessionResolving ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t("studio_loading")}</p>
          </div>
        ) : selectedSession ? (
          <>
            <div className="border-b px-5 py-3 shrink-0 flex items-center justify-between gap-3 min-w-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold truncate">{selectedSession.title}</h2>
                {selectedProject && (
                  <p className="text-sm text-muted-foreground truncate">{selectedProject.name}</p>
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
              streamingContentId={streamingContentId}
              activeReelRefs={activeReelRefs}
              onResetLimitReached={resetLimitReached}
              onOpenAudio={handleOpenAudio}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <MessageSquarePlus className="w-6 h-6 text-muted-foreground/60" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-1">
                {selectedProject ? selectedProject.name : t("studio_chat_selectProject")}
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
          streamingContentId={streamingContentId}
          requestAudioForContentId={requestAudioForContentId}
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
