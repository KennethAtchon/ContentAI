import React, { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  AlertCircle,
  Zap,
  Film,
  FileText,
  ChevronRight,
  Repeat2,
  Eye,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { UsageWarningBanner } from "./UsageWarningBanner";
import { LimitHitModal } from "./LimitHitModal";
import { queryKeys } from "@/app/query/query-keys";
import { useQueryFetcher } from "@/shared/react/use-query-fetcher";
import { useApp } from "@/app/state/app-context";
import type { ChatMessage as ChatMessageType } from "../model/chat.types";
import type { Reel } from "@/domains/reels/model/reel.types";

interface ChatPanelProps {
  messages: ChatMessageType[];
  onSendMessage: (
    content: string,
    reelRefs?: number[],
    mediaRefs?: string[]
  ) => void;
  isStreaming?: boolean;
  streamingMessageId?: string;
  streamError?: string | null;
  isLimitReached?: boolean;
  isMaxPlan?: boolean;
  isSavingContent?: boolean;
  reels?: unknown[];
  activeReelRefs?: Reel[];
  activeDraftLabel?: string | null;
  onOpenWorkspace?: () => void;
  onResetLimitReached?: () => void;
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
  activeReelRefs,
  activeDraftLabel,
  onOpenWorkspace,
  onResetLimitReached,
}: ChatPanelProps) {
  const { t } = useTranslation();
  const { user } = useApp();
  const fetcher = useQueryFetcher<{
    defaultProvider: string | null;
    defaultProviderLabel: string | null;
    analysisModel: string | null;
    generationModel: string | null;
    supportsVision: boolean;
    contextWindow: number | null;
  }>();
  const { data: aiDefaults } = useQuery({
    queryKey: queryKeys.api.aiDefaults(),
    queryFn: () => fetcher("/api/customer/settings/ai-defaults"),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const aiModelLabel = aiDefaults?.defaultProviderLabel
    ? aiDefaults.generationModel
      ? `${aiDefaults.defaultProviderLabel} · ${aiDefaults.generationModel}`
      : aiDefaults.defaultProviderLabel
    : null;

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
    !!streamingMessageId && messages.some((m) => m.id === streamingMessageId);
  const isWaitingForFirstToken = isStreaming && !hasStreamingMessage;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary/60" />
              </div>
              <h3 className="text-lg font-medium">
                {t("studio_chat_startConversation")}
              </h3>
              <p className="text-base text-muted-foreground max-w-xs">
                {t("studio_chat_startConversationDescription")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {[
                {
                  icon: Zap,
                  label: t("studio_chat_prompt_hook"),
                  prompt: t("studio_chat_prompt_hook_text"),
                },
                {
                  icon: Film,
                  label: t("studio_chat_prompt_script"),
                  prompt: t("studio_chat_prompt_script_text"),
                },
                {
                  icon: FileText,
                  label: t("studio_chat_prompt_caption"),
                  prompt: t("studio_chat_prompt_caption_text"),
                },
                {
                  icon: Repeat2,
                  label: t("studio_chat_prompt_remix"),
                  prompt: t("studio_chat_prompt_remix_text"),
                },
              ].map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => onSendMessage(prompt)}
                  className="flex items-start gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/30 hover:bg-muted/60 hover:border-border transition-colors text-left group"
                >
                  <Icon className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-primary/60 mt-0.5 shrink-0 transition-colors" />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {/* Model capabilities */}
            {aiDefaults && (
              <div className="flex flex-col items-center gap-2 w-full max-w-sm">
                <p className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">
                  {t("studio_chat_capabilities_label")}
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/40 text-xs text-muted-foreground">
                    <MessageSquare className="w-3 h-3 shrink-0" />
                    {t("studio_chat_capabilities_generate")}
                  </span>
                  {aiDefaults.supportsVision && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/40 text-xs text-muted-foreground">
                      <Eye className="w-3 h-3 shrink-0" />
                      {t("studio_chat_capabilities_images")}
                    </span>
                  )}
                  {aiDefaults.contextWindow && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/40 text-xs text-muted-foreground">
                      <BookOpen className="w-3 h-3 shrink-0" />
                      {aiDefaults.contextWindow >= 1_000_000
                        ? `${aiDefaults.contextWindow / 1_000_000}M ctx`
                        : `${aiDefaults.contextWindow / 1_000}k ctx`}
                    </span>
                  )}
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground/40 text-center">
              {t("studio_chat_hint")}
            </p>
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
              aiModelLabel={aiModelLabel}
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
            <span className="text-sm text-muted-foreground">
              {t("studio_chat_aiThinking")}
            </span>
          </div>
        )}

        {streamError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-base">
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
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-warning/10 border border-warning/20 text-base">
              <span className="text-warning font-medium">
                {t("studio_chat_limit_reached")}
              </span>
              {isMaxPlan ? (
                <span className="shrink-0 text-sm font-semibold px-3 py-1.5 rounded-md bg-warning/20 text-warning">
                  {t("studio_chat_limit_maxPlan")}
                </span>
              ) : (
                <a
                  href="/pricing"
                  className="shrink-0 text-sm font-semibold px-3 py-1.5 rounded-md bg-warning/20 text-warning hover:bg-warning/30 transition-colors"
                >
                  {t("studio_chat_limit_upgrade")}
                </a>
              )}
            </div>
          ) : (
            <>
              {activeDraftLabel && onOpenWorkspace && (
                <button
                  type="button"
                  onClick={onOpenWorkspace}
                  className="mb-3 flex max-w-full items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <span className="shrink-0 text-muted-foreground/70">
                    {t("studio_chat_active_draft_indicator")}
                  </span>
                  <span className="truncate text-foreground/85">
                    {activeDraftLabel}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                </button>
              )}
              <ChatInput
                activeReelRefs={activeReelRefs}
                onSendMessage={onSendMessage}
                disabled={isStreaming}
              />
              {aiDefaults?.generationModel && (
                <p className="mt-2 text-center text-[11px] text-muted-foreground/40">
                  {aiDefaults.generationModel}
                  {aiDefaults.supportsVision &&
                    ` · ${t("studio_chat_capabilities_images")}`}
                </p>
              )}
            </>
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
