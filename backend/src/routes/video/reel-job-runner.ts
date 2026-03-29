import { and, eq, inArray } from "drizzle-orm";
import { assets, contentAssets } from "../../infrastructure/database/drizzle/schema";
import { db } from "../../services/db/db";
import { generateVideoClip } from "../../services/video-generation";
import type { VideoProvider } from "../../services/video-generation";
import {
  videoJobService,
  type VideoJobKind,
  type VideoRenderJob,
} from "../../services/video/job.service";
import { debugLog } from "../../utils/debug/debug";
import { DEV_MOCK_EXTERNAL_INTEGRATIONS } from "../../utils/config/envUtil";
import { refreshEditorTimeline } from "../editor/services/refresh-editor-timeline";
import {
  buildMockDevReelShots,
  durationSecondsToMs,
  parseScriptShots,
  type ShotInput,
} from "./utils";
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
      service: "video-route",
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

      await refreshEditorTimeline(job.generatedContentId, job.userId, {
        placeholderStatus: "generating",
        shotIndex: shot.shotIndex,
      }).catch((err) =>
        debugLog.warn("refreshEditorTimeline (pre-generate) failed", {
          err,
          contentId: job.generatedContentId,
          shotIndex: shot.shotIndex,
        }),
      );

      debugLog.info("[runReelGeneration] Sending prompt to video provider", {
        service: "video-route",
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
          service: "video-route",
          operation: "runReelGeneration",
          jobId: job.id,
          shotIndex: shot.shotIndex,
          error: msg,
        });
        await refreshEditorTimeline(job.generatedContentId, job.userId, {
          placeholderStatus: "failed",
          shotIndex: shot.shotIndex,
        }).catch((err) =>
          debugLog.warn("refreshEditorTimeline (on-failure) failed", {
            err,
            contentId: job.generatedContentId,
            shotIndex: shot.shotIndex,
          }),
        );
        continue;
      }

      const [clipAsset] = await db
        .insert(assets)
        .values({
          userId: job.userId,
          type: "video_clip",
          source: "generated",
          r2Key: clip.r2Key,
          r2Url: clip.r2Url,
          durationMs: durationSecondsToMs(clip.durationSeconds),
          metadata: {
            shotIndex: shot.shotIndex,
            sourceType: "ai_generated",
            provider: clip.provider,
            generationPrompt: shot.description,
            hasEmbeddedAudio: false,
            useClipAudio: false,
          },
        })
        .returning();

      await db.insert(contentAssets).values({
        generatedContentId: job.generatedContentId,
        assetId: clipAsset.id,
        role: "video_clip",
      });

      createdShots.push({
        shotIndex: shot.shotIndex,
        description: shot.description,
        durationMs: durationSecondsToMs(clip.durationSeconds),
        assetId: clipAsset.id,
        useClipAudio: false,
      });

      await refreshEditorTimeline(job.generatedContentId, job.userId).catch(
        (err) =>
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
      service: "video-route",
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

    const allExistingClips = await db
      .select({
        assetId: contentAssets.assetId,
        metadata: assets.metadata,
      })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .where(
        and(
          eq(contentAssets.generatedContentId, job.generatedContentId),
          eq(contentAssets.role, "video_clip"),
          eq(assets.userId, job.userId),
        ),
      );
    const staleIds = allExistingClips
      .filter(
        (a) =>
          Number((a.metadata as Record<string, unknown>)?.shotIndex ?? -1) ===
          input.shotIndex,
      )
      .map((a) => a.assetId);
    if (staleIds.length > 0) {
      await db
        .delete(contentAssets)
        .where(
          and(
            eq(contentAssets.generatedContentId, job.generatedContentId),
            inArray(contentAssets.assetId, staleIds),
          ),
        );
      for (const assetId of staleIds) {
        await db
          .delete(assets)
          .where(eq(assets.id, assetId))
          .catch(() => {});
      }
    }

    const [clipAsset] = await db
      .insert(assets)
      .values({
        userId: job.userId,
        type: "video_clip",
        source: "generated",
        r2Key: clip.r2Key,
        r2Url: clip.r2Url,
        durationMs: durationSecondsToMs(clip.durationSeconds),
        metadata: {
          shotIndex: input.shotIndex,
          sourceType: "ai_generated",
          provider: clip.provider,
          generationPrompt: input.prompt,
          hasEmbeddedAudio: false,
          useClipAudio: false,
        },
      })
      .returning();

    await db.insert(contentAssets).values({
      generatedContentId: job.generatedContentId,
      assetId: clipAsset.id,
      role: "video_clip",
    });

    await refreshEditorTimeline(job.generatedContentId, job.userId).catch(
      (err) =>
        debugLog.warn("refreshEditorTimeline (shot-regenerate) failed", {
          err,
          contentId: job.generatedContentId,
        }),
    );

    await videoJobService.updateJob(job.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      result: {
        clipAssetId: clipAsset.id,
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
      service: "video-route",
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
    service: "video-route",
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
