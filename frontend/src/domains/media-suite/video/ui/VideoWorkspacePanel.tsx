import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Film, Loader2, RotateCcw, RefreshCw } from "lucide-react";
import { useContentAssets } from "@/domains/audio/hooks/use-content-assets";
import { useUpdateAssetMetadata } from "@/domains/audio/hooks/use-update-asset-metadata";
import { useGenerateReel } from "@/domains/video/hooks/use-generate-reel";
import { useRetryVideoJob } from "@/domains/video/hooks/use-retry-video-job";
import { useRegenerateShot } from "@/domains/video/hooks/use-regenerate-shot";
import { useUploadShotAsset } from "@/domains/video/hooks/use-upload-shot-asset";
import { toast } from "sonner";
import type { ReelAsset } from "@/domains/audio/model/audio.types";
import type { SessionDraft } from "@/domains/chat/model/chat.types";
import type { VideoJobResponse } from "@/domains/video/model/video.types";
import { REDIRECT_PATHS } from "@/shared/navigation/redirect-util";

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

export function VideoWorkspacePanel({
  draft,
  onBackToDrafts,
  videoJobId,
  onJobStarted,
  videoJobData,
}: {
  draft: SessionDraft;
  onBackToDrafts: () => void;
  videoJobId: string | null;
  onJobStarted: (jobId: string, contentId: number) => void;
  videoJobData: VideoJobResponse | undefined;
}) {
  const { t } = useTranslation();
  const generateReel = useGenerateReel();
  const retryVideoJob = useRetryVideoJob();
  const regenerateShot = useRegenerateShot();
  const uploadShotAsset = useUploadShotAsset();
  const updateAssetMetadata = useUpdateAssetMetadata(draft.id);

  const [showFailureModal, setShowFailureModal] = useState(false);
  const [pendingRegenerateShotIndex, setPendingRegenerateShotIndex] = useState<
    number | null
  >(null);
  const [pendingUploadShotIndex, setPendingUploadShotIndex] = useState<
    number | null
  >(null);
  const storyboardSectionRef = useRef<HTMLElement>(null);
  const jobTargetsThisDraft =
    videoJobData != null && videoJobData.job.generatedContentId === draft.id;
  const rawVideoStatus = videoJobData?.job.status ?? null;
  const isJobActive =
    jobTargetsThisDraft &&
    (rawVideoStatus === "queued" || rawVideoStatus === "running");
  const { data: assetsData } = useContentAssets(
    draft.id,
    undefined,
    isJobActive ? 4000 : false
  );

  const shotClips: ShotClip[] =
    assetsData?.assets
      .map(toShotClip)
      .filter((asset): asset is ShotClip => !!asset)
      .sort((a, b) => a.shotIndex - b.shotIndex) ?? [];

  const videoStatus =
    jobTargetsThisDraft && rawVideoStatus ? rawVideoStatus : null;
  const videoRunning = videoStatus === "queued" || videoStatus === "running";
  const videoFailed = videoStatus === "failed";
  const jobCompleted = jobTargetsThisDraft && rawVideoStatus === "completed";
  const mutatingStoryboard =
    regenerateShot.isPending ||
    uploadShotAsset.isPending ||
    updateAssetMetadata.isPending ||
    videoRunning;

  useEffect(() => {
    if (videoStatus === "failed") {
      setShowFailureModal(true);
    } else if (videoStatus === "running" || videoStatus === "queued") {
      setShowFailureModal(false);
    }
  }, [videoStatus]);

  const handleGenerateClips = async () => {
    try {
      const res = await generateReel.mutateAsync({
        generatedContentId: draft.id,
      });
      onJobStarted(res.jobId, draft.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(
        msg.includes("Another video task")
          ? t("workspace_video_job_in_progress")
          : t("workspace_video_action_generate_failed")
      );
    }
  };

  const handleRetryVideo = async () => {
    if (!videoJobId) return;
    try {
      const res = await retryVideoJob.mutateAsync(videoJobId);
      onJobStarted(res.jobId, draft.id);
      setShowFailureModal(false);
    } catch {
      toast.error(t("workspace_video_action_retry_failed"));
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
      toast.success(
        useClipAudio
          ? t("workspace_video_action_clip_audio_enabled")
          : t("workspace_video_action_clip_audio_disabled")
      );
    } catch {
      toast.error(t("workspace_video_action_clip_audio_failed"));
    }
  };

  const handleReplaceShot = async (shotIndex: number, file: File | null) => {
    if (!file) return;
    setPendingUploadShotIndex(shotIndex);
    try {
      await uploadShotAsset.mutateAsync({
        generatedContentId: draft.id,
        shotIndex,
        file,
      });
      toast.success(t("workspace_video_action_upload_success"));
    } catch {
      toast.error(t("workspace_video_action_upload_failed"));
    } finally {
      setPendingUploadShotIndex(null);
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

    setPendingRegenerateShotIndex(clip.shotIndex);
    try {
      const res = await regenerateShot.mutateAsync({
        generatedContentId: draft.id,
        shotIndex: clip.shotIndex,
        prompt: prompt.trim(),
      });
      onJobStarted(res.jobId, draft.id);
    } catch {
      toast.error(t("workspace_video_action_regenerate_failed"));
    } finally {
      setPendingRegenerateShotIndex(null);
    }
  };

  const editorSearch = { projectId: undefined, contentId: draft.id } as const;

  return (
    <div className="relative flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <section
        ref={storyboardSectionRef}
        className="rounded-lg border border-border/60 p-3"
      >
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t("workspace_video_region_generate")}
        </p>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          {videoRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{t("workspace_video_generating")}</span>
            </>
          ) : videoFailed ? (
            <span className="text-error">{t("workspace_video_failed")}</span>
          ) : shotClips.length > 0 || jobCompleted ? (
            <span>{t("video_workspace_clips_ready")}</span>
          ) : (
            <span>{t("workspace_video_not_generated")}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            onClick={() => void handleGenerateClips()}
            disabled={generateReel.isPending || videoRunning}
            className="inline-flex items-center gap-1.5 rounded-md border border-success/50 bg-success/10 px-2.5 py-1.5 text-sm text-success hover:bg-success/15 disabled:opacity-50 disabled:cursor-not-allowed dark:text-success"
          >
            {generateReel.isPending || videoRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Film className="h-3.5 w-3.5" />
            )}
            {generateReel.isPending || videoRunning
              ? t("workspace_generate_reel_pending")
              : t("workspace_generate_reel")}
          </button>
          {(shotClips.length > 0 || jobCompleted) && (
            <Link
              to={REDIRECT_PATHS.STUDIO_EDITOR}
              search={editorSearch}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-sm text-foreground/80 hover:bg-muted"
            >
              {t("video_workspace_open_editor")}
            </Link>
          )}
          {videoFailed && (
            <button
              onClick={() => void handleRetryVideo()}
              disabled={retryVideoJob.isPending || !videoJobId}
              className="inline-flex items-center gap-1 rounded-md border border-error/50 bg-error/5 px-2.5 py-1.5 text-sm text-error hover:bg-error/10 disabled:opacity-50 disabled:cursor-not-allowed dark:text-error"
            >
              {retryVideoJob.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {retryVideoJob.isPending
                ? t("workspace_video_retrying")
                : t("workspace_video_retry")}
            </button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border/60 p-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t("workspace_video_region_storyboard")}
        </p>
        <div className="mt-2 space-y-2">
          {shotClips.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("workspace_storyboard_empty")}
            </p>
          ) : (
            shotClips.map((clip) => (
              <div
                key={clip.id}
                className="rounded-md border border-border/50 bg-muted/20 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {t("workspace_storyboard_shot", {
                      index: clip.shotIndex + 1,
                    })}
                  </div>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-sm text-muted-foreground">
                    {clip.sourceType}
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
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
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => void handleRegenerateShot(clip)}
                    disabled={mutatingStoryboard}
                    className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {regenerateShot.isPending &&
                    pendingRegenerateShotIndex === clip.shotIndex ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    {regenerateShot.isPending &&
                    pendingRegenerateShotIndex === clip.shotIndex
                      ? t("workspace_storyboard_regenerating")
                      : t("workspace_storyboard_regenerate")}
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-border/60 px-2 py-1 text-sm hover:bg-muted">
                    <Film className="h-3 w-3" />
                    {uploadShotAsset.isPending &&
                    pendingUploadShotIndex === clip.shotIndex
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
                      disabled={mutatingStoryboard}
                    />
                  </label>
                </div>
                {clip.hasEmbeddedAudio && (
                  <div className="mt-2 flex items-center justify-between rounded border border-border/50 px-2 py-1.5">
                    <span className="text-sm text-foreground/80">
                      {t("workspace_storyboard_clip_audio")}
                    </span>
                    <button
                      onClick={() =>
                        void handleSetUseClipAudio(clip, !clip.useClipAudio)
                      }
                      disabled={mutatingStoryboard}
                      className="rounded border border-border/60 px-2 py-0.5 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {clip.useClipAudio
                        ? t("workspace_storyboard_clip_audio_use")
                        : t("workspace_storyboard_clip_audio_voiceover_only")}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border/60 p-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t("workspace_video_region_preview")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("video_workspace_clips_ready")}
        </p>
        <Link
          to={REDIRECT_PATHS.STUDIO_EDITOR}
          search={editorSearch}
          className="mt-2 inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-sm hover:bg-muted"
        >
          {t("video_workspace_open_editor")}
        </Link>
      </section>

      {showFailureModal && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-[320px] rounded-lg border border-error/50 bg-background p-4 shadow-lg">
            <h3 className="text-base font-semibold text-error dark:text-error">
              {t("workspace_video_failed")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {videoJobData?.job.error || t("workspace_video_failed_details")}
            </p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={onBackToDrafts}
                className="rounded border border-border/60 px-2.5 py-1.5 text-sm hover:bg-muted"
              >
                {t("workspace_video_back_to_drafts")}
              </button>
              <button
                onClick={() => void handleRetryVideo()}
                disabled={retryVideoJob.isPending || !videoJobId}
                className="inline-flex items-center gap-1 rounded border border-error/50 bg-error/5 px-2.5 py-1.5 text-sm text-error hover:bg-error/10 disabled:opacity-50 disabled:cursor-not-allowed dark:text-error"
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
          </div>
        </div>
      )}
    </div>
  );
}
