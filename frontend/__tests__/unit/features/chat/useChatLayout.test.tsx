/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as router from "@tanstack/react-router";
import * as i18n from "react-i18next";
import * as appContext from "@/app/state/app-context";
import * as chatSessionsHooks from "@/domains/chat/hooks/use-chat-sessions";
import * as sessionDraftsHooks from "@/domains/chat/hooks/use-session-drafts";
import * as chatStreamHooks from "@/domains/chat/hooks/use-chat-stream";
import * as videoJobHooks from "@/domains/chat/hooks/use-video-job-manager";
import * as activeReelsHooks from "@/domains/chat/hooks/use-chat-active-reels";
import * as sideEffectsHooks from "@/domains/chat/hooks/use-streaming-content-side-effects";
import * as navigationHooks from "@/domains/chat/hooks/use-chat-layout-navigation";
import * as displayMessagesHooks from "@/domains/chat/hooks/use-chat-display-messages";
import * as pendingReelsHooks from "@/domains/chat/hooks/use-chat-send-with-pending-reels";
import * as uiLib from "@/domains/chat/lib/chat-layout-ui";
import * as draftLabels from "@/domains/chat/lib/draft-labels";
import { useChatLayout } from "@/domains/chat/hooks/useChatLayout";

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useChatLayout", () => {
  const project = {
    id: "project-1",
    name: "Project 1",
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
  };

  let sessionData: {
    session: {
      id: string;
      title: string;
      projectId: string;
      activeContentId: number | null;
    };
    messages: never[];
  };

  beforeEach(() => {
    sessionData = {
      session: {
        id: "session-1",
        title: "Session 1",
        projectId: "project-1",
        activeContentId: null,
      },
      messages: [],
    };

    spyOn(router, "useSearch").mockReturnValue({
      sessionId: "session-1",
      projectId: "project-1",
    } as never);
    spyOn(i18n, "useTranslation").mockReturnValue({
      t: (key: string) => key,
      i18n: {} as never,
    } as never);
    spyOn(appContext, "useApp").mockReturnValue({
      user: { uid: "user-1" },
    } as never);
    spyOn(chatSessionsHooks, "useChatSession").mockImplementation(
      () =>
        ({
          data: sessionData,
          isLoading: false,
        }) as never
    );
    spyOn(sessionDraftsHooks, "useSessionDrafts").mockReturnValue({
      data: { drafts: [] },
    } as never);
    spyOn(chatStreamHooks, "useChatStream").mockReturnValue({
      sendMessage: async () => {},
      optimisticUserMessage: null,
      streamingContent: null,
      streamingMessageId: "stream-1",
      isStreaming: false,
      streamError: null,
      isLimitReached: false,
      isSavingContent: false,
      streamingContentIds: [],
      latestStreamingContentId: null,
      resetLimitReached: () => {},
    } as never);
    spyOn(videoJobHooks, "useVideoJobManager").mockReturnValue({
      videoJobId: null,
      videoJobData: undefined,
      showReelProgressRecall: false,
      handleVideoJobStarted: () => {},
      handleShowReelProgressToast: () => {},
    } as never);
    spyOn(activeReelsHooks, "useChatActiveReels").mockReturnValue([]);
    spyOn(
      sideEffectsHooks,
      "useStreamingContentSideEffects"
    ).mockImplementation(() => {});
    spyOn(navigationHooks, "useChatLayoutNavigation").mockReturnValue({
      handleProjectSelect: () => {},
      handleSessionSelect: () => {},
      handleSessionDeleted: () => {},
    } as never);
    spyOn(displayMessagesHooks, "useChatDisplayMessages").mockReturnValue([]);
    spyOn(pendingReelsHooks, "useChatSendWithPendingReels").mockReturnValue({
      pendingReelIds: [],
      handleSendMessage: async () => {},
    } as never);
    spyOn(uiLib, "getChatWorkspaceToggleClass").mockReturnValue("toggle");
    spyOn(draftLabels, "getSessionDraftLabel").mockReturnValue("Draft 1");
  });

  afterEach(() => {
    cleanup();
  });

  it("adopts a persisted active draft when the session updates after first hydration", async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const { result, rerender } = renderHook(() => useChatLayout([project]), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.activeContentId).toBeNull();
    });

    sessionData = {
      ...sessionData,
      session: {
        ...sessionData.session,
        activeContentId: 42,
      },
    };

    rerender();

    await waitFor(() => {
      expect(result.current.activeContentId).toBe(42);
    });
  });
});
