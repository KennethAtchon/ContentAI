import { useState, useEffect, useMemo } from "react";
import { debugLog } from "@/shared/utils/debug/debug";
import { reelsService } from "@/features/reels/services/reels.service";
import type { Reel } from "@/features/reels/types/reel.types";

/** Minimal session shape for resolving reel refs from the last user message */
interface SessionMessagesShape {
  messages: { role: string; reelRefs?: number[] }[];
}

export function useChatActiveReels(options: {
  sessionData: SessionMessagesShape | undefined;
  isStreaming: boolean;
  pendingReelIds: number[];
  reelIdFromSearch?: string;
}): Reel[] {
  const { sessionData, isStreaming, pendingReelIds, reelIdFromSearch } =
    options;
  const [activeReelRefs, setActiveReelRefs] = useState<Reel[]>([]);

  const lastReelRefs = useMemo(() => {
    if (isStreaming && pendingReelIds.length > 0) return pendingReelIds;
    if (!sessionData) return [];
    const userMessages = sessionData.messages.filter((m) => m.role === "user");
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
        } else if (reelIdFromSearch && sessionData) {
          const data = await reelsService.getReel(Number(reelIdFromSearch));
          if (!cancelled && data.reel)
            setActiveReelRefs([data.reel as unknown as Reel]);
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
  }, [lastReelRefs, reelIdFromSearch, sessionData]);

  return activeReelRefs;
}
