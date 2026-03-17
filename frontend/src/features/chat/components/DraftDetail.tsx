import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ListPlus,
  Mic,
  Check,
  Loader2,
  Film,
  RotateCcw,
  WandSparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSendToQueue } from "../hooks/use-send-to-queue";
import { AudioStatusBadge } from "@/features/audio/components/AudioStatusBadge";
import { useContentAssets } from "@/features/audio/hooks/use-content-assets";
import { cn } from "@/shared/utils/helpers/utils";
import { useGenerateReel } from "@/features/video/hooks/use-generate-reel";
import { useAssembleReel } from "@/features/video/hooks/use-assemble-reel";
import { useRetryVideoJob } from "@/features/video/hooks/use-retry-video-job";
import { useUploadShotAsset } from "@/features/video/hooks/use-upload-shot-asset";
import { useRegenerateShot } from "@/features/video/hooks/use-regenerate-shot";
import { useVideoJob } from "@/features/video/hooks/use-video-job";
import { useUpdateAssetMetadata } from "@/features/audio/hooks/use-update-asset-metadata";
import { queryKeys } from "@/shared/lib/query-keys";
import type { SessionDraft } from "../types/chat.types";
import type { ReelAsset } from "@/features/audio/types/audio.types";

interface DraftDetailProps {
  draft: SessionDraft;
  isActive: boolean;
  onBack: () => void;
  onOpenAudio: () => void;
  onSetActive: (id: number) => void;
}

type ShotClip = ReelAsset & {
  shotIndex: number;
  hasEmbeddedAudio: boolean;
  useClipAudio: boolean;
  sourceType: string;
  generationPrompt: string;
};

function toShotClip(asset: ReelAsset): ShotClip | null {
  if (asset.type !== "video_clip") return null;
  const metadata = (asset.metadata ?? {}) as Record<string, unknown>;
  const rawShot = metadata.shotIndex;
  const shotIndex =
    typeof rawShot === "number" ? rawShot : Number(rawShot ?? -1);
  if (!Number.isFinite(shotIndex) || shotIndex < 0) return null;
  return {
    ...asset,
    shotIndex,
    hasEmbeddedAudio: Boolean(metadata.hasEmbeddedAudio),
    useClipAudio: Boolean(metadata.useClipAudio),
    sourceType:
      typeof metadata.sourceType === "string" ? metadata.sourceType : "unknown",
    generationPrompt:
      typeof metadata.generationPrompt === "string"
        ? metadata.generationPrompt
        : "",
  };
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
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
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
  onSetActive,
}: DraftDetailProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const sendToQueue = useSendToQueue();
  const generateReel = useGenerateReel();
  const assembleReel = useAssembleReel();
  const retryVideoJob = useRetryVideoJob();
  const uploadShotAsset = useUploadShotAsset();
  const regenerateShot = useRegenerateShot();
  const updateAssetMetadata = useUpdateAssetMetadata(draft.id);
  const [sent, setSent] = useState(false);
  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [storyboardDirty, setStoryboardDirty] = useState(false);
  const { data: assetsData } = useContentAssets(draft.id);
  const { data: videoJobData } = useVideoJob(videoJobId);
  const hasAudio =
    assetsData?.assets.some(
      (a) => a.type === "voiceover" || a.type === "music"
    ) ?? false;
  const assembledAsset =
    assetsData?.assets.find((a) => a.type === "assembled_video") ?? null;
  const shotClips: ShotClip[] =
    assetsData?.assets
      .map(toShotClip)
      .filter((asset): asset is ShotClip => !!asset)
      .sort((a, b) => a.shotIndex - b.shotIndex) ?? [];
  const videoStatus = videoJobData?.job.status ?? null;
  const videoRunning = videoStatus === "queued" || videoStatus === "running";
  const videoFailed = videoStatus === "failed";
  const hasVideoOutput =
    !!assembledAsset || !!videoJobData?.job.result?.videoUrl;
  const previewVideoUrl =
    assembledAsset?.mediaUrl ?? videoJobData?.job.result?.videoUrl ?? null;

  useEffect(() => {
    if (videoStatus === "completed") {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.contentAssets(draft.id),
      });
    }
  }, [videoStatus, queryClient, draft.id]);

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

  const handleGenerateReel = async () => {
    try {
      const res = await generateReel.mutateAsync({
        generatedContentId: draft.id,
      });
      setVideoJobId(res.jobId);
    } catch {
      // silently handled
    }
  };

  const handleRetryVideo = async () => {
    if (!videoJobId) return;
    try {
      const res = await retryVideoJob.mutateAsync(videoJobId);
      setVideoJobId(res.jobId);
    } catch {
      // silently handled
    }
  };

  const handleReassemble = async () => {
    try {
      const res = await assembleReel.mutateAsync({
        generatedContentId: draft.id,
        includeCaptions: true,
      });
      setVideoJobId(res.jobId);
      setStoryboardDirty(false);
    } catch {
      // silently handled
    }
  };

  const handleSetUseClipAudio = async (
    asset: ShotClip,
    useClipAudio: boolean
  ) => {
    try {
      await updateAssetMetadata.mutateAsync({
        assetId: asset.id,
        metadata: {
          ...(asset.metadata ?? {}),
          useClipAudio,
        },
      });
      setStoryboardDirty(true);
    } catch {
      // silently handled
    }
  };

  const handleReplaceShot = async (shotIndex: number, file: File | null) => {
    if (!file) return;
    try {
      await uploadShotAsset.mutateAsync({
        generatedContentId: draft.id,
        shotIndex,
        file,
      });
      setStoryboardDirty(true);
    } catch {
      // silently handled
    }
  };

  const handleRegenerateShot = async (clip: ShotClip) => {
    const defaultPrompt =
      clip.generationPrompt ||
      draft.generatedHook ||
      draft.generatedScript ||
      "";
    const prompt = window.prompt(
      t("workspace_storyboard_regenerate_prompt"),
      defaultPrompt
    );
    if (!prompt || !prompt.trim()) return;

    try {
      const res = await regenerateShot.mutateAsync({
        generatedContentId: draft.id,
        shotIndex: clip.shotIndex,
        prompt: prompt.trim(),
      });
      setVideoJobId(res.jobId);
      setStoryboardDirty(false);
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
            <p className="text-xs text-foreground/80 italic">
              "{metadata.cta}"
            </p>
          </Section>
        )}

        {metadata?.changeDescription && (
          <Section label={t("workspace_section_changes")}>
            <p className="text-xs text-muted-foreground italic">
              {metadata.changeDescription}
            </p>
          </Section>
        )}

        <Section label={t("workspace_section_video")}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {videoRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t("workspace_video_generating")}</span>
              </>
            ) : videoFailed ? (
              <span className="text-red-500">
                {t("workspace_video_failed")}
              </span>
            ) : hasVideoOutput ? (
              <span>{t("workspace_video_ready")}</span>
            ) : (
              <span>{t("workspace_video_not_generated")}</span>
            )}
          </div>
          {videoFailed && (
            <div className="mt-2 flex items-center justify-between rounded-md border border-red-300/50 bg-red-500/5 px-2.5 py-2 text-[11px]">
              <span className="text-red-600 dark:text-red-300">
                {videoJobData?.job.error || t("workspace_video_failed_details")}
              </span>
              <button
                onClick={() => void handleRetryVideo()}
                disabled={retryVideoJob.isPending || !videoJobId}
                className="ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed dark:text-red-300"
              >
                {retryVideoJob.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                {retryVideoJob.isPending
                  ? t("workspace_video_retrying")
                  : t("workspace_video_retry")}
              </button>
            </div>
          )}
          {!videoRunning && hasVideoOutput && (
            <button
              onClick={() => void handleReassemble()}
              disabled={assembleReel.isPending}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1.5 text-[11px] text-foreground/80 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assembleReel.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <WandSparkles className="h-3.5 w-3.5" />
              )}
              {assembleReel.isPending
                ? t("workspace_video_reassembling")
                : t("workspace_video_reassemble")}
            </button>
          )}
          {previewVideoUrl && (
            <>
              <video
                className="w-full mt-2 rounded-lg border border-border/60"
                controls
                preload="metadata"
                src={previewVideoUrl}
              />
              <a
                href={previewVideoUrl}
                download
                className="mt-2 inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[11px] hover:bg-muted"
              >
                {t("workspace_video_download")}
              </a>
            </>
          )}
        </Section>

        {shotClips.length > 0 && (
          <Section label={t("workspace_section_storyboard")}>
            <div className="space-y-2">
              {shotClips.map((clip) => (
                <div
                  key={clip.id}
                  className="rounded-lg border border-border/60 bg-muted/20 p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium">
                      {t("workspace_storyboard_shot", {
                        index: clip.shotIndex + 1,
                      })}
                    </div>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {clip.sourceType}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t("workspace_storyboard_duration", {
                      seconds: Math.max(
                        1,
                        Math.round((clip.durationMs ?? 0) / 1000)
                      ),
                    })}
                  </div>
                  {clip.mediaUrl && (
                    <video
                      className="mt-2 w-full rounded border border-border/50"
                      controls
                      preload="metadata"
                      src={clip.mediaUrl}
                    />
                  )}
                  {clip.hasEmbeddedAudio && (
                    <div className="mt-2 flex items-center justify-between rounded border border-border/50 px-2 py-1.5">
                      <span className="text-[11px] text-foreground/80">
                        {t("workspace_storyboard_clip_audio")}
                      </span>
                      <button
                        onClick={() =>
                          void handleSetUseClipAudio(clip, !clip.useClipAudio)
                        }
                        disabled={updateAssetMetadata.isPending}
                        className="rounded border border-border/60 px-2 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {clip.useClipAudio
                          ? t("phase4.storyboard.clipAudio.use")
                          : t("phase4.storyboard.clipAudio.voiceoverOnly")}
                      </button>
                    </div>
                  )}
                  <div className="mt-2">
                    <button
                      onClick={() => void handleRegenerateShot(clip)}
                      disabled={regenerateShot.isPending || videoRunning}
                      className="mr-1 inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {regenerateShot.isPending
                        ? t("workspace_storyboard_regenerating")
                        : t("workspace_storyboard_regenerate")}
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border/60 px-2 py-1 text-[11px] hover:bg-muted">
                      <Film className="h-3 w-3" />
                      {uploadShotAsset.isPending
                        ? t("workspace_storyboard_uploading")
                        : t("workspace_storyboard_replace")}
                      <input
                        className="hidden"
                        type="file"
                        accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          void handleReplaceShot(clip.shotIndex, file);
                          event.currentTarget.value = "";
                        }}
                        disabled={uploadShotAsset.isPending}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            {storyboardDirty && (
              <button
                onClick={() => void handleReassemble()}
                disabled={assembleReel.isPending || videoRunning}
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-300/50 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 hover:bg-amber-500/15 disabled:opacity-50 disabled:cursor-not-allowed dark:text-amber-300"
              >
                {assembleReel.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <WandSparkles className="h-3.5 w-3.5" />
                )}
                {assembleReel.isPending
                  ? t("workspace_video_reassembling")
                  : t("workspace_storyboard_apply_changes")}
              </button>
            )}
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
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              {t("workspace_queued")}
            </>
          ) : sendToQueue.isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t("workspace_queuing")}
            </>
          ) : (
            <>
              <ListPlus className="w-3.5 h-3.5" />
              {t("workspace_send_to_queue")}
            </>
          )}
        </button>
        <button
          onClick={onOpenAudio}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border border-primary/30 bg-primary/[0.06] text-primary hover:bg-primary/[0.10] transition-colors"
        >
          <Mic className="w-3.5 h-3.5" />
          {hasAudio ? t("workspace_edit_audio") : t("workspace_add_audio")}
        </button>
        <a
          href={`/studio/generate/${draft.id}/reel/edit`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border border-border/60 bg-muted/30 text-foreground/80 hover:bg-muted transition-colors"
        >
          {t("phase5_editor_open")}
        </a>
        <button
          onClick={() => void handleGenerateReel()}
          disabled={generateReel.isPending || videoRunning}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generateReel.isPending || videoRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t("workspace_generate_reel_pending")}
            </>
          ) : (
            <>
              <Film className="w-3.5 h-3.5" />
              {t("workspace_generate_reel")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
