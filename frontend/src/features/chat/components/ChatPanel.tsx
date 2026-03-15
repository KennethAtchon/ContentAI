import React, { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, AlertCircle } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { UsageWarningBanner } from "./UsageWarningBanner";
import { LimitHitModal } from "./LimitHitModal";
import type { ChatMessage as ChatMessageType } from "../types/chat.types";
import type { Reel } from "@/features/reels/types/reel.types";

interface ChatPanelProps {
  messages: ChatMessageType[];
  onSendMessage: (content: string, reelRefs?: number[]) => void;
  isStreaming?: boolean;
  streamingMessageId?: string;
  streamError?: string | null;
  isLimitReached?: boolean;
  isMaxPlan?: boolean;
  isSavingContent?: boolean;
  streamingContentId?: number | null;
  reels?: unknown[];
  activeReelRefs?: Reel[];
  onResetLimitReached?: () => void;
  onOpenAudio?: (contentId: number, scriptText: string) => void;
}

export function ChatPanel({
  messages,
  onSendMessage,
  isStreaming,
  streamingMessageId,
  streamError,
  isLimitReached,
  isMaxPlan,
  isSavingContent,
  streamingContentId,
  activeReelRefs,
  onResetLimitReached,
  onOpenAudio,
}: ChatPanelProps) {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    // Smooth scroll only when a new message is appended (count increases).
    // Use instant during streaming so rapid chunk updates don't continuously
    // interrupt and restart the smooth scroll animation.
    const isNewMessage = messages.length > prevCount;
    messagesEndRef.current?.scrollIntoView({
      behavior: isNewMessage ? "smooth" : "instant",
    });
  }, [messages]);

  // Show thinking dots while streaming but no content has arrived yet
  const hasStreamingMessage =
    !!streamingMessageId &&
    messages.some((m) => m.id === streamingMessageId);
  const isWaitingForFirstToken = isStreaming && !hasStreamingMessage;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary/60" />
            </div>
            <div>
              <h3 className="text-base font-medium mb-1">
                {t("studio_chat_startConversation")}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {t("studio_chat_startConversationDescription")}
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              isStreaming={message.id === streamingMessageId}
              isSavingContent={
                message.id === streamingMessageId ? isSavingContent : undefined
              }
              streamingContentId={
                message.id === streamingMessageId
                  ? streamingContentId
                  : undefined
              }
              onOpenAudio={onOpenAudio}
            />
          ))
        )}

        {isWaitingForFirstToken && (
          <div className="flex items-center gap-2 px-1">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-muted-foreground">
              {t("studio_chat_aiThinking")}
            </span>
          </div>
        )}

        {streamError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{streamError}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t shrink-0">
        {!isLimitReached && <UsageWarningBanner />}
        <div className="p-4">
          {isLimitReached ? (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
              <span className="text-amber-400 font-medium">
                {t("studio_chat_limit_reached")}
              </span>
              {isMaxPlan ? (
                <span className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md bg-amber-500/20 text-amber-400">
                  {t("studio_chat_limit_maxPlan")}
                </span>
              ) : (
                <a
                  href="/pricing"
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                >
                  {t("studio_chat_limit_upgrade")}
                </a>
              )}
            </div>
          ) : (
            <ChatInput
              activeReelRefs={activeReelRefs}
              onSendMessage={onSendMessage}
              disabled={isStreaming}
            />
          )}
        </div>
      </div>

      <LimitHitModal
        open={!!isLimitReached}
        isMaxPlan={isMaxPlan}
        onClose={onResetLimitReached || (() => {})}
      />
    </div>
  );
}
