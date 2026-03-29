import { db } from "@/services/db/db";
import { aiCostLedger } from "@/infrastructure/database/drizzle/schema";
import {
  DEV_MOCK_EXTERNAL_INTEGRATIONS,
  DEV_MOCK_VIDEO_CLIP_DELAY_MS,
} from "@/utils/config/envUtil";
import { debugLog } from "@/utils/debug";
import { storage } from "@/services/storage";
import { resolveVideoOutputDurationSeconds } from "@/services/media/dev-fixtures/estimate-mp4-duration";
import { getDevMockVideoBufferForShot } from "@/services/media/dev-fixtures/load-fixtures";
import { getVideoGenerationProvider } from "./provider-selector";
import type {
  VideoProvider,
  VideoGenerationProvider,
  GenerateVideoClipParams,
  VideoClipResult,
  VideoClipResultProvider,
} from "./types";

export type {
  VideoProvider,
  VideoClipResultProvider,
  VideoGenerationProvider,
  GenerateVideoClipParams,
  VideoClipResult,
};

export { getVideoGenerationProvider } from "./provider-selector";

/**
 * Generate a video clip and record its cost to the ledger.
 * Uses the configured default provider unless `providerOverride` is specified.
 */
export async function generateVideoClip(
  params: GenerateVideoClipParams & { providerOverride?: VideoProvider },
): Promise<VideoClipResult> {
  const { providerOverride, ...clipParams } = params;

  if (DEV_MOCK_EXTERNAL_INTEGRATIONS) {
    const startMs = Date.now();
    const rawShot = clipParams.metadata?.shotIndex;
    const shotIndex =
      typeof rawShot === "number" && Number.isFinite(rawShot)
        ? Math.trunc(rawShot)
        : 0;
    const fixtureBuffer = getDevMockVideoBufferForShot(shotIndex);
    const durationSeconds = resolveVideoOutputDurationSeconds(
      fixtureBuffer,
      clipParams.durationSeconds,
    );
    if (DEV_MOCK_VIDEO_CLIP_DELAY_MS > 0) {
      debugLog.info("[video-generation] Mock clip: simulating provider delay", {
        service: "video-generation",
        operation: "generateVideoClip",
        delayMs: DEV_MOCK_VIDEO_CLIP_DELAY_MS,
      });
      await new Promise<void>((resolve) => {
        setTimeout(resolve, DEV_MOCK_VIDEO_CLIP_DELAY_MS);
      });
    }
    const slot = ((shotIndex % 4) + 4) % 4;
    const r2Key = `video-clips/${clipParams.userId ?? "anon"}/dev-mock-slot${slot + 1}-${Date.now()}.mp4`;
    const r2Url = await storage.uploadFile(
      fixtureBuffer,
      r2Key,
      "video/mp4",
    );
    const result: VideoClipResult = {
      r2Key,
      r2Url,
      durationSeconds,
      provider: "dev-fixture",
      costUsd: 0,
      generationTimeMs: Date.now() - startMs,
    };
    debugLog.info(
      "[video-generation] DEV_MOCK_EXTERNAL_INTEGRATIONS — fixture clip upload",
      {
        service: "video-generation",
        operation: "generateVideoClip",
        r2Key,
        durationSeconds,
        shotIndex,
        fixtureSlot: slot + 1,
      },
    );
    recordMediaCost({
      userId: params.userId,
      provider: result.provider,
      featureType: "video_gen",
      costUsd: result.costUsd,
      durationMs: result.generationTimeMs,
      metadata: {
        durationSeconds: result.durationSeconds,
        r2Key: result.r2Key,
        prompt: params.prompt.slice(0, 200),
        devFixture: true,
      },
    }).catch(() => {});
    return result;
  }

  const provider = await getVideoGenerationProvider(providerOverride);

  const result = await provider.generate(clipParams);

  // Record cost — non-blocking, fails silently
  recordMediaCost({
    userId: params.userId,
    provider: result.provider,
    featureType: "video_gen",
    costUsd: result.costUsd,
    durationMs: result.generationTimeMs,
    metadata: {
      durationSeconds: result.durationSeconds,
      r2Key: result.r2Key,
      prompt: params.prompt.slice(0, 200),
    },
  }).catch(() => {});

  return result;
}

async function recordMediaCost(params: {
  userId?: string;
  provider: VideoClipResultProvider;
  featureType: string;
  costUsd: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(aiCostLedger).values({
      userId: params.userId ?? null,
      provider: params.provider,
      model: params.provider,
      featureType: params.featureType,
      inputTokens: 0,
      outputTokens: 0,
      inputCost: "0",
      outputCost: "0",
      totalCost: params.costUsd.toFixed(8),
      durationMs: params.durationMs ?? 0,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    debugLog.error("Failed to record media cost", {
      service: "video-generation",
      operation: "recordMediaCost",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
