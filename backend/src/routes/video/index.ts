import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import {
  authMiddleware,
  csrfMiddleware,
  rateLimiter,
} from "../../middleware/protection";
import type { HonoEnv } from "../../middleware/protection";
import { db } from "../../services/db/db";
import {
  generatedContent,
  reelAssets,
} from "../../infrastructure/database/drizzle/schema";
import { generateVideoClip } from "../../services/media/video-generation";
import type { VideoProvider } from "../../services/media/video-generation";
import { getFileUrl } from "../../services/storage/r2";
import { R2_PUBLIC_URL } from "../../utils/config/envUtil";
import { debugLog } from "../../utils/debug/debug";
import {
  videoJobService,
  type VideoRenderJob,
  type VideoJobKind,
} from "../../services/video/job.service";

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
  shotIndex: z.number().int().min(0),
  prompt: z.string().min(1).max(1000),
  durationSeconds: z.number().int().min(3).max(10).optional(),
  aspectRatio: aspectRatioSchema.optional(),
  provider: providerSchema.optional(),
});

const assembleSchema = z.object({
  generatedContentId: z.number().int().positive(),
  includeCaptions: z.boolean().optional(),
});

type ShotInput = {
  shotIndex: number;
  description: string;
  durationSeconds: number;
};

function parseScriptShots(script: string | null): ShotInput[] {
  if (!script) return [];

  const lines = script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  const shots: ShotInput[] = [];
  const timingRegex = /^\[(\d+)(?::\d+)?-(\d+)(?::\d+)?s?\]\s*(.+)$/i;

  for (const line of lines) {
    const m = line.match(timingRegex);
    if (!m) continue;
    const start = Number(m[1]);
    const end = Number(m[2]);
    const text = m[3]?.trim();
    if (!text) continue;
    const durationSeconds = Math.max(3, Math.min(10, end - start || 5));
    shots.push({
      shotIndex: shots.length,
      description: text,
      durationSeconds,
    });
  }

  return shots.slice(0, 12);
}

async function fetchOwnedContent(
  userId: string,
  generatedContentId: number,
): Promise<{
  id: number;
  prompt: string;
  generatedHook: string | null;
  generatedScript: string | null;
  generatedMetadata: Record<string, unknown> | null;
} | null> {
  const [content] = await db
    .select({
      id: generatedContent.id,
      prompt: generatedContent.prompt,
      generatedHook: generatedContent.generatedHook,
      generatedScript: generatedContent.generatedScript,
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

async function upsertAssembledAsset(input: {
  userId: string;
  generatedContentId: number;
  r2Key: string;
  r2Url: string;
  durationMs: number;
  metadata: Record<string, unknown>;
}): Promise<string> {
  const [existing] = await db
    .select({ id: reelAssets.id })
    .from(reelAssets)
    .where(
      and(
        eq(reelAssets.generatedContentId, input.generatedContentId),
        eq(reelAssets.userId, input.userId),
        eq(reelAssets.type, "assembled_video"),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(reelAssets)
      .set({
        r2Key: input.r2Key,
        r2Url: input.r2Url,
        durationMs: input.durationMs,
        metadata: input.metadata,
      })
      .where(eq(reelAssets.id, existing.id))
      .returning({ id: reelAssets.id });
    return updated.id;
  }

  const [assembled] = await db
    .insert(reelAssets)
    .values({
      generatedContentId: input.generatedContentId,
      userId: input.userId,
      type: "assembled_video",
      r2Key: input.r2Key,
      r2Url: input.r2Url,
      durationMs: input.durationMs,
      metadata: input.metadata,
    })
    .returning({ id: reelAssets.id });

  return assembled.id;
}

async function loadShotAssets(userId: string, generatedContentId: number) {
  const assets = await db
    .select()
    .from(reelAssets)
    .where(
      and(
        eq(reelAssets.generatedContentId, generatedContentId),
        eq(reelAssets.userId, userId),
        eq(reelAssets.type, "video_clip"),
      ),
    );

  return assets.sort((a, b) => {
    const ai = Number((a.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    const bi = Number((b.metadata as Record<string, unknown>)?.shotIndex ?? 0);
    return ai - bi;
  });
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

async function runAssembleFromExistingClips({
  job,
}: {
  job: VideoRenderJob;
}): Promise<void> {
  await videoJobService.updateJob(job.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
  });

  try {
    const shotAssets = await loadShotAssets(job.userId, job.generatedContentId);
    if (shotAssets.length === 0) {
      throw new Error("No shot clips available for assembly");
    }

    // Minimal assembly path for vertical slice:
    // use the first shot as assembled output placeholder until Remotion composition lands.
    const primary = shotAssets[0];
    const assembledAssetId = await upsertAssembledAsset({
      userId: job.userId,
      generatedContentId: job.generatedContentId,
      r2Key: primary.r2Key,
      r2Url: primary.r2Url ?? "",
      durationMs: primary.durationMs ?? 5000,
      metadata: {
        sourceType: "phase4_minimal_assembly",
        clipAssetId: primary.id,
      },
    });

    const videoUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${primary.r2Key}`
      : (primary.r2Url ?? "");

    await db
      .update(generatedContent)
      .set({ videoR2Url: videoUrl })
      .where(eq(generatedContent.id, job.generatedContentId));

    const [content] = await db
      .select({ generatedMetadata: generatedContent.generatedMetadata })
      .from(generatedContent)
      .where(eq(generatedContent.id, job.generatedContentId))
      .limit(1);

    await updatePhase4Metadata({
      generatedContentId: job.generatedContentId,
      existingGeneratedMetadata:
        (content?.generatedMetadata as Record<string, unknown> | null) ?? null,
      jobId: job.id,
      status: "completed",
    });

    const signedVideoUrl = await getFileUrl(primary.r2Key, 3600).catch(() => videoUrl);

    await videoJobService.updateJob(job.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      result: {
        assembledAssetId,
        videoUrl: signedVideoUrl,
        shotCount: shotAssets.length,
      },
      error: undefined,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await videoJobService.updateJob(job.id, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: errorMessage,
    });
    await updatePhase4Metadata({
      generatedContentId: job.generatedContentId,
      existingGeneratedMetadata: null,
      jobId: job.id,
      status: "failed",
    }).catch(() => {});

    debugLog.error("Assemble job failed", {
      service: "video-route",
      operation: "runAssembleFromExistingClips",
      jobId: job.id,
      generatedContentId: job.generatedContentId,
      error: errorMessage,
    });
  }
}

async function runReelGeneration(input: {
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
      input.prompt?.trim() || content.generatedHook?.trim() || content.prompt?.trim();
    if (!fallbackPrompt) {
      throw new Error("No prompt available for video generation");
    }

    const shotsFromScript = parseScriptShots(content.generatedScript);
    const shots: ShotInput[] =
      shotsFromScript.length > 0
        ? shotsFromScript
        : [
            {
              shotIndex: 0,
              description: fallbackPrompt,
              durationSeconds: input.durationSeconds ?? 5,
            },
          ];

    const createdShots: Array<{
      shotIndex: number;
      description: string;
      durationMs: number;
      assetId: string;
      useClipAudio: boolean;
    }> = [];

    for (const shot of shots) {
      const clip = await generateVideoClip({
        prompt: shot.description,
        durationSeconds: shot.durationSeconds,
        aspectRatio: input.aspectRatio,
        userId: job.userId,
        providerOverride: input.provider,
        metadata: {
          generatedContentId: job.generatedContentId,
          shotIndex: shot.shotIndex,
        },
      });

      const [clipAsset] = await db
        .insert(reelAssets)
        .values({
          generatedContentId: job.generatedContentId,
          userId: job.userId,
          type: "video_clip",
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

      createdShots.push({
        shotIndex: shot.shotIndex,
        description: shot.description,
        durationMs: clip.durationSeconds * 1000,
        assetId: clipAsset.id,
        useClipAudio: false,
      });
    }

    await updatePhase4Metadata({
      generatedContentId: job.generatedContentId,
      existingGeneratedMetadata: content.generatedMetadata,
      jobId: job.id,
      status: "running",
      shots: createdShots,
      provider: input.provider,
    });

    await runAssembleFromExistingClips({ job });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await videoJobService.updateJob(job.id, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: errorMessage,
    });

    debugLog.error("Video reel job failed", {
      service: "video-route",
      operation: "runReelGeneration",
      jobId: job.id,
      generatedContentId: job.generatedContentId,
      error: errorMessage,
    });
  }
}

async function runShotRegenerate(input: {
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

    const [clipAsset] = await db
      .insert(reelAssets)
      .values({
        generatedContentId: job.generatedContentId,
        userId: job.userId,
        type: "video_clip",
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

    await runAssembleFromExistingClips({ job });

    const current = await videoJobService.getJob(job.id);
    if (current?.status === "completed") {
      await videoJobService.updateJob(job.id, {
        result: {
          ...(current.result ?? {}),
          clipAssetId: clipAsset.id,
          provider: clip.provider,
          durationSeconds: clip.durationSeconds,
        },
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
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

function getRetryRunner(
  job: VideoRenderJob,
  retryJob: VideoRenderJob,
): () => Promise<void> {
  const req = (job.request ?? {}) as Record<string, unknown>;
  const opts = {
    durationSeconds: req.durationSeconds ? Number(req.durationSeconds) : undefined,
    aspectRatio: req.aspectRatio as "9:16" | "16:9" | "1:1" | undefined,
    provider: req.provider as VideoProvider | undefined,
  };
  switch (job.kind) {
    case "assemble":
      return () => runAssembleFromExistingClips({ job: retryJob });
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

      const content = await fetchOwnedContent(auth.user.id, payload.generatedContentId);
      if (!content) {
        return c.json({ error: "Content not found" }, 404);
      }

      const resolvedPrompt =
        payload.prompt?.trim() || content.generatedHook?.trim() || content.prompt?.trim();
      if (!resolvedPrompt) {
        return c.json(
          {
            error: "No prompt available for video generation",
            code: "PHASE4_PROMPT_REQUIRED",
          },
          400,
        );
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

      const content = await fetchOwnedContent(auth.user.id, payload.generatedContentId);
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

// POST /api/video/assemble
app.post(
  "/assemble",
  rateLimiter("customer"),
  csrfMiddleware(),
  authMiddleware("user"),
  zValidator("json", assembleSchema),
  async (c) => {
    try {
      const auth = c.get("auth");
      const payload = c.req.valid("json");

      const content = await fetchOwnedContent(auth.user.id, payload.generatedContentId);
      if (!content) {
        return c.json({ error: "Content not found" }, 404);
      }

      const job = await videoJobService.createJob({
        userId: auth.user.id,
        generatedContentId: payload.generatedContentId,
        kind: "assemble",
        request: payload,
      });

      enqueue("assemble", () => runAssembleFromExistingClips({ job }));

      return c.json({ jobId: job.id, status: job.status }, 202);
    } catch (error) {
      debugLog.error("Failed to queue assembly", {
        service: "video-route",
        operation: "assemble",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json({ error: "Failed to queue assembly" }, 500);
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
        return c.json({ error: "Job not found", code: "PHASE4_JOB_NOT_FOUND" }, 404);
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
        return c.json({ error: "Job not found", code: "PHASE4_JOB_NOT_FOUND" }, 404);
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

export default app;
