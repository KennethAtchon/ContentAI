import React, { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Send } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import type { ChatMessage as ChatMessageType } from "../types/chat.types";

interface ChatPanelProps {
  messages: ChatMessageType[];
  onSendMessage?: (content: string) => void;
  isLoading?: boolean;
  input?: string;
  handleInputChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit?: (e: React.FormEvent) => void;
}

export function ChatPanel({
  messages,
  onSendMessage,
  isLoading,
  input,
  handleInputChange,
  handleSubmit,
}: ChatPanelProps) {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {t("studio_chat_startConversation")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("studio_chat_startConversationDescription")}
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}

        {isLoading && (
          <div className="flex items-center gap-2 p-3">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-75"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150"></div>
            <span className="text-sm text-muted-foreground">
              {t("studio_chat_aiThinking")}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4">
        {handleSubmit && handleInputChange ? (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              value={input}
              onChange={handleInputChange}
              placeholder={t("studio_chat_typeMessage")}
              disabled={isLoading}
              className="flex-1 min-h-[80px] max-h-[200px] resize-none"
              rows={1}
            />
            <Button
              type="submit"
              disabled={!input?.trim() || isLoading}
              className="self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        ) : (
          <ChatInput onSendMessage={onSendMessage!} disabled={isLoading} />
        )}
      </div>
    </div>
  );
}
