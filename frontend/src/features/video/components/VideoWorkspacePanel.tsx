import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Film,
  Loader2,
  RotateCcw,
  WandSparkles,
  RefreshCw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useContentAssets } from "@/features/audio/hooks/use-content-assets";
import { useUpdateAssetMetadata } from "@/features/audio/hooks/use-update-asset-metadata";
import { useGenerateReel } from "@/features/video/hooks/use-generate-reel";
import { useVideoJob } from "@/features/video/hooks/use-video-job";
import { useRetryVideoJob } from "@/features/video/hooks/use-retry-video-job";
import { useAssembleReel } from "@/features/video/hooks/use-assemble-reel";
import { useRegenerateShot } from "@/features/video/hooks/use-regenerate-shot";
import { useUploadShotAsset } from "@/features/video/hooks/use-upload-shot-asset";
import { queryKeys } from "@/shared/lib/query-keys";
import type { ReelAsset } from "@/features/audio/types/audio.types";
import type { SessionDraft } from "@/features/chat/types/chat.types";

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
  const shotIndex = typeof rawShot === "number" ? rawShot : Number(rawShot ?? -1);
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

export function VideoWorkspacePanel({ draft }: { draft: SessionDraft }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const generateReel = useGenerateReel();
  const retryVideoJob = useRetryVideoJob();
  const assembleReel = useAssembleReel();
  const regenerateShot = useRegenerateShot();
  const uploadShotAsset = useUploadShotAsset();
  const updateAssetMetadata = useUpdateAssetMetadata(draft.id);

  const [videoJobId, setVideoJobId] = useState<string | null>(null);
  const [storyboardDirty, setStoryboardDirty] = useState(false);
  const { data: assetsData } = useContentAssets(draft.id);
  const { data: videoJobData } = useVideoJob(videoJobId);

  const assembledAsset =
    assetsData?.assets.find((asset) => asset.type === "assembled_video") ?? null;
  const shotClips: ShotClip[] =
    assetsData?.assets
      .map(toShotClip)
      .filter((asset): asset is ShotClip => !!asset)
      .sort((a, b) => a.shotIndex - b.shotIndex) ?? [];

  const videoStatus = videoJobData?.job.status ?? null;
  const videoRunning = videoStatus === "queued" || videoStatus === "running";
  const videoFailed = videoStatus === "failed";
  const hasVideoOutput = !!assembledAsset || !!videoJobData?.job.result?.videoUrl;
  const previewVideoUrl =
    assembledAsset?.mediaUrl ?? videoJobData?.job.result?.videoUrl ?? null;

  useEffect(() => {
    if (videoStatus === "completed") {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.api.contentAssets(draft.id),
      });
    }
  }, [videoStatus, queryClient, draft.id]);

  const handleGenerateReel = async () => {
    try {
      const res = await generateReel.mutateAsync({
        generatedContentId: draft.id,
      });
      setVideoJobId(res.jobId);
      setStoryboardDirty(false);
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
      const res = await assembleReel.mutateAsync(draft.id);
      setVideoJobId(res.jobId);
      setStoryboardDirty(false);
    } catch {
      // silently handled
    }
  };

  const handleSetUseClipAudio = async (asset: ShotClip, useClipAudio: boolean) => {
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
      clip.generationPrompt || draft.generatedHook || draft.generatedScript || "";
    const prompt = window.prompt(
      t("workspace_storyboard_regenerate_prompt"),
      defaultPrompt,
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
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <section className="rounded-lg border border-border/60 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t("workspace_video_region_generate")}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {videoRunning ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{t("workspace_video_generating")}</span>
            </>
          ) : videoFailed ? (
            <span className="text-red-500">{t("workspace_video_failed")}</span>
          ) : hasVideoOutput ? (
            <span>{t("workspace_video_ready")}</span>
          ) : (
            <span>{t("workspace_video_not_generated")}</span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => void handleGenerateReel()}
            disabled={generateReel.isPending || videoRunning}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/50 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-700 hover:bg-emerald-500/15 disabled:opacity-50 disabled:cursor-not-allowed dark:text-emerald-300"
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
          {videoFailed && (
            <button
              onClick={() => void handleRetryVideo()}
              disabled={retryVideoJob.isPending || !videoJobId}
              className="inline-flex items-center gap-1 rounded-md border border-red-300/50 bg-red-500/5 px-2.5 py-1.5 text-[11px] text-red-700 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed dark:text-red-300"
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t("workspace_video_region_storyboard")}
        </p>
        <div className="mt-2 space-y-2">
          {shotClips.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("workspace_storyboard_empty")}
            </p>
          ) : (
            shotClips.map((clip) => (
              <div
                key={clip.id}
                className="rounded-md border border-border/50 bg-muted/20 p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-medium">
                    {t("workspace_storyboard_shot", { index: clip.shotIndex + 1 })}
                  </div>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {clip.sourceType}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {t("workspace_storyboard_duration", {
                    seconds: Math.max(1, Math.round((clip.durationMs ?? 0) / 1000)),
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
                    disabled={regenerateShot.isPending || videoRunning}
                    className="inline-flex items-center gap-1 rounded border border-border/60 px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {regenerateShot.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
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
              </div>
            ))
          )}
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
      </section>

      <section className="rounded-lg border border-border/60 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {t("workspace_video_region_preview")}
        </p>
        {previewVideoUrl ? (
          <>
            <video
              className="mt-2 w-full rounded-lg border border-border/60"
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
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("workspace_video_preview_empty")}
          </p>
        )}
      </section>
    </div>
  );
}
