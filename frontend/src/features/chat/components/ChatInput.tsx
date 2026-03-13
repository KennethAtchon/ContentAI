import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("studio_chat_typeMessage")}
        disabled={disabled}
        className="flex-1 min-h-[80px] max-h-[200px] resize-none"
        rows={1}
      />
      <Button
        type="submit"
        disabled={!message.trim() || disabled}
        className="self-end"
      >
        <Send className="w-4 h-4" />
      </Button>
    </form>
  );
}
