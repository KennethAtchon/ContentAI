import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { invalidateReelsUsageAndUsageStats } from "@/shared/lib/query-invalidation";
import { debugLog } from "@/shared/utils/debug/debug";
import type { ChatMessage } from "../types/chat.types";

/** Default overlay id; overridden per send via streamingIdRef in the hook. */
export const STREAMING_MESSAGE_ID = "streaming-ai-response";

export const STREAM_REQUEST_TIMEOUT_MS = 120_000;

type ChatSessionQueryData = {
  session: unknown;
  messages: ChatMessage[];
};

export function buildOptimisticUserMessage(
  sessionId: string,
  content: string,
  reelRefs?: number[],
  mediaRefs?: string[]
): ChatMessage {
  return {
    id: `optimistic-${Date.now()}`,
    sessionId,
    role: "user",
    content,
    reelRefs,
    mediaRefs,
    createdAt: new Date().toISOString(),
  };
}

export function clearVisibleStreamMessages(
  setOptimisticUserMessage: (msg: ChatMessage | null) => void,
  setStreamingContent: (text: string | null) => void
): void {
  setOptimisticUserMessage(null);
  setStreamingContent(null);
}

export async function handleChatMessagesForbiddenResponse(
  response: Response,
  queryClient: QueryClient
): Promise<boolean> {
  if (response.status !== 403) return false;
  const body = await response.json().catch(() => ({}));
  const code = (body as { code?: string }).code;
  debugLog.warn("[ChatStream] 403 response", { code });
  if (code !== "USAGE_LIMIT_REACHED") return false;

  debugLog.warn("[ChatStream] Usage limit reached — aborting stream");
  void invalidateReelsUsageAndUsageStats(queryClient);
  return true;
}

export function patchSessionCacheAfterStream(
  queryClient: QueryClient,
  sessionId: string,
  optimisticUser: ChatMessage,
  assistantText: string
): void {
  const pendingAssistant: ChatMessage[] = assistantText
    ? [
        {
          id: `ai-pending-${Date.now()}`,
          sessionId,
          role: "assistant",
          content: assistantText,
          createdAt: new Date().toISOString(),
        },
      ]
    : [];

  queryClient.setQueryData(
    queryKeys.api.chatSession(sessionId),
    (old: ChatSessionQueryData | undefined) => {
      if (!old) return old;
      return {
        ...old,
        messages: [...old.messages, optimisticUser, ...pendingAssistant],
      };
    }
  );
}
