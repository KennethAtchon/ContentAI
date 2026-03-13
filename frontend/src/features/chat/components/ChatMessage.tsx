import React from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { User, Bot } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "../types/chat.types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return null; // Don't render system messages
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex gap-3 max-w-[80%] ${isUser ? "flex-row-reverse" : ""}`}>
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}>
            {isUser ? (
              <User className="w-4 h-4" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
          </div>
        </div>
        
        <Card className={`flex-1 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-background"
        }`}>
          <CardContent className="p-3">
            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
            
            {message.reelRefs && message.reelRefs.length > 0 && (
              <div className="mt-2 pt-2 border-t border-current/20">
                <div className="text-xs opacity-70">
                  Referenced reels: {message.reelRefs.join(", ")}
                </div>
              </div>
            )}
            
            <div className="mt-1 text-xs opacity-50">
              {new Date(message.createdAt).toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
