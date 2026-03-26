import { useTranslation } from "react-i18next";
import { ArrowLeft, Mic, Film } from "lucide-react";
import { AudioStatusBadge } from "@/features/audio/components/AudioStatusBadge";
import { useContentAssets } from "@/features/audio/hooks/use-content-assets";
import type { SessionDraft } from "../types/chat.types";

interface DraftDetailProps {
  draft: SessionDraft;
  isActive: boolean;
  onBack: () => void;
  onOpenAudio: () => void;
  onOpenVideo: () => void;
  onSetActive: (id: number) => void;
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label}
      </span>
      {children}
    </div>
  );
}

export function DraftDetail({
  draft,
  isActive,
  onBack,
  onOpenAudio,
  onOpenVideo,
  onSetActive,
}: DraftDetailProps) {
  const { t } = useTranslation();
  const { data: assetsData } = useContentAssets(draft.id);
  const assets = assetsData?.assets ?? [];
  const hasAudio = assets.some(
    (a) =>
      a.role === "voiceover" ||
      a.role === "background_music" ||
      a.type === "voiceover"
  );
  const assembledAsset =
    assets.find((a) => a.type === "assembled_video") ?? null;

  const metadata = draft.generatedMetadata as {
    hashtags?: string[];
    cta?: string;
    changeDescription?: string;
  } | null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sub-header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t("workspace_back_to_drafts")}
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground/60 bg-muted/60 px-1.5 py-0.5 rounded">
            v{draft.version}
          </span>
          {isActive && (
            <span className="flex items-center gap-1 text-sm font-semibold text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {t("workspace_draft_active")}
            </span>
          )}
          <AudioStatusBadge
            generatedContentId={draft.id}
            onClick={onOpenAudio}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {!isActive && (
          <button
            onClick={() => onSetActive(draft.id)}
            className="w-full py-1.5 text-sm text-muted-foreground border border-dashed border-border/60 rounded-lg hover:border-primary/40 hover:text-primary transition-colors"
          >
            {t("workspace_set_active_for_ai")}
          </button>
        )}

        {draft.generatedHook && (
          <Section label={t("workspace_section_hook")}>
            <p className="text-base leading-relaxed text-foreground">
              {draft.generatedHook}
            </p>
          </Section>
        )}

        {draft.generatedScript && (
          <Section label={t("workspace_section_script")}>
            <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">
              {draft.generatedScript}
            </p>
          </Section>
        )}

        {draft.postCaption && (
          <Section label={t("workspace_section_caption")}>
            <p className="text-sm leading-relaxed text-foreground/80">
              {draft.postCaption}
            </p>
          </Section>
        )}

        {metadata?.hashtags && metadata.hashtags.length > 0 && (
          <Section label={t("workspace_section_hashtags")}>
            <div className="flex flex-wrap gap-1">
              {metadata.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="text-sm text-primary/70 bg-primary/[0.07] px-2 py-0.5 rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </Section>
        )}

        {metadata?.cta && (
          <Section label={t("workspace_section_cta")}>
            <p className="text-sm text-foreground/80 italic">
              "{metadata.cta}"
            </p>
          </Section>
        )}

        {metadata?.changeDescription && (
          <Section label={t("workspace_section_changes")}>
            <p className="text-sm text-muted-foreground italic">
              {metadata.changeDescription}
            </p>
          </Section>
        )}

        <Section label={t("workspace_section_video")}>
          {assembledAsset?.mediaUrl ? (
            <div className="flex flex-col gap-2">
              <video
                src={assembledAsset.mediaUrl}
                className="w-full rounded-lg border border-border/60"
                controls
                preload="metadata"
              />
              <button
                onClick={onOpenVideo}
                className="w-full py-1.5 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/[0.06] transition-colors"
              >
                {t("workspace_video_reassemble")}
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenVideo}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Film className="w-3.5 h-3.5" />
              {t("workspace_video_not_generated")}
            </button>
          )}
        </Section>
      </div>

      {/* Action footer */}
      <div className="shrink-0 border-t px-4 py-3 flex gap-2">
        <button
          onClick={onOpenAudio}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border border-primary/30 bg-primary/[0.06] text-primary hover:bg-primary/[0.10] transition-colors"
        >
          <Mic className="w-3.5 h-3.5" />
          {hasAudio ? t("workspace_edit_audio") : t("workspace_add_audio")}
        </button>
        <button
          onClick={onOpenVideo}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border border-border/60 text-foreground/80 hover:bg-muted transition-colors"
        >
          <Film className="w-3.5 h-3.5" />
          {assembledAsset
            ? t("workspace_video_reassemble")
            : t("workspace_tab_video")}
        </button>
      </div>
    </div>
  );
}
