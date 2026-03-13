import { useTranslation } from "react-i18next";
import { User, Bot } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "../types/chat.types";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  if (message.role === "system") {
    return null;
  }

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className="shrink-0 mt-0.5">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isUser ? (
            <User className="w-3.5 h-3.5" />
          ) : (
            <Bot className="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      <div
        className={`flex-1 min-w-0 max-w-[80%] flex flex-col gap-1 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted rounded-tl-sm"
          }`}
        >
          {message.content}
          {isStreaming && (
            <span className="inline-block w-px h-[1em] bg-current opacity-60 ml-0.5 animate-pulse align-middle" />
          )}

          {message.reelRefs && message.reelRefs.length > 0 && (
            <div className="mt-2 pt-2 border-t border-current/20 text-xs opacity-70">
              {t("studio_chat_referencedReels")}: {message.reelRefs.join(", ")}
            </div>
          )}
        </div>

        <span className="text-[10px] text-muted-foreground/60 px-1">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
