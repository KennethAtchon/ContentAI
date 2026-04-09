import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/utils/helpers/utils";
import {
  Check,
  X,
  Loader2,
  Copy,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { REDIRECT_PATHS } from "@/shared/utils/redirect/redirect-util";
import { OpenChatButton } from "@/routes/studio/_components/OpenChatButton";
import type { PipelineStage } from "@/features/reels/types/reel.types";
import type { QueueDetail } from "./queue.types";
import { STATUS_STYLES } from "./queue.types";
import { PipelineTrack } from "./PipelineTrack";
import { CopyField } from "./CopyField";
import { AudioRow } from "./AudioRow";

export function DetailPanel({
  detail,
  stages,
  onClose,
  onDelete,
  onDuplicate,
  isDeleting,
  isDuplicating,
}: {
  detail: QueueDetail;
  stages: PipelineStage[];
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  isDeleting: boolean;
  isDuplicating: boolean;
}) {
  const { t } = useTranslation();
  const { sessionId, projectId, queueItem } = detail;
  const assets = detail.assets ?? [];

  // Version navigation — default to the latest (last in array).
  const versions = detail.versions ?? [];
  const hasVersions = versions.length > 1;
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(
    Math.max(0, versions.length - 1)
  );

  // Reset to latest whenever the queue item changes.
  const queueItemId = queueItem.id;
  useEffect(() => {
    setSelectedVersionIdx(Math.max(0, versions.length - 1));
  }, [queueItemId]);

  // Use the selected historical version's copy fields when browsing history,
  // falling back to the live content object for assets/metadata fields.
  const selectedVersion = versions[selectedVersionIdx] ?? null;
  const content = selectedVersion
    ? {
        ...detail.content,
        id: selectedVersion.id,
        version: selectedVersion.version,
        generatedHook: selectedVersion.generatedHook,
        postCaption: selectedVersion.postCaption,
        generatedScript: selectedVersion.generatedScript,
        voiceoverScript: selectedVersion.voiceoverScript,
        sceneDescription: selectedVersion.sceneDescription,
      }
    : detail.content;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const voiceover = assets.find((a) => a.type === "voiceover");
  const music = assets.find((a) => a.type === "music");
  const videoClips = assets.filter((a) => a.type === "video_clip");
  const assembled = assets.find((a) => a.type === "assembled_video");
  const finalVideoUrl =
    detail.latestExportUrl ?? assembled?.r2Url ?? content?.videoR2Url ?? null;

  function handleDelete() {
    if (confirmDelete) {
      onDelete();
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }

  const voiceoverUrl = voiceover?.r2Url ?? content?.voiceoverUrl ?? null;
  const musicUrl = music?.r2Url ?? content?.backgroundAudioUrl ?? null;
  const hasAudioContent = Boolean(voiceoverUrl ?? musicUrl);
  const hasCopyContent =
    content?.postCaption ||
    content?.sceneDescription ||
    content?.voiceoverScript ||
    content?.generatedScript;
  const metadata = content?.generatedMetadata as {
    hashtags?: string[];
    cta?: string;
  } | null;
  const hasMetadata =
    (metadata?.hashtags?.length ?? 0) > 0 || Boolean(metadata?.cta);

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Header ── */}
      <div className="px-8 pt-7 pb-6 border-b border-overlay-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                "text-sm font-bold px-2 py-[3px] rounded-full uppercase tracking-[0.5px]",
                STATUS_STYLES[queueItem.status] ?? STATUS_STYLES.draft
              )}
            >
              {queueItem.status}
            </span>
            {content?.version != null && content.version > 1 && (
              <span className="text-sm font-bold px-1.5 py-[2px] rounded-full bg-overlay-md text-dim-2 uppercase tracking-wide">
                v{content.version}
              </span>
            )}
            {content?.outputType && (
              <span className="text-sm font-medium text-dim-3 uppercase tracking-wide">
                {content.outputType}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-dim-3 hover:text-dim-1 transition-colors shrink-0 p-1 -mr-1 -mt-1 rounded-md hover:bg-overlay-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="text-lg font-semibold text-primary leading-[1.5] mb-4">
          {content?.generatedHook ??
            `${t("studio_queue_itemLabel")} #${queueItem.id}`}
        </h2>

        {/* ── Version navigator ── */}
        {hasVersions && (
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setSelectedVersionIdx((i) => Math.max(0, i - 1))}
              disabled={selectedVersionIdx === 0}
              className="p-1 rounded-md text-dim-3 hover:text-dim-1 hover:bg-overlay-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-dim-2 tabular-nums select-none">
              v{versions[selectedVersionIdx]?.version ?? 1}
              <span className="text-dim-3">
                {" "}
                / v{versions[versions.length - 1]?.version ?? 1}
              </span>
            </span>
            <button
              onClick={() =>
                setSelectedVersionIdx((i) =>
                  Math.min(versions.length - 1, i + 1)
                )
              }
              disabled={selectedVersionIdx === versions.length - 1}
              className="p-1 rounded-md text-dim-3 hover:text-dim-1 hover:bg-overlay-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {selectedVersionIdx < versions.length - 1 && (
              <span className="text-xs text-dim-3 ml-1">
                (viewing older version)
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-dim-3 flex-wrap">
          {queueItem.scheduledFor ? (
            <span>📅 {new Date(queueItem.scheduledFor).toLocaleString()}</span>
          ) : (
            <span>{t("studio_queue_unscheduled")}</span>
          )}
          {queueItem.instagramPageId && (
            <span>📱 {queueItem.instagramPageId}</span>
          )}
          {queueItem.errorMessage && (
            <span className="text-error">⚠ {queueItem.errorMessage}</span>
          )}
        </div>
      </div>

      {/* ── Pipeline track ── */}
      {stages.length > 0 && (
        <div className="px-8 py-5 border-b border-overlay-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-dim-3 mb-4">
            {t("studio_queue_pipeline_label")}
          </p>
          <PipelineTrack stages={stages} />
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 px-8 py-6 space-y-7">
        {/* Copy section */}
        {hasCopyContent && (
          <div className="space-y-4">
            <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
              {t("studio_queue_detail_copy")}
            </p>
            <div className="space-y-4">
              {content?.generatedScript && (
                <CopyField
                  label={t("studio_queue_detail_script")}
                  value={content.generatedScript}
                />
              )}
              {content?.voiceoverScript && (
                <CopyField
                  label={t("studio_queue_detail_clean_script")}
                  value={content.voiceoverScript}
                />
              )}
              {content?.postCaption && (
                <CopyField
                  label={t("studio_queue_detail_caption")}
                  value={content.postCaption}
                />
              )}
              {content?.sceneDescription && (
                <CopyField
                  label={t("studio_queue_detail_scene")}
                  value={content.sceneDescription}
                />
              )}
            </div>
          </div>
        )}

        {/* Hashtags + CTA */}
        {hasMetadata && (
          <div className="space-y-4">
            <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
              {t("studio_queue_detail_social")}
            </p>
            <div className="space-y-3">
              {(metadata?.hashtags?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm text-dim-3">
                    {t("studio_queue_detail_hashtags")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {metadata!.hashtags!.map((tag) => (
                      <span
                        key={tag}
                        className="text-sm text-studio-accent/80 bg-studio-accent/10 px-2 py-0.5 rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {metadata?.cta && (
                <div className="space-y-1">
                  <p className="text-sm text-dim-3">
                    {t("studio_queue_detail_cta")}
                  </p>
                  <p className="text-sm text-dim-1 italic">"{metadata.cta}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Audio */}
        {hasAudioContent && (
          <div className="space-y-3">
            <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
              {t("studio_queue_detail_audio")}
            </p>
            <div className="space-y-3">
              <AudioRow
                label={t("studio_queue_detail_voiceover")}
                url={voiceoverUrl}
                noneLabel={t("studio_queue_detail_none")}
              />
              <AudioRow
                label={t("studio_queue_detail_music")}
                url={musicUrl}
                noneLabel={t("studio_queue_detail_none")}
              />
            </div>
          </div>
        )}

        {/* Video */}
        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
            {t("studio_queue_detail_video")}
          </p>
          <div className="space-y-3">
            {finalVideoUrl ? (
              <video
                src={finalVideoUrl}
                controls
                className="w-full rounded-lg border border-overlay-md"
                preload="metadata"
              />
            ) : (
              <span className="text-sm text-dim-3">
                {t("studio_queue_detail_no_video")}
              </span>
            )}
            {videoClips.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm text-dim-3">
                  {t("studio_queue_detail_clips", { count: videoClips.length })}
                </p>
                <div className="space-y-1">
                  {videoClips.map((clip, i) => (
                    <div
                      key={clip.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-dim-2">
                        {t("studio_queue_detail_clip_n", { n: i + 1 })}
                      </span>
                      <span className="text-dim-3 tabular-nums">
                        {clip.durationMs != null
                          ? `${(clip.durationMs / 1000).toFixed(1)}s`
                          : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-1">
          <p className="text-sm font-bold uppercase tracking-wider text-dim-3">
            {t("studio_queue_detail_actions")}
          </p>
          <div className="flex flex-wrap gap-2">
            {content?.id != null && (
              <Link
                to={REDIRECT_PATHS.STUDIO_EDITOR}
                search={{ projectId: undefined, contentId: content.id }}
                className="inline-flex items-center gap-2 rounded-lg border border-studio-accent/30 bg-studio-accent/10 px-4 py-2 text-sm font-semibold text-studio-accent hover:bg-studio-accent/15 hover:border-studio-accent/50 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("editor_open_in_editor")}
              </Link>
            )}
            <OpenChatButton
              sessionId={sessionId}
              projectId={projectId}
              generatedContentId={content?.id ?? null}
              className="inline-flex items-center gap-2 rounded-lg border border-overlay-md bg-overlay-xs px-4 py-2 text-sm font-semibold text-dim-2 hover:text-studio-fg hover:border-overlay-lg transition-colors disabled:opacity-40"
            />
            {queueItem.status !== "posted" && (
              <button
                onClick={onDuplicate}
                disabled={isDuplicating}
                className="inline-flex items-center gap-2 rounded-lg border border-overlay-md bg-overlay-xs px-4 py-2 text-sm font-semibold text-dim-2 hover:text-dim-1 hover:border-overlay-lg transition-colors disabled:opacity-40"
              >
                {isDuplicating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {t("studio_queue_duplicate")}
              </button>
            )}
          </div>

          {/* Delete */}
          {queueItem.status !== "posted" && (
            <div className="flex items-center gap-2 pt-1">
              {confirmDelete ? (
                <>
                  <span className="text-sm text-dim-3">
                    {t("studio_queue_delete_prompt")}
                  </span>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-overlay-md bg-overlay-xs px-3 py-1.5 text-sm font-medium text-dim-2 hover:text-dim-1 transition-colors"
                  >
                    <X className="h-3 w-3" />
                    {t("studio_queue_delete_cancel")}
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-error/30 bg-error/10 px-3 py-1.5 text-sm font-semibold text-error hover:bg-error/20 transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    {t("studio_queue_delete_confirm")}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleDelete}
                  className="text-sm font-medium text-error/50 hover:text-error transition-colors"
                >
                  {t("studio_queue_delete")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
