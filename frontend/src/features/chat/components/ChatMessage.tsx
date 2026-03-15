import { useState } from "react";
import { useTranslation } from "react-i18next";
import { User, Bot, ListPlus, Check, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ChatMessage as ChatMessageType } from "../types/chat.types";
import { ReelRefCard } from "./ReelRefCard";
import { useSendToQueue } from "../hooks/use-send-to-queue";

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  h1: ({ children }) => (
    <h1 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold mb-1.5 mt-3 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    return isBlock ? (
      <code className="block bg-black/20 rounded-md px-3 py-2 text-xs font-mono whitespace-pre overflow-x-auto my-2">
        {children}
      </code>
    ) : (
      <code className="bg-black/20 rounded px-1 py-0.5 text-xs font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-current/30 pl-3 italic opacity-80 my-2">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="border-current/20 my-3" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 opacity-80 hover:opacity-100"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-xs border-collapse w-full">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-current/20 px-2 py-1 font-semibold text-left bg-black/10">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-current/20 px-2 py-1">{children}</td>
  ),
};

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  isSavingContent?: boolean;
  streamingContentId?: number | null;
}

export function ChatMessage({
  message,
  isStreaming,
  isSavingContent,
  streamingContentId,
}: ChatMessageProps) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const sendToQueue = useSendToQueue();
  const [sent, setSent] = useState(false);

  if (message.role === "system") {
    return null;
  }

  const resolvedContentId =
    streamingContentId ?? message.generatedContentId ?? null;

  async function handleSendToQueue() {
    if (!resolvedContentId) return;
    try {
      await sendToQueue.mutateAsync(resolvedContentId);
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch {
      // error silently handled
    }
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
          className={`rounded-2xl px-4 py-2.5 text-sm break-words ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm whitespace-pre-wrap"
              : "bg-muted rounded-tl-sm"
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          )}
          {isStreaming && !isSavingContent && (
            <span className="inline-block w-px h-[1em] bg-current opacity-60 ml-0.5 animate-pulse align-middle" />
          )}

          {isSavingContent && (
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground/60">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{t("studio_chat_savingContent")}</span>
            </div>
          )}

          {message.reelRefs && message.reelRefs.length > 0 && (
            <div className="mt-2 pt-2 border-t border-current/20 flex flex-wrap gap-1.5">
              {message.reelRefs.map((id) => (
                <ReelRefCard key={id} reelId={id} />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-muted-foreground/60">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          {!isUser && resolvedContentId && !isSavingContent && (
            <button
              onClick={handleSendToQueue}
              disabled={sendToQueue.isPending || sent}
              className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border border-primary/20 bg-primary/[0.06] text-primary/70 hover:bg-primary/[0.12] hover:text-primary transition-colors disabled:opacity-50"
            >
              {sent ? (
                <>
                  <Check className="w-2.5 h-2.5" />
                  {t("studio_chat_sentToQueue")}
                </>
              ) : (
                <>
                  <ListPlus className="w-2.5 h-2.5" />
                  {t("studio_chat_sendToQueue")}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
