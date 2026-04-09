import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Send, Paperclip, Video, Loader2 } from "lucide-react";
import { ReelRefCard } from "./ReelRefCard";
import { VideoRefCard } from "./VideoRefCard";
import { ReelPickerModal } from "./ReelPickerModal";
import { useUploadMedia } from "@/features/media/hooks/use-media-library";
import type { Reel } from "@/features/reels/types/reel.types";
import type { MediaItem } from "@/features/media/types/media.types";

interface SlashCommand {
  trigger: string;
  labelKey: string;
  promptKey: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    trigger: "/hook",
    labelKey: "studio_chat_slash_hook",
    promptKey: "studio_chat_prompt_hook_text",
  },
  {
    trigger: "/script",
    labelKey: "studio_chat_slash_script",
    promptKey: "studio_chat_prompt_script_text",
  },
  {
    trigger: "/caption",
    labelKey: "studio_chat_slash_caption",
    promptKey: "studio_chat_prompt_caption_text",
  },
  {
    trigger: "/shorter",
    labelKey: "studio_chat_slash_shorter",
    promptKey: "studio_chat_slash_shorter",
  },
  {
    trigger: "/remix",
    labelKey: "studio_chat_slash_remix",
    promptKey: "studio_chat_prompt_remix_text",
  },
];

interface ChatInputProps {
  onSendMessage: (
    content: string,
    reelRefs?: number[],
    mediaRefs?: string[]
  ) => void;
  disabled?: boolean;
  activeReelRefs?: Reel[];
}

export function ChatInput({
  onSendMessage,
  disabled,
  activeReelRefs,
}: ChatInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [attachedReels, setAttachedReels] = useState<Reel[]>([]);
  const [attachedMedia, setAttachedMedia] = useState<MediaItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const uploadMedia = useUploadMedia();

  // Initialize with active reel ref if provided
  useEffect(() => {
    setAttachedReels(activeReelRefs || []);
  }, [activeReelRefs]);

  const filteredCommands = SLASH_COMMANDS.filter((cmd) =>
    cmd.trigger.startsWith("/" + slashFilter)
  );

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setMessage(value);

    // Detect slash at the very start of input (or after clearing)
    if (value.startsWith("/")) {
      const query = value.slice(1);
      // Only show menu if no space yet (still typing the command)
      if (!query.includes(" ")) {
        setSlashFilter(query);
        setSlashMenuIndex(0);
        setSlashMenuOpen(true);
        return;
      }
    }
    setSlashMenuOpen(false);
  }

  function applySlashCommand(cmd: SlashCommand) {
    const prompt = t(cmd.promptKey);
    setMessage("");
    setSlashMenuOpen(false);
    onSendMessage(
      prompt,
      attachedReels.length > 0 ? attachedReels.map((r) => r.id) : undefined,
      attachedMedia.length > 0 ? attachedMedia.map((m) => m.id) : undefined
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      const reelRefs =
        attachedReels.length > 0 ? attachedReels.map((r) => r.id) : undefined;
      const mediaRefs =
        attachedMedia.length > 0 ? attachedMedia.map((m) => m.id) : undefined;
      onSendMessage(message.trim(), reelRefs, mediaRefs);
      setMessage("");
      setAttachedMedia([]);
      setSlashMenuOpen(false);
    }
  };

  async function handleVideoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";
    try {
      const result = await uploadMedia.mutateAsync({ file });
      setAttachedMedia((prev) => [...prev, result.item]);
    } catch {
      // error handled by mutation state
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (slashMenuOpen && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenuIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenuIndex(
          (i) => (i - 1 + filteredCommands.length) % filteredCommands.length
        );
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        applySlashCommand(filteredCommands[slashMenuIndex]);
        return;
      }
      if (e.key === "Escape") {
        setSlashMenuOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  function handleReelSelect(reel: Reel) {
    if (!attachedReels.find((r) => r.id === reel.id)) {
      setAttachedReels((prev) => [...prev, reel]);
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
      {(attachedReels.length > 0 || attachedMedia.length > 0) && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {attachedReels.map((reel) => (
            <ReelRefCard
              key={reel.id}
              reelId={reel.id}
              onRemove={handleRemoveReel}
            />
          ))}
          {attachedMedia.map((item) => (
            <VideoRefCard
              key={item.id}
              item={item}
              onRemove={(id) =>
                setAttachedMedia((prev) => prev.filter((m) => m.id !== id))
              }
            />
          ))}
        </div>
      )}

      <div className="relative">
        {/* Slash command menu */}
        {slashMenuOpen && filteredCommands.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1.5 w-72 rounded-xl border border-border bg-popover shadow-lg overflow-hidden z-50">
            <div className="px-3 py-1.5 border-b border-border/60">
              <span className="text-sm font-semibold text-muted-foreground/60 uppercase tracking-wider">
                {t("studio_chat_slash_label")}
              </span>
            </div>
            {filteredCommands.map((cmd, i) => (
              <button
                key={cmd.trigger}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applySlashCommand(cmd);
                }}
                onMouseEnter={() => setSlashMenuIndex(i)}
                className={`w-full flex items-baseline gap-2.5 px-3 py-2 text-left transition-colors ${
                  i === slashMenuIndex
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <span className="text-sm font-mono font-semibold text-primary/70 shrink-0">
                  {cmd.trigger}
                </span>
                <span className="text-sm truncate">{t(cmd.labelKey)}</span>
              </button>
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
            title={
              disabled
                ? "Wait for the current response to finish."
                : t("studio_chat_attachReel")
            }
            aria-label={t("studio_chat_attachReel")}
            className="shrink-0 mb-0.5 text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime"
            className="hidden"
            onChange={handleVideoFileChange}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => videoInputRef.current?.click()}
            disabled={disabled || uploadMedia.isPending}
            title={
              disabled
                ? "Wait for the current response to finish."
                : uploadMedia.isPending
                  ? "Uploading video..."
                  : t("chat_attach_video")
            }
            aria-label={t("chat_attach_video")}
            className="shrink-0 mb-0.5 text-muted-foreground hover:text-foreground"
          >
            {uploadMedia.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Video className="w-4 h-4" />
            )}
          </Button>

          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setSlashMenuOpen(false), 150)}
            placeholder={t("studio_chat_typeMessage")}
            disabled={disabled}
            title={
              disabled ? "Wait for the current response to finish." : undefined
            }
            className="flex-1 min-h-[44px] max-h-[200px] resize-none"
            rows={2}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() || disabled}
            title={
              disabled
                ? "Wait for the current response to finish."
                : !message.trim()
                  ? "Type a message to send."
                  : t("studio_chat_sendMessage")
            }
            aria-label={t("studio_chat_sendMessage")}
            className="shrink-0 mb-0.5"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>

      <ReelPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedIds={attachedReels.map((r) => r.id)}
        onSelect={handleReelSelect}
      />
    </div>
  );
}
