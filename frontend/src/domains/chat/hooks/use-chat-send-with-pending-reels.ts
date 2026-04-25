import { useState, useCallback } from "react";
import { debugLog } from "@/shared/debug/debug";

type SendMessageFn = (
  content: string,
  reelRefs?: number[],
  activeContentId?: number,
  mediaRefs?: string[]
) => Promise<void>;

export function useChatSendWithPendingReels(
  sessionId: string,
  sendMessage: SendMessageFn,
  activeContentId: number | null
) {
  const [pendingReelIds, setPendingReelIds] = useState<number[]>([]);

  const handleSendMessage = useCallback(
    async (content: string, reelRefs?: number[], mediaRefs?: string[]) => {
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
    },
    [sessionId, sendMessage, activeContentId]
  );

  return { pendingReelIds, handleSendMessage };
}
