import { useTranslation } from "react-i18next";
import { ArrowLeft, ListPlus, Mic, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useSendToQueue } from "../hooks/use-send-to-queue";
import { cn } from "@/shared/utils/helpers/utils";
import type { SessionDraft } from "../types/chat.types";

interface DraftDetailProps {
  draft: SessionDraft;
  isActive: boolean;
  onBack: () => void;
  onOpenAudio: () => void;
  onSetActive: (id: number) => void;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label}
      </span>
      {children}
    </div>
  );
}

export function DraftDetail({ draft, isActive, onBack, onOpenAudio, onSetActive }: DraftDetailProps) {
  const { t } = useTranslation();
  const sendToQueue = useSendToQueue();
  const [sent, setSent] = useState(false);

  const metadata = draft.generatedMetadata as {
    hashtags?: string[];
    cta?: string;
    changeDescription?: string;
  } | null;

  const handleSendToQueue = async () => {
    try {
      await sendToQueue.mutateAsync(draft.id);
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch {
      // silently handled
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sub-header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("workspace_back_to_drafts")}
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/60 bg-muted/60 px-1.5 py-0.5 rounded">
            v{draft.version}
          </span>
          {isActive && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {t("workspace_draft_active")}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {!isActive && (
          <button
            onClick={() => onSetActive(draft.id)}
            className="w-full py-1.5 text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg hover:border-primary/40 hover:text-primary transition-colors"
          >
            {t("workspace_set_active_for_ai")}
          </button>
        )}

        {draft.generatedHook && (
          <Section label={t("workspace_section_hook")}>
            <p className="text-sm leading-relaxed text-foreground">
              {draft.generatedHook}
            </p>
          </Section>
        )}

        {draft.generatedScript && (
          <Section label={t("workspace_section_script")}>
            <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-line">
              {draft.generatedScript}
            </p>
          </Section>
        )}

        {draft.generatedCaption && (
          <Section label={t("workspace_section_caption")}>
            <p className="text-xs leading-relaxed text-foreground/80">
              {draft.generatedCaption}
            </p>
          </Section>
        )}

        {metadata?.hashtags && metadata.hashtags.length > 0 && (
          <Section label={t("workspace_section_hashtags")}>
            <div className="flex flex-wrap gap-1">
              {metadata.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] text-primary/70 bg-primary/[0.07] px-2 py-0.5 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </Section>
        )}

        {metadata?.cta && (
          <Section label={t("workspace_section_cta")}>
            <p className="text-xs text-foreground/80 italic">"{metadata.cta}"</p>
          </Section>
        )}

        {metadata?.changeDescription && (
          <Section label={t("workspace_section_changes")}>
            <p className="text-xs text-muted-foreground italic">{metadata.changeDescription}</p>
          </Section>
        )}
      </div>

      {/* Action footer */}
      <div className="shrink-0 border-t px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => void handleSendToQueue()}
          disabled={sendToQueue.isPending || sent}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors",
            "border border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {sent ? (
            <><Check className="w-3.5 h-3.5 text-emerald-500" />{t("workspace_queued")}</>
          ) : sendToQueue.isPending ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />{t("workspace_queuing")}</>
          ) : (
            <><ListPlus className="w-3.5 h-3.5" />{t("workspace_send_to_queue")}</>
          )}
        </button>
        <button
          onClick={onOpenAudio}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border border-primary/30 bg-primary/[0.06] text-primary hover:bg-primary/[0.10] transition-colors"
        >
          <Mic className="w-3.5 h-3.5" />
          {t("workspace_add_audio")}
        </button>
      </div>
    </div>
  );
}
