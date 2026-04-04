import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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
import { getSessionDraftLabel } from "../lib/draft-labels";
import { chatService } from "../services/chat.service";
import type { Project } from "../types/chat.types";

interface ChatSearch {
  projectId?: string;
  sessionId?: string;
  reelId?: string;
}

export function useChatLayout(projects: Project[]) {
  const search = useSearch({ strict: false }) as ChatSearch;
  const { user } = useApp();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

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
    streamingContentIds,
    latestStreamingContentId,
    resetLimitReached,
  } = useChatStream(sessionId);

  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [activeContentId, setActiveContentId] = useState<number | null>(null);

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

  useStreamingContentSideEffects(sessionId, streamingContentIds, queryClient);

  const selectedProject = useMemo((): Project | undefined => {
    if (!projects?.length) return undefined;
    if (search.projectId) {
      const fromUrl = projects.find(
        (project) => project.id === search.projectId
      );
      if (fromUrl) return fromUrl;
    }
    const sessionPid = sessionData?.session?.projectId;
    if (sessionPid)
      return projects.find((project) => project.id === sessionPid);
    return undefined;
  }, [projects, search.projectId, sessionData?.session?.projectId]);

  const { handleProjectSelect, handleSessionSelect, handleSessionDeleted } =
    useChatLayoutNavigation(selectedProject);

  const selectedSession = sessionData?.session;
  const isSessionResolving =
    Boolean(sessionId) && sessionLoading && !sessionData;

  const hydratedSessionIdRef = useRef<string | null>(null);
  const prevSessionIdForResetRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionIdForResetRef.current === sessionId) return;
    prevSessionIdForResetRef.current = sessionId;
    setWorkspaceOpen(false);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      hydratedSessionIdRef.current = null;
      setActiveContentId(null);
      return;
    }

    const session = sessionData?.session;
    if (!session) return;
    if (hydratedSessionIdRef.current === session.id) return;

    hydratedSessionIdRef.current = session.id;
    setActiveContentId(session.activeContentId ?? null);
  }, [sessionId, sessionData?.session]);

  useEffect(() => {
    if (latestStreamingContentId == null) return;
    setActiveContentId(latestStreamingContentId);
  }, [latestStreamingContentId]);

  const handleSetActiveContentId = useCallback(
    (contentId: number | null) => {
      setActiveContentId(contentId);
      if (!sessionId) return;

      void chatService
        .updateSessionMetadata(sessionId, { activeContentId: contentId })
        .catch(() => {
          toast.error(t("studio_chat_active_draft_save_failed"));
        });
    },
    [sessionId, t]
  );

  const workspaceToggleClass = getChatWorkspaceToggleClass(workspaceOpen);

  const displayMessages = useChatDisplayMessages({
    serverMessages: sessionData?.messages,
    optimisticUserMessage,
    streamingContent,
    streamingMessageId,
    sessionId,
  });
  const activeDraftIndex =
    sessionDraftsData?.drafts.findIndex((draft) => draft.id === activeContentId) ??
    -1;
  const activeDraft =
    activeDraftIndex >= 0 ? sessionDraftsData?.drafts[activeDraftIndex] : null;
  const activeDraftLabel =
    activeDraft && activeDraftIndex >= 0
      ? getSessionDraftLabel(activeDraft, activeDraftIndex, t, {
          maxLength: 72,
        })
      : null;

  return {
    selectedProject,
    selectedSession,
    isSessionResolving,
    workspaceOpen,
    setWorkspaceOpen,
    activeContentId,
    persistedActiveContentId: selectedSession?.activeContentId ?? null,
    setActiveContentId: handleSetActiveContentId,
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
  };
}
