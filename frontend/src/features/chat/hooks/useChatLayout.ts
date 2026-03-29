import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { debugLog } from "@/shared/utils/debug/debug";
import { REDIRECT_PATHS } from "@/shared/utils/redirect/redirect-util";
import {
  invalidateChatProjectsQueries,
  invalidateEditorProjectsQueries,
  invalidateQueueQueries,
} from "@/shared/lib/query-invalidation";
import { useApp } from "@/shared/contexts/app-context";
import { reelsService } from "@/features/reels/services/reels.service";
import { authenticatedFetchJson } from "@/shared/services/api/authenticated-fetch";
import { useChatSession } from "./use-chat-sessions";
import { useChatStream } from "./use-chat-stream";
import { useSessionDrafts } from "./use-session-drafts";
import { useVideoJobManager } from "./use-video-job-manager";
import type { Project, ChatSession, ChatMessage } from "../types/chat.types";
import type { Reel } from "@/features/reels/types/reel.types";

interface ChatSearch {
  projectId?: string;
  sessionId?: string;
  reelId?: string;
}

export function useChatLayout(projects: Project[]) {
  const search = useSearch({ strict: false }) as ChatSearch;
  const navigate = useNavigate();
  const { user } = useApp();
  const queryClient = useQueryClient();

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

  const selectedProject = useMemo((): Project | undefined => {
    if (!projects?.length) return undefined;
    if (search.projectId) {
      const fromUrl = projects.find((project) => project.id === search.projectId);
      if (fromUrl) return fromUrl;
    }
    const sessionPid = sessionData?.session?.projectId;
    if (sessionPid) return projects.find((project) => project.id === sessionPid);
    return undefined;
  }, [projects, search.projectId, sessionData?.session?.projectId]);

  const selectedSession = sessionData?.session;
  const isSessionResolving = Boolean(sessionId) && sessionLoading && !sessionData;

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
    const userMessages = sessionData.messages.filter((message) => message.role === "user");
    const lastMessage = userMessages[userMessages.length - 1];
    return lastMessage?.reelRefs || [];
  }, [sessionData, isStreaming, pendingReelIds]);

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
        } else if (!cancelled) {
          setActiveReelRefs([]);
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
    return () => {
      cancelled = true;
    };
  }, [lastReelRefs, search.reelId, sessionData]);

  useEffect(() => {
    if (!streamingContentId) return;
    void invalidateQueueQueries(queryClient);
  }, [streamingContentId, queryClient]);

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

  const handleProjectSelect = useCallback(
    (project: Project) => {
      navigate({
        to: REDIRECT_PATHS.STUDIO_GENERATE,
        search: { projectId: project.id, sessionId: undefined, reelId: undefined },
      });
    },
    [navigate]
  );

  const handleSessionSelect = useCallback(
    (session: ChatSession) => {
      navigate({
        to: REDIRECT_PATHS.STUDIO_GENERATE,
        search: { projectId: session.projectId, sessionId: session.id, reelId: undefined },
      });
    },
    [navigate]
  );

  const handleSendMessage = useCallback(
    async (content: string, reelRefs?: number[], mediaRefs?: string[]) => {
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
    },
    [sessionId, sendMessage, activeContentId]
  );

  const handleSessionDeleted = useCallback(() => {
    navigate({
      to: REDIRECT_PATHS.STUDIO_GENERATE,
      search: selectedProject
        ? { projectId: selectedProject.id, sessionId: undefined, reelId: undefined }
        : { sessionId: undefined, projectId: undefined, reelId: undefined },
    });
  }, [navigate, selectedProject]);

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

  const displayMessages = useMemo((): ChatMessage[] => {
    const server = sessionData?.messages ?? [];
    const serverIds = new Set(server.map((message) => message.id));
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
  }, [sessionData?.messages, optimisticUserMessage, streamingContent, streamingMessageId, sessionId]);

  return {
    selectedProject,
    selectedSession,
    isSessionResolving,
    workspaceOpen,
    setWorkspaceOpen,
    activeContentId,
    setActiveContentId,
    requestAudioForContentId,
    displayMessages,
    isStreaming,
    streamError,
    isLimitReached,
    isSavingContent,
    streamingMessageId,
    streamingContentId,
    activeReelRefs,
    resetLimitReached,
    workspaceToggleClass,
    showReelProgressRecall,
    handleShowReelProgressToast,
    handleSendMessage,
    handleOpenAudio,
    handleProjectSelect,
    handleSessionSelect,
    handleSessionDeleted,
    videoJobId,
    videoJobData,
    handleVideoJobStarted,
  };
}
