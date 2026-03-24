import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import { generatedContent, assets, contentAssets } from "../../infrastructure/database/drizzle/schema";
import { generateVideoClip } from "../../services/media/video-generation";
import type { VideoProvider } from "../../services/media/video-generation";
import { debugLog } from "../../utils/debug/debug";
import {
  videoJobService,
  type VideoRenderJob,
  type VideoJobKind,
} from "../../services/video/job.service";
import {
  buildMockDevReelShots,
  deriveUseClipAudioByIndex,
  extractCaptionSourceText,
  formatAssTime,
  parseScriptShots,
  type ShotInput,
} from "./utils";
import { DEV_MOCK_EXTERNAL_INTEGRATIONS } from "../../utils/config/envUtil";
import { refreshEditorTimeline } from "../editor/services/refresh-editor-timeline";

const app = new Hono<HonoEnv>();

const providerSchema = z.enum(["kling-fal", "runway", "image-ken-burns"]);
const aspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);

const createReelSchema = z.object({
  generatedContentId: z.number().int().positive(),
  prompt: z.string().min(1).max(1000).optional(),
  durationSeconds: z.number().int().min(3).max(10).optional(),
  aspectRatio: aspectRatioSchema.optional(),
  provider: providerSchema.optional(),
});

const regenerateShotSchema = z.object({
  generatedContentId: z.number().int().positive(),
  shotIndex: z.number().int().min(0).max(99),
  prompt: z.string().min(1).max(1000),
  durationSeconds: z.number().int().min(3).max(10).optional(),
  aspectRatio: aspectRatioSchema.optional(),
  provider: providerSchema.optional(),
});

const timelineItemSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1).optional(),
  lane: z.number().int().min(0).optional(),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(1),
  trimStartMs: z.number().int().min(0).optional(),
  trimEndMs: z.number().int().min(1).optional(),
  role: z.string().optional(),
  transitionIn: z
    .object({
      type: z.enum(["cut", "crossfade", "swipe", "fade"]),
      durationMs: z.number().int().min(0).max(2000),
    })
    .optional(),
  transitionOut: z
    .object({
      type: z.enum(["cut", "crossfade", "swipe", "fade"]),
      durationMs: z.number().int().min(0).max(2000),
    })
    .optional(),
});

const _timelineSchema = z.object({
  schemaVersion: z.number().int().default(1),
  fps: z.number().int().min(1).max(120).default(30),
  durationMs: z.number().int().min(1),
  tracks: z.object({
    video: z.array(timelineItemSchema).default([]),
    audio: z.array(timelineItemSchema).default([]),
    text: z.array(z.record(z.string(), z.unknown())).default([]),
    captions: z.array(z.record(z.string(), z.unknown())).default([]),
  }),
});

type TimelineIssue = {
  code: string;
  track: string;
  itemIds: string[];
  severity: "error" | "warning";
  message: string;
};

type TimelinePayload = z.infer<typeof _timelineSchema>;

const MIN_RECOMMENDED_CLIP_MS = 800;
const MAX_RECOMMENDED_CLIP_MS = 12_000;

function getAssetTypeForTrack(
  track: "video" | "audio",
  role?: string,
): string[] {
  if (track === "video") return ["video_clip"];
  if (role === "voiceover") return ["voiceover"];
  if (role === "music") return ["music"];
  return ["voiceover", "music"];
}

function hasTrackOverlap(
  items: Array<{ startMs: number; endMs: number }>,
): boolean {
  const sorted = [...items].sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].startMs < sorted[i - 1].endMs) return true;
  }
  return false;
}

function getItemSpanMs(item: {
  startMs: number;
  endMs: number;
  trimStartMs?: number;
  trimEndMs?: number;
}): number {
  const clipSpan = item.endMs - item.startMs;
  if (
    typeof item.trimStartMs === "number" &&
    typeof item.trimEndMs === "number" &&
    item.trimEndMs > item.trimStartMs
  ) {
    return item.trimEndMs - item.trimStartMs;
  }
  return clipSpan;
}

async function _validateTimeline(input: {
  userId: string;
  generatedContentId: number;
  timeline: TimelinePayload;
}): Promise<TimelineIssue[]> {
  const issues: TimelineIssue[] = [];
  const videoItems = input.timeline.tracks.video ?? [];
  const audioItems = input.timeline.tracks.audio ?? [];

  for (const item of [...videoItems, ...audioItems]) {
    if (item.endMs <= item.startMs) {
      issues.push({
        code: "INVALID_TIME_RANGE",
        track: videoItems.includes(item) ? "video" : "audio",
        itemIds: [item.id],
        severity: "error",
        message: "Timeline item has invalid start/end range.",
      });
    }
    if (item.endMs > input.timeline.durationMs) {
      issues.push({
        code: "ITEM_EXCEEDS_DURATION",
        track: videoItems.includes(item) ? "video" : "audio",
        itemIds: [item.id],
        severity: "error",
        message: "Timeline item exceeds duration.",
      });
    }
  }

  if (input.timeline.durationMs > 180_000) {
    issues.push({
      code: "DURATION_LIMIT_EXCEEDED",
      track: "timeline",
      itemIds: [],
      severity: "error",
      message: `Duration exceeds 180_000ms product limit.`,
    });
  }

  const laneGroups = new Map<number, typeof videoItems>();
  for (const item of videoItems) {
    const lane = item.lane ?? 0;
    const laneItems = laneGroups.get(lane) ?? [];
    laneItems.push(item);
    laneGroups.set(lane, laneItems);
  }
  for (const [lane, items] of laneGroups.entries()) {
    if (hasTrackOverlap(items)) {
      issues.push({
        code: "OVERLAPPING_VIDEO_SEGMENTS",
        track: "video",
        itemIds: items.map((it) => it.id),
        severity: "error",
        message: `Video segments overlap in lane ${lane}.`,
      });
    }

    const sorted = [...items].sort((a: any, b: any) => a.startMs - b.startMs);
    for (let i: number = 0; i < sorted.length; i += 1) {
      const item = sorted[i];
      const spanMs = Math.max(1, getItemSpanMs(item));
      if (
        spanMs < MIN_RECOMMENDED_CLIP_MS ||
        spanMs > MAX_RECOMMENDED_CLIP_MS
      ) {
        issues.push({
          code: "CLIP_PACING_WARNING",
          track: "video",
          itemIds: [item.id],
          severity: "warning",
          message: `Clip ${item.id} duration is outside recommended pacing range (${MIN_RECOMMENDED_CLIP_MS}-${MAX_RECOMMENDED_CLIP_MS}ms).`,
        });
      }

      const nextItem = sorted[i + 1];
      const transitions = [
        { key: "transitionIn" as const, value: item.transitionIn },
        { key: "transitionOut" as const, value: item.transitionOut },
      ];
      for (const transition of transitions) {
        const t = transition.value;
        if (!t) continue;
        if (t.type === "cut" && t.durationMs !== 0) {
          issues.push({
            code: "TRANSITION_DURATION_INVALID",
            track: "video",
            itemIds: [item.id],
            severity: "error",
            message: "Cut transitions must use 0ms duration.",
          });
          continue;
        }
        if (t.type !== "cut" && t.durationMs <= 0) {
          issues.push({
            code: "TRANSITION_DURATION_INVALID",
            track: "video",
            itemIds: [item.id],
            severity: "error",
            message: `${t.type} transitions must use a positive duration.`,
          });
          continue;
        }
        if (t.durationMs > spanMs) {
          issues.push({
            code: "TRANSITION_EXCEEDS_CLIP_SPAN",
            track: "video",
            itemIds: [item.id],
            severity: "error",
            message: "Transition duration cannot exceed source clip span.",
          });
        }
        if (transition.key === "transitionOut" && nextItem) {
          const nextSpan = Math.max(1, getItemSpanMs(nextItem));
          if (t.durationMs > nextSpan) {
            issues.push({
              code: "TRANSITION_EXCEEDS_NEXT_CLIP_SPAN",
              track: "video",
              itemIds: [item.id, nextItem.id],
              severity: "error",
              message: "Transition out duration exceeds next clip source span.",
            });
          }
        }
      }
    }
  }

  if (videoItems.length === 0) {
    issues.push({
      code: "MISSING_VIDEO_SEGMENTS",
      track: "video",
      itemIds: [],
      severity: "error",
      message: "At least one video segment is required.",
    });
  }

  const refs = [
    ...videoItems
      .filter((i) => i.assetId)
      .map((i) => ({
        track: "video" as const,
        itemId: i.id,
        assetId: i.assetId!,
        role: i.role,
      })),
    ...audioItems
      .filter((i) => i.assetId)
      .map((i) => ({
        track: "audio" as const,
        itemId: i.id,
        assetId: i.assetId!,
        role: i.role,
      })),
  ];

  if (refs.length > 0) {
    const ownedAssets = await db
      .select({
        id: assets.id,
        type: assets.type,
      })
      .from(contentAssets)
      .innerJoin(assets, eq(contentAssets.assetId, assets.id))
      .where(
        and(
          eq(contentAssets.generatedContentId, input.generatedContentId),
          eq(assets.userId, input.userId),
          inArray(
            assets.id,
            refs.map((ref) => ref.assetId),
          ),
        ),
      );

    const assetMap = new Map(ownedAssets.map((asset) => [asset.id, asset]));
    for (const ref of refs) {
      const asset = assetMap.get(ref.assetId);
      if (!asset) {
        issues.push({
          code: "ASSET_OWNERSHIP_INVALID",
          track: ref.track,
          itemIds: [ref.itemId],
          severity: "error",
          message: "Referenced asset is missing or not owned by user.",
        });
        continue;
      }

      const allowedTypes = getAssetTypeForTrack(ref.track, ref.role);
      if (!allowedTypes.includes(asset.type)) {
        issues.push({
          code: "ASSET_TYPE_MISMATCH",
          track: ref.track,
          itemIds: [ref.itemId],
          severity: "error",
          message: `Asset type ${asset.type} is not valid for ${ref.track} track.`,
        });
      }
    }
  }

  const captionTracks = input.timeline.tracks.captions ?? [];
  for (const captionTrack of captionTracks) {
    const segmentsRaw = Array.isArray(captionTrack?.segments)
      ? (captionTrack.segments as Array<Record<string, unknown>>)
      : [];
    const normalized = segmentsRaw
      .map((segment) => ({
        id: String(segment.id ?? ""),
        startMs: Math.max(0, Number(segment.startMs ?? 0)),
        endMs: Math.max(0, Number(segment.endMs ?? 0)),
      }))
      .sort((a, b) => a.startMs - b.startMs);

    for (const segment of normalized) {
      if (segment.endMs <= segment.startMs) {
        issues.push({
          code: "CAPTION_INVALID_TIME_RANGE",
          track: "captions",
          itemIds: [segment.id].filter(Boolean),
          severity: "error",
          message: "Caption segment has invalid time range.",
        });
      }
      if (segment.startMs < 0 || segment.endMs > input.timeline.durationMs) {
        issues.push({
          code: "CAPTION_OUT_OF_BOUNDS",
          track: "captions",
          itemIds: [segment.id].filter(Boolean),
          severity: "error",
          message: "Caption segment must stay within duration.",
        });
      }
    }

    for (let i = 1; i < normalized.length; i += 1) {
      if (normalized[i].startMs < normalized[i - 1].endMs) {
        issues.push({
          code: "CAPTION_OVERLAP",
          track: "captions",
          itemIds: [normalized[i - 1].id, normalized[i].id].filter(Boolean),
          severity: "error",
          message: "Caption segments cannot overlap.",
        });
      }
    }
  }

  return issues;
}

function _normalizeTimelineForPersistence(
  timeline: TimelinePayload,
): TimelinePayload {
  const durationMs = Math.min(timeline.durationMs, 180_000);
  const captions = (timeline.tracks.captions ?? []).map((track: any) => {
    const row = track as Record<string, unknown>;
    const rawSegments = Array.isArray(row.segments)
      ? (row.segments as Array<Record<string, unknown>>)
      : [];
    const segments = rawSegments.map((segment) => {
      const startMs = Math.min(
        durationMs,
        Math.max(0, Number(segment.startMs ?? 0)),
      );
      const endMs = Math.min(
        durationMs,
        Math.max(startMs, Number(segment.endMs ?? startMs)),
      );
      return {
        ...segment,
        startMs,
        endMs,
      };
    });
    return {
      ...row,
      segments,
    };
  });

  return {
    ...timeline,
    durationMs,
    tracks: {
      ...timeline.tracks,
      captions,
    },
  };
}

async function fetchOwnedContent(
  userId: string,
  generatedContentId: number,
): Promise<{
  id: number;
  prompt: string | null;
  generatedHook: string | null;
  generatedScript: string | null;
  cleanScriptForAudio: string | null;
  sceneDescription: string | null;
  generatedMetadata: Record<string, unknown> | null;
} | null> {
  const [content] = await db
    .select({
      id: generatedContent.id,
      prompt: generatedContent.prompt,
      generatedHook: generatedContent.generatedHook,
      generatedScript: generatedContent.generatedScript,
      cleanScriptForAudio: generatedContent.cleanScriptForAudio,
      sceneDescription: generatedContent.sceneDescription,
      generatedMetadata: generatedContent.generatedMetadata,
    })
    .from(generatedContent)
    .where(
      and(
        eq(generatedContent.id, generatedContentId),
        eq(generatedContent.userId, userId),
      ),
    )
    .limit(1);

  if (!content) return null;
  return {
    ...content,
    generatedMetadata:
      (content.generatedMetadata as Record<string, unknown> | null) ?? null,
  };
}

function getPhase4AssemblyFromMetadata(metadata: unknown): {
  jobId: string;
  status: string;
} | null {
  const root = metadata as Record<string, unknown> | null | undefined;
  const phase4 = root?.phase4 as Record<string, unknown> | undefined;
  const assembly = phase4?.assembly as Record<string, unknown> | undefined;
  if (!assembly) return null;
  const jobId = assembly.jobId;
  const status = assembly.status;
  if (typeof jobId !== "string" || typeof status !== "string") return null;
  return { jobId, status };
}

async function updatePhase4Metadata(input: {
  generatedContentId: number;
  existingGeneratedMetadata: Record<string, unknown> | null;
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  shots?: Array<{
    shotIndex: number;
    description: string;
    durationMs: number;
    assetId: string;
    useClipAudio: boolean;
  }>;
  provider?: string;
}) {
  const existingMetadata = input.existingGeneratedMetadata ?? {};
  const existingPhase4 =
    (existingMetadata.phase4 as Record<string, unknown> | null) ?? {};

  await db
    .update(generatedContent)
    .set({
      generatedMetadata: {
        ...existingMetadata,
        phase4: {
          ...existingPhase4,
          ...(input.shots ? { shots: input.shots } : {}),
          assembly: {
            jobId: input.jobId,
            status: input.status,
            ...(input.provider ? { provider: input.provider } : {}),
            updatedAt: new Date().toISOString(),
          },
        },
      },
    })
    .where(eq(generatedContent.id, input.generatedContentId));
}

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

    // Publish total shot count so the frontend can show X/Y progress
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
          durationMs: clip.durationSeconds * 1000,
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
        durationMs: clip.durationSeconds * 1000,
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

    // Remove the existing clip(s) for this shot index before inserting the new one
    // to prevent duplicate shots accumulating for the same index.
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
        durationMs: clip.durationSeconds * 1000,
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

function enqueue(kind: VideoJobKind, fn: () => Promise<void>): void {
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

// POST /api/video/reel
app.post(
  "/reel",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", createReelSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const payload = c.req.valid("json");

      const content = await fetchOwnedContent(
        auth.user.id,
        payload.generatedContentId,
      );
      if (!content) {
        return c.json({ error: "Content not found" }, 404);
      }

      // Require at least a hook or a script before generating video — prevents
      // silent single-shot fallbacks on content that hasn't been written yet.
      if (
        !content.generatedHook &&
        !content.generatedScript &&
        !payload.prompt
      ) {
        return c.json(
          {
            error:
              "Content must have a generated hook or script before video generation",
            code: "PHASE4_CONTENT_NOT_READY",
          },
          422,
        );
      }

      const resolvedPrompt =
        payload.prompt?.trim() ||
        content.generatedHook?.trim() ||
        content.prompt?.trim();
      if (!resolvedPrompt) {
        return c.json(
          {
            error: "No prompt available for video generation",
            code: "PHASE4_PROMPT_REQUIRED",
          },
          400,
        );
      }

      const assembly = getPhase4AssemblyFromMetadata(content.generatedMetadata);
      if (
        assembly &&
        (assembly.status === "queued" || assembly.status === "running")
      ) {
        const existing = await videoJobService.getJob(assembly.jobId);
        if (
          existing &&
          (existing.status === "queued" || existing.status === "running")
        ) {
          if (
            existing.kind === "reel_generate" &&
            existing.generatedContentId === payload.generatedContentId
          ) {
            return c.json(
              {
                jobId: existing.id,
                status: existing.status,
                generatedContentId: payload.generatedContentId,
              },
              202,
            );
          }
          return c.json(
            {
              error: "Another video task is already running for this content",
              code: "VIDEO_JOB_IN_PROGRESS",
              jobId: existing.id,
              kind: existing.kind,
            },
            409,
          );
        }
      }

      const job = await videoJobService.createJob({
        userId: auth.user.id,
        generatedContentId: payload.generatedContentId,
        kind: "reel_generate",
        request: {
          ...payload,
          prompt: resolvedPrompt,
        },
      });

      await updatePhase4Metadata({
        generatedContentId: payload.generatedContentId,
        existingGeneratedMetadata:
          (content.generatedMetadata as Record<string, unknown> | null) ?? null,
        jobId: job.id,
        status: "queued",
      });

      enqueue("reel_generate", () =>
        runReelGeneration({
          job,
          prompt: resolvedPrompt,
          durationSeconds: payload.durationSeconds,
          aspectRatio: payload.aspectRatio,
          provider: payload.provider,
        }),
      );

      return c.json(
        {
          jobId: job.id,
          status: job.status,
          generatedContentId: payload.generatedContentId,
        },
        202,
      );
    } catch (error) {
      debugLog.error("Failed to create reel job", {
        service: "video-route",
        operation: "createReel",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to queue reel generation" }, 500);
    }
  },
);

// POST /api/video/shots/regenerate
app.post(
  "/shots/regenerate",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", regenerateShotSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const payload = c.req.valid("json");

      const content = await fetchOwnedContent(
        auth.user.id,
        payload.generatedContentId,
      );
      if (!content) {
        return c.json({ error: "Content not found" }, 404);
      }

      const job = await videoJobService.createJob({
        userId: auth.user.id,
        generatedContentId: payload.generatedContentId,
        kind: "shot_regenerate",
        request: payload,
      });

      enqueue("shot_regenerate", () =>
        runShotRegenerate({
          job,
          shotIndex: payload.shotIndex,
          prompt: payload.prompt,
          durationSeconds: payload.durationSeconds,
          aspectRatio: payload.aspectRatio,
          provider: payload.provider,
        }),
      );

      return c.json({ jobId: job.id, status: job.status }, 202);
    } catch (error) {
      debugLog.error("Failed to regenerate shot", {
        service: "video-route",
        operation: "regenerateShot",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to queue shot regeneration" }, 500);
    }
  },
);

// GET /api/video/jobs/:jobId
app.get(
  "/jobs/:jobId",
  rateLimiter("customer"),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { jobId } = c.req.param();

      const job = await videoJobService.getJob(jobId);
      if (!job) {
        return c.json(
          { error: "Job not found", code: "PHASE4_JOB_NOT_FOUND" },
          404,
        );
      }

      if (job.userId !== auth.user.id) {
        return c.json({ error: "Forbidden", code: "PHASE4_FORBIDDEN" }, 403);
      }

      return c.json({ job });
    } catch (error) {
      debugLog.error("Failed to fetch video job", {
        service: "video-route",
        operation: "getJob",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to fetch job status" }, 500);
    }
  },
);

// POST /api/video/jobs/:jobId/retry
app.post(
  "/jobs/:jobId/retry",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  async (c) => {
    try {
      const auth = c.get("auth");
      const { jobId } = c.req.param();
      const job = await videoJobService.getJob(jobId);

      if (!job) {
        return c.json(
          { error: "Job not found", code: "PHASE4_JOB_NOT_FOUND" },
          404,
        );
      }

      if (job.userId !== auth.user.id) {
        return c.json({ error: "Forbidden", code: "PHASE4_FORBIDDEN" }, 403);
      }

      const retryJob = await videoJobService.createJob({
        userId: job.userId,
        generatedContentId: job.generatedContentId,
        kind: job.kind,
        request: job.request,
      });

      enqueue(job.kind, getRetryRunner(job, retryJob));

      return c.json({ jobId: retryJob.id, status: retryJob.status }, 202);
    } catch (error) {
      debugLog.error("Failed to retry video job", {
        service: "video-route",
        operation: "retryJob",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to retry job" }, 500);
    }
  },
);

export const __videoRouteTestUtils = {
  parseScriptShots,
  extractCaptionSourceText,
  deriveUseClipAudioByIndex,
  formatAssTime,
};

export default app;
