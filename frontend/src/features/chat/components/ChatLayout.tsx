import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MessageSquarePlus, PanelRight } from "lucide-react";
import { cn } from "@/shared/utils/helpers/utils";
import { debugLog } from "@/shared/utils/debug/debug";
import { useAuthenticatedFetch } from "@/features/auth/hooks/use-authenticated-fetch";
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
  const { authenticatedFetchJson } = useAuthenticatedFetch();

  const [selectedProject, setSelectedProject] = useState<Project | undefined>();
  const [selectedSession, setSelectedSession] = useState<
    ChatSession | undefined
  >();

  const { hasEnterpriseAccess } = useSubscription();
  const sessionId = search.sessionId || "";
  const { data: sessionData, isLoading: sessionLoading } =
    useChatSession(sessionId);
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
  /** One-shot flicker on “Open workspace” after the first saved draft in this session. */
  const [workspaceToggleFlicker, setWorkspaceToggleFlicker] = useState(false);
  const firstWorkspaceContentNudgeDoneRef = useRef(false);

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
      setWorkspaceToggleFlicker(false);
      firstWorkspaceContentNudgeDoneRef.current = false;
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

  // Once per session: when the first draft is persisted, briefly flicker the workspace toggle (no auto-open)
  useEffect(() => {
    if (streamingContentId == null) return;
    if (firstWorkspaceContentNudgeDoneRef.current) return;
    firstWorkspaceContentNudgeDoneRef.current = true;
    if (!workspaceOpen) {
      setWorkspaceToggleFlicker(true);
    }
  }, [streamingContentId, workspaceOpen]);

  useEffect(() => {
    if (!workspaceToggleFlicker) return;
    const id = window.setTimeout(() => setWorkspaceToggleFlicker(false), 900);
    return () => window.clearTimeout(id);
  }, [workspaceToggleFlicker]);

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
              <button
                type="button"
                onClick={() =>
                  setWorkspaceOpen((prev) => {
                    const next = !prev;
                    if (next) setWorkspaceToggleFlicker(false);
                    return next;
                  })
                }
                className={cn(
                  workspaceToggleClass,
                  workspaceToggleFlicker &&
                    !workspaceOpen &&
                    "workspace-open-toggle-flicker"
                )}
                aria-label={t("workspace_open")}
              >
                <PanelRight className="w-3.5 h-3.5" />
                {t("workspace_open")}
              </button>
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
        />
      )}
    </div>
  );
}
