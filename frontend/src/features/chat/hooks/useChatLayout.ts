import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/shared/contexts/app-context";
import { useChatSession } from "./use-chat-sessions";
import { useChatStream } from "./use-chat-stream";
import { useSessionDrafts } from "./use-session-drafts";
import { useVideoJobManager } from "./use-video-job-manager";
import { useChatActiveReels } from "./use-chat-active-reels";
import { useStreamingContentSideEffects } from "./use-streaming-content-side-effects";
import { useChatLayoutNavigation } from "./use-chat-layout-navigation";
import { useChatDisplayMessages } from "./use-chat-display-messages";
import { useChatSendWithPendingReels } from "./use-chat-send-with-pending-reels";
import { getChatWorkspaceToggleClass } from "../lib/chat-layout-ui";
import type { Project } from "../types/chat.types";

interface ChatSearch {
  projectId?: string;
  sessionId?: string;
  reelId?: string;
}

export function useChatLayout(projects: Project[]) {
  const search = useSearch({ strict: false }) as ChatSearch;
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

  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [activeContentId, setActiveContentId] = useState<number | null>(null);
  const [requestAudioForContentId, setRequestAudioForContentId] = useState<number | null>(null);

  const { pendingReelIds, handleSendMessage } = useChatSendWithPendingReels(
    sessionId,
    sendMessage,
    activeContentId
  );

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

  const activeReelRefs = useChatActiveReels({
    sessionData,
    isStreaming,
    pendingReelIds,
    reelIdFromSearch: search.reelId,
  });

  useStreamingContentSideEffects(streamingContentId, queryClient);

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

  const {
    handleProjectSelect,
    handleSessionSelect,
    handleSessionDeleted,
  } = useChatLayoutNavigation(selectedProject);

  const selectedSession = sessionData?.session;
  const isSessionResolving = Boolean(sessionId) && sessionLoading && !sessionData;

  const prevSessionIdForResetRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionIdForResetRef.current === sessionId) return;
    prevSessionIdForResetRef.current = sessionId;
    setActiveContentId(null);
    setWorkspaceOpen(false);
    setRequestAudioForContentId(null);
  }, [sessionId]);

  const handleOpenAudio = useCallback((contentId: number) => {
    setActiveContentId(contentId);
    setRequestAudioForContentId(contentId);
    setWorkspaceOpen(true);
  }, []);

  const workspaceToggleClass = getChatWorkspaceToggleClass(workspaceOpen);

  const displayMessages = useChatDisplayMessages({
    serverMessages: sessionData?.messages,
    optimisticUserMessage,
    streamingContent,
    streamingMessageId,
    sessionId,
  });

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
