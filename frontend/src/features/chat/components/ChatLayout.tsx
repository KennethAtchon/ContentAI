import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2, MessageSquarePlus, PanelRight } from "lucide-react";
import { toast } from "sonner";
import { debugLog } from "@/shared/utils/debug/debug";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
import { useQueryClient } from "@tanstack/react-query";
import {
  invalidateContentAssetsForGeneration,
  invalidateEditorProjectsQueries,
  invalidateQueueQueries,
} from "@/shared/lib/query-invalidation";
import { useVideoJob } from "@/features/video/hooks/use-video-job";
import type { VideoJobResponse } from "@/features/video/types/video.types";
import {
  clearPersistedStudioVideoJob,
  findActiveReelJobCandidateFromDrafts,
  persistStudioVideoJob,
  readPersistedStudioVideoJob,
} from "@/features/video/lib/studio-video-job-storage";
import { useSessionDrafts } from "../hooks/use-session-drafts";
import { useApp } from "@/shared/contexts/app-context";
import { ProjectSidebar } from "./ProjectSidebar";
import { ChatPanel } from "./ChatPanel";
import { ContentWorkspace } from "./ContentWorkspace";
import { useChatSession } from "../hooks/use-chat-sessions";
import { useChatStream } from "../hooks/use-chat-stream";
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
  const { authenticatedFetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const [selectedProject, setSelectedProject] = useState<Project | undefined>();
  const [selectedSession, setSelectedSession] = useState<
    ChatSession | undefined
  >();

  const { hasEnterpriseAccess } = useSubscription();
  const sessionId = search.sessionId || "";
  const { data: sessionData, isLoading: sessionLoading } =
    useChatSession(sessionId);
  const { data: sessionDraftsData } = useSessionDrafts(
    sessionId.length > 0 ? sessionId : null
  );
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
  const [requestAudioForContentId, setRequestAudioForContentId] = useState<
    number | null
  >(null);

  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [videoJobContentId, setVideoJobContentId] = useState<number | null>(
    null
  );
  const { data: videoJobData } = useVideoJob(videoJobId);
  const prevVideoStatusRef = useRef<string | null>(null);
  const videoJobToastIdRef = useRef<string | number | null>(null);
  const [reelProgressToastHiddenByUser, setReelProgressToastHiddenByUser] =
    useState(false);
  const prevSessionIdForVideoRef = useRef<string>("");

  const reelGeneratingDescription = useMemo(() => {
    const progress = videoJobData?.job.progress;
    const { shotsCompleted, totalShots } = progress ?? {};
    if (
      shotsCompleted !== undefined &&
      totalShots !== undefined &&
      totalShots > 0
    ) {
      return t("workspace_video_generating_toast_shot_progress", {
        completed: shotsCompleted,
        total: totalShots,
      });
    }
    return t("workspace_video_generating_toast_description");
  }, [
    videoJobData?.job.progress?.shotsCompleted,
    videoJobData?.job.progress?.totalShots,
    t,
  ]);

  const reelGeneratingToastOpts = useCallback(
    (description: string) => ({
      description,
      duration: Infinity,
      closeButton: true,
      onDismiss: () => {
        videoJobToastIdRef.current = null;
        setReelProgressToastHiddenByUser(true);
      },
      cancel: {
        label: t("workspace_video_generating_toast_hide"),
        onClick: () => {
          const id = videoJobToastIdRef.current;
          if (id != null) toast.dismiss(id);
          videoJobToastIdRef.current = null;
          setReelProgressToastHiddenByUser(true);
        },
      },
    }),
    [t]
  );

  const handleVideoJobStarted = useCallback(
    (jobId: string, contentId: number) => {
      setReelProgressToastHiddenByUser(false);
      setVideoJobId(jobId);
      setVideoJobContentId(contentId);
      if (sessionId) {
        persistStudioVideoJob(sessionId, { jobId, contentId });
      }
      videoJobToastIdRef.current = toast.loading(
        t("workspace_video_generating"),
        reelGeneratingToastOpts(
          t("workspace_video_generating_toast_description")
        )
      );
    },
    [t, reelGeneratingToastOpts, sessionId]
  );

  const handleShowReelProgressToast = useCallback(() => {
    if (videoJobToastIdRef.current != null) return;
    const status = videoJobData?.job.status;
    if (status !== "queued" && status !== "running") return;
    setReelProgressToastHiddenByUser(false);
    videoJobToastIdRef.current = toast.loading(
      t("workspace_video_generating"),
      reelGeneratingToastOpts(reelGeneratingDescription)
    );
  }, [
    videoJobData?.job.status,
    reelGeneratingDescription,
    t,
    reelGeneratingToastOpts,
  ]);

  // Clear in-flight video job when switching chat sessions (URL session id).
  useEffect(() => {
    if (prevSessionIdForVideoRef.current === sessionId) return;
    const hadPreviousSession = prevSessionIdForVideoRef.current !== "";
    prevSessionIdForVideoRef.current = sessionId;
    if (!hadPreviousSession) return;

    setVideoJobId(null);
    setVideoJobContentId(null);
    prevVideoStatusRef.current = null;
    setReelProgressToastHiddenByUser(false);
    if (videoJobToastIdRef.current != null) {
      toast.dismiss(videoJobToastIdRef.current);
      videoJobToastIdRef.current = null;
    }
  }, [sessionId]);

  // Restore in-flight video job from sessionStorage after refresh / new tab.
  useEffect(() => {
    if (!sessionId || !user) return;
    let cancelled = false;

    void (async () => {
      const persisted = readPersistedStudioVideoJob(sessionId);
      if (!persisted) return;
      try {
        const data = await authenticatedFetchJson<VideoJobResponse>(
          `/api/video/jobs/${persisted.jobId}`
        );
        if (cancelled) return;
        const s = data.job.status;
        if (s === "queued" || s === "running") {
          setVideoJobId((prev) => prev ?? persisted.jobId);
          setVideoJobContentId((prev) => prev ?? persisted.contentId);
          setReelProgressToastHiddenByUser(false);
        } else {
          clearPersistedStudioVideoJob(sessionId);
        }
      } catch {
        if (!cancelled) clearPersistedStudioVideoJob(sessionId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, user, authenticatedFetchJson]);

  // Fallback when storage was cleared: draft metadata still has phase4 assembly queued/running.
  useEffect(() => {
    if (!sessionId || !user) return;
    if (readPersistedStudioVideoJob(sessionId)) return;
    const drafts = sessionDraftsData?.drafts;
    if (!drafts?.length) return;

    let cancelled = false;
    const candidate = findActiveReelJobCandidateFromDrafts(drafts);
    if (!candidate) return;

    void (async () => {
      try {
        const data = await authenticatedFetchJson<VideoJobResponse>(
          `/api/video/jobs/${candidate.jobId}`
        );
        if (cancelled) return;
        const s = data.job.status;
        if (s === "queued" || s === "running") {
          setVideoJobId((prev) => prev ?? candidate.jobId);
          setVideoJobContentId((prev) => prev ?? candidate.contentId);
          setReelProgressToastHiddenByUser(false);
          persistStudioVideoJob(sessionId, {
            jobId: candidate.jobId,
            contentId: candidate.contentId,
          });
        }
      } catch {
        // stale job id in metadata — ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, user, authenticatedFetchJson, sessionDraftsData?.drafts]);

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
      // Reset state when switching sessions
      setActiveReelRefs([]);
      setActiveContentId(null);
      setWorkspaceOpen(false);
      setRequestAudioForContentId(null);
    }
  }, [sessionData, sessionLoading]);

  const lastReelRefs = useMemo(() => {
    // During streaming, use the refs from the just-sent message so the reel
    // attachment UI stays correct before sessionData has refreshed.
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
        // If we have message-based reel refs, load those
        if (lastReelRefs.length > 0) {
          const data = await authenticatedFetchJson<{ reels: Reel[] }>(
            "/api/reels/bulk",
            {
              method: "POST",
              body: JSON.stringify({ ids: lastReelRefs }),
            }
          );
          if (!cancelled) setActiveReelRefs(data.reels);
        }
        // Otherwise, use URL reelId as fallback for initial session setup
        else if (search.reelId && sessionData) {
          const data = await authenticatedFetchJson<{ reel: Reel }>(
            `/api/reels/${search.reelId}`
          );
          if (!cancelled && data.reel) {
            setActiveReelRefs([data.reel]);
          }
        }
        // If neither exists, clear the reels
        else {
          if (!cancelled) setActiveReelRefs([]);
        }
      } catch (error) {
        debugLog.error("Failed to load reels", {
          service: "chat-layout",
          operation: "loadReels",
          error: error instanceof Error ? error.message : String(error),
          lastReelRefs,
          reelId: search.reelId,
        });
        if (!cancelled) setActiveReelRefs([]);
      }
    };

    void loadReels();
    return () => {
      cancelled = true;
    };
  }, [lastReelRefs, search.reelId]);

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

  const handleSendMessage = async (
    content: string,
    reelRefs?: number[],
    mediaRefs?: string[]
  ) => {
    if (!sessionId) return;
    setPendingReelIds(reelRefs ?? []);
    try {
      await sendMessage(
        content,
        reelRefs,
        activeContentId ?? undefined,
        mediaRefs
      );
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
    // Clear the selected session and navigate to the project view
    setSelectedSession(undefined);
    navigate({
      to: "/studio/generate",
      search: selectedProject ? { projectId: selectedProject.id } : {},
    });
  };

  const handleOpenAudio = useCallback((contentId: number) => {
    setActiveContentId(contentId);
    setRequestAudioForContentId(contentId);
    setWorkspaceOpen(true);
  }, []);

  // Invalidate the queue whenever new content is generated so the queue page
  // reflects the new item without requiring a manual refresh.
  useEffect(() => {
    if (!streamingContentId) return;
    void invalidateQueueQueries(queryClient);
  }, [streamingContentId, queryClient]);

  // Auto-create an editor project in the background so the project is ready
  // when the user navigates to the editor after generation.
  useEffect(() => {
    if (!streamingContentId) return;
    void authenticatedFetchJson("/api/editor", {
      method: "POST",
      body: JSON.stringify({ generatedContentId: streamingContentId }),
    })
      .then(() => {
        void invalidateEditorProjectsQueries(queryClient);
      })
      .catch((err) => {
        debugLog.error("Failed to auto-create editor project", {
          service: "chat-layout",
          operation: "auto-create-editor",
          contentId: streamingContentId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, [streamingContentId, authenticatedFetchJson, queryClient]);

  // Restore loading toast if a job was already running (e.g. panel was closed then reopened).
  useEffect(() => {
    const status = videoJobData?.job.status;
    if (
      (status === "queued" || status === "running") &&
      videoJobToastIdRef.current === null &&
      videoJobId !== null &&
      !reelProgressToastHiddenByUser
    ) {
      videoJobToastIdRef.current = toast.loading(
        t("workspace_video_generating"),
        reelGeneratingToastOpts(reelGeneratingDescription)
      );
    }
  }, [
    videoJobData?.job.status,
    videoJobId,
    t,
    reelGeneratingToastOpts,
    reelProgressToastHiddenByUser,
    reelGeneratingDescription,
  ]);

  // Keep toast copy in sync with shot progress while the job runs.
  useEffect(() => {
    if (videoJobToastIdRef.current == null) return;
    const status = videoJobData?.job.status;
    if (status !== "queued" && status !== "running") return;

    toast.loading(t("workspace_video_generating"), {
      id: videoJobToastIdRef.current,
      ...reelGeneratingToastOpts(reelGeneratingDescription),
    });
  }, [
    videoJobData?.job.status,
    reelGeneratingDescription,
    t,
    reelGeneratingToastOpts,
  ]);

  useEffect(() => {
    const status = videoJobData?.job.status ?? null;
    const prev = prevVideoStatusRef.current;
    prevVideoStatusRef.current = status;

    if (status === "completed") {
      setVideoJobId(null);
      setVideoJobContentId(null);
      if (sessionId) clearPersistedStudioVideoJob(sessionId);
      void invalidateContentAssetsForGeneration(
        queryClient,
        videoJobContentId ?? 0
      );
      if (prev !== "completed") {
        const tid = videoJobToastIdRef.current;
        toast.success(t("workspace_video_ready"), {
          ...(tid != null ? { id: tid } : {}),
          description: t("workspace_video_ready_toast_description"),
          duration: 6000,
          closeButton: true,
        });
        videoJobToastIdRef.current = null;
        setReelProgressToastHiddenByUser(false);
      }
    } else if (status === "failed") {
      setVideoJobId(null);
      setVideoJobContentId(null);
      if (sessionId) clearPersistedStudioVideoJob(sessionId);
      if (prev !== "failed") {
        const tid = videoJobToastIdRef.current;
        toast.error(t("workspace_video_failed"), {
          ...(tid != null ? { id: tid } : {}),
          description: videoJobData?.job.error ?? undefined,
          duration: 8000,
          closeButton: true,
        });
        videoJobToastIdRef.current = null;
        setReelProgressToastHiddenByUser(false);
      }
    }
  }, [
    videoJobData?.job.status,
    videoJobData?.job.error,
    t,
    queryClient,
    videoJobContentId,
    sessionId,
  ]);

  const workspaceToggleClass = useMemo(() => {
    const base =
      "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-sm font-medium transition-all duration-150";
    if (workspaceOpen) {
      return `${base} border-primary/30 bg-primary/[0.06] text-primary hover:bg-primary/[0.10] hover:border-primary/40`;
    }
    return `${base} border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:border-border`;
  }, [workspaceOpen]);

  const reelJobRunning =
    videoJobId !== null &&
    (videoJobData?.job.status === "queued" ||
      videoJobData?.job.status === "running");
  const showReelProgressRecall =
    reelJobRunning && reelProgressToastHiddenByUser;

  // Combine server messages with optimistic/streaming overlay
  const displayMessages = useMemo((): ChatMessage[] => {
    const server = sessionData?.messages ?? [];
    const serverIds = new Set(server.map((m) => m.id));
    const extra: ChatMessage[] = [];

    // Skip optimistic message if already injected into the cache (avoids
    // the duplicate-key flash when setQueryData fires synchronously before
    // setOptimisticUserMessage(null) is committed).
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
        {selectedSession ? (
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
