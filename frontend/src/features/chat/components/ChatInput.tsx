import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Send, Paperclip } from "lucide-react";
import { ReelRefCard } from "./ReelRefCard";
import { ReelPickerModal } from "./ReelPickerModal";
import type { Reel } from "@/features/reels/types/reel.types";

interface ChatInputProps {
  onSendMessage: (content: string, reelRefs?: number[]) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [attachedReels, setAttachedReels] = useState<Reel[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      const reelRefs =
        attachedReels.length > 0 ? attachedReels.map((r) => r.id) : undefined;
      onSendMessage(message.trim(), reelRefs);
      setMessage("");
      setAttachedReels([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  function handleReelSelect(reel: Reel) {
    if (!attachedReels.find((r) => r.id === reel.id)) {
      setAttachedReels((prev) => [...prev, reel]);
      // Append @username to message text
      setMessage((prev) => {
        const suffix = `@${reel.username} `;
        return prev ? `${prev} ${suffix}` : suffix;
      });
    }
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function handleRemoveReel(id: number) {
    setAttachedReels((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-2">
      {attachedReels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {attachedReels.map((reel) => (
            <ReelRefCard
              key={reel.id}
              reelId={reel.id}
              onRemove={handleRemoveReel}
            />
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setPickerOpen(true)}
          disabled={disabled}
          aria-label={t("studio_chat_attachReel")}
          className="shrink-0 mb-0.5 text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="w-4 h-4" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("studio_chat_typeMessage")}
          disabled={disabled}
          className="flex-1 min-h-[44px] max-h-[200px] resize-none"
          rows={2}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || disabled}
          aria-label={t("studio_chat_sendMessage")}
          className="shrink-0 mb-0.5"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>

      <ReelPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedIds={attachedReels.map((r) => r.id)}
        onSelect={handleReelSelect}
      />
    </div>
  );
}
