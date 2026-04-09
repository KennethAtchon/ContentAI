import { generateVideoClip, type VideoProvider } from "./video.service";
import {
  videoJobService,
  type VideoJobKind,
  type VideoRenderJob,
} from "../../services/video-generation/job.service";
import { debugLog } from "../../utils/debug/debug";
import { DEV_MOCK_EXTERNAL_INTEGRATIONS } from "../../utils/config/envUtil";
import { contentService, editorRepository } from "../singletons";
import {
  buildMockDevReelShots,
  durationSecondsToMs,
  parseScriptShots,
  type ShotInput,
} from "./reel-shot-helpers";
import { fetchOwnedContent, updatePhase4Metadata } from "./phase4-metadata";

export async function runReelGeneration(input: {
  job: VideoRenderJob;
  prompt?: string;
  durationSeconds?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  provider?: VideoProvider;
}): Promise<void> {
  const { job } = input;
  await videoJobService.updateJob(job.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
  });

  try {
    const content = await fetchOwnedContent(job.userId, job.generatedContentId);
    if (!content) {
      throw new Error("Content not found");
    }

    const fallbackPrompt =
      input.prompt?.trim() ||
      content.generatedHook?.trim() ||
      content.prompt?.trim();
    if (!fallbackPrompt) {
      throw new Error("No prompt available for video generation");
    }

    const shots: ShotInput[] = DEV_MOCK_EXTERNAL_INTEGRATIONS
      ? buildMockDevReelShots(fallbackPrompt, input.durationSeconds)
      : (() => {
          try {
            const shotsFromScript = parseScriptShots(content.generatedScript);
            return shotsFromScript.length > 0
              ? shotsFromScript
              : [
                  {
                    shotIndex: 0,
                    description: fallbackPrompt,
                    durationSeconds: input.durationSeconds ?? 5,
                  },
                ];
          } catch {
            return [
              {
                shotIndex: 0,
                description: fallbackPrompt,
                durationSeconds: input.durationSeconds ?? 5,
              },
            ];
          }
        })();

    const sceneDescription = content.sceneDescription ?? undefined;

    debugLog.info("[runReelGeneration] Starting clip generation", {
      service: "video-domain",
      operation: "runReelGeneration",
      generatedContentId: job.generatedContentId,
      shotCount: shots.length,
      hasSceneDescription: !!sceneDescription,
      sceneDescription,
      shots: shots.map((s) => ({
        shotIndex: s.shotIndex,
        durationSeconds: s.durationSeconds,
        description: s.description,
      })),
    });

    await videoJobService.updateJob(job.id, {
      progress: {
        phase: "decode",
        percent: 0,
        shotsCompleted: 0,
        totalShots: shots.length,
      },
    });

    const createdShots: Array<{
      shotIndex: number;
      description: string;
      durationMs: number;
      assetId: string;
      useClipAudio: boolean;
    }> = [];

    for (const shot of shots) {
      const videoPrompt = sceneDescription
        ? `${sceneDescription}. ${shot.description}`
        : shot.description;

      await editorRepository
        .refreshEditorTimeline(job.generatedContentId, job.userId, {
          placeholderStatus: "generating",
          shotIndex: shot.shotIndex,
        })
        .catch((err) =>
          debugLog.warn("refreshEditorTimeline (pre-generate) failed", {
            err,
            contentId: job.generatedContentId,
            shotIndex: shot.shotIndex,
          }),
        );

      debugLog.info("[runReelGeneration] Sending prompt to video provider", {
        service: "video-domain",
        operation: "runReelGeneration",
        shotIndex: shot.shotIndex,
        prompt: videoPrompt,
      });

      let clip: Awaited<ReturnType<typeof generateVideoClip>>;
      try {
        clip = await generateVideoClip({
          prompt: videoPrompt,
          durationSeconds: shot.durationSeconds,
          aspectRatio: input.aspectRatio,
          userId: job.userId,
          providerOverride: input.provider,
          metadata: {
            generatedContentId: job.generatedContentId,
            shotIndex: shot.shotIndex,
          },
        });
      } catch (shotErr) {
        const msg =
          shotErr instanceof Error ? shotErr.message : "Unknown shot error";
        debugLog.error("Shot generation failed", {
          service: "video-domain",
          operation: "runReelGeneration",
          jobId: job.id,
          shotIndex: shot.shotIndex,
          error: msg,
        });
        await editorRepository
          .refreshEditorTimeline(job.generatedContentId, job.userId, {
            placeholderStatus: "failed",
            shotIndex: shot.shotIndex,
          })
          .catch((err) =>
            debugLog.warn("refreshEditorTimeline (on-failure) failed", {
              err,
              contentId: job.generatedContentId,
              shotIndex: shot.shotIndex,
            }),
          );
        continue;
      }

      const clipAsset = await contentService.insertGeneratedVideoClipAndLink({
        userId: job.userId,
        generatedContentId: job.generatedContentId,
        r2Key: clip.r2Key,
        r2Url: clip.r2Url,
        durationMs: durationSecondsToMs(clip.durationSeconds),
        shotIndex: shot.shotIndex,
        provider: clip.provider,
        generationPrompt: shot.description,
      });

      createdShots.push({
        shotIndex: shot.shotIndex,
        description: shot.description,
        durationMs: durationSecondsToMs(clip.durationSeconds),
        assetId: clipAsset.id,
        useClipAudio: false,
      });

      await editorRepository
        .refreshEditorTimeline(job.generatedContentId, job.userId)
        .catch((err) =>
          debugLog.warn("refreshEditorTimeline (post-generate) failed", {
            err,
            contentId: job.generatedContentId,
            shotIndex: shot.shotIndex,
          }),
        );

      await videoJobService.updateJob(job.id, {
        progress: {
          phase: "decode",
          percent: Math.round((createdShots.length / shots.length) * 100),
          shotsCompleted: createdShots.length,
          totalShots: shots.length,
        },
      });
    }

    if (createdShots.length === 0) {
      throw new Error("All shots failed to generate");
    }

    await updatePhase4Metadata({
      generatedContentId: job.generatedContentId,
      existingGeneratedMetadata: content.generatedMetadata,
      jobId: job.id,
      status: "completed",
      shots: createdShots,
      provider: input.provider,
    });

    await videoJobService.updateJob(job.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      result: {
        shotCount: createdShots.length,
      },
      error: undefined,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    const current = await videoJobService.getJob(job.id);
    if (
      current &&
      current.status !== "failed" &&
      current.status !== "completed"
    ) {
      await videoJobService.updateJob(job.id, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: errorMessage,
      });
    }

    debugLog.error("Video reel job failed", {
      service: "video-domain",
      operation: "runReelGeneration",
      jobId: job.id,
      generatedContentId: job.generatedContentId,
      error: errorMessage,
    });
  }
}

export async function runShotRegenerate(input: {
  job: VideoRenderJob;
  shotIndex: number;
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  provider?: VideoProvider;
}): Promise<void> {
  const { job } = input;
  await videoJobService.updateJob(job.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
  });

  try {
    const clip = await generateVideoClip({
      prompt: input.prompt,
      durationSeconds: input.durationSeconds ?? 5,
      aspectRatio: input.aspectRatio,
      userId: job.userId,
      providerOverride: input.provider,
      metadata: {
        generatedContentId: job.generatedContentId,
        shotIndex: input.shotIndex,
      },
    });

    const { assetId: clipAssetId } =
      await contentService.replaceGeneratedVideoClipForShot({
        userId: job.userId,
        generatedContentId: job.generatedContentId,
        shotIndex: input.shotIndex,
        newClip: {
          r2Key: clip.r2Key,
          r2Url: clip.r2Url,
          durationMs: durationSecondsToMs(clip.durationSeconds),
          provider: clip.provider,
          generationPrompt: input.prompt,
        },
      });

    await editorRepository
      .refreshEditorTimeline(job.generatedContentId, job.userId)
      .catch((err) =>
        debugLog.warn("refreshEditorTimeline (shot-regenerate) failed", {
          err,
          contentId: job.generatedContentId,
        }),
      );

    await videoJobService.updateJob(job.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      result: {
        clipAssetId: clipAssetId,
        provider: clip.provider,
        durationSeconds: clip.durationSeconds,
      },
      error: undefined,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await videoJobService.updateJob(job.id, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: errorMessage,
    });

    debugLog.error("Shot regenerate failed", {
      service: "video-domain",
      operation: "runShotRegenerate",
      jobId: job.id,
      generatedContentId: job.generatedContentId,
      error: errorMessage,
    });
  }
}

export function enqueue(kind: VideoJobKind, fn: () => Promise<void>): void {
  setTimeout(() => void fn(), 0);
  debugLog.info("Video job enqueued", {
    service: "video-domain",
    operation: "enqueue",
    kind,
  });
}

export function getRetryRunner(
  job: VideoRenderJob,
  retryJob: VideoRenderJob,
): () => Promise<void> {
  const req = (job.request ?? {}) as Record<string, unknown>;
  const opts = {
    durationSeconds: req.durationSeconds
      ? Number(req.durationSeconds)
      : undefined,
    aspectRatio: req.aspectRatio as "9:16" | "16:9" | "1:1" | undefined,
    provider: req.provider as VideoProvider | undefined,
  };
  switch (job.kind) {
    case "assemble":
      return async () => {
        await videoJobService.updateJob(retryJob.id, {
          status: "failed",
          completedAt: new Date().toISOString(),
          error:
            "Video assembly was removed — open the editor and export your timeline instead.",
        });
      };
    case "shot_regenerate":
      return () =>
        runShotRegenerate({
          job: retryJob,
          shotIndex: Number(req.shotIndex ?? 0),
          prompt: String(req.prompt ?? ""),
          ...opts,
        });
    default:
      return () =>
        runReelGeneration({
          job: retryJob,
          prompt: String(req.prompt ?? ""),
          ...opts,
        });
  }
}
