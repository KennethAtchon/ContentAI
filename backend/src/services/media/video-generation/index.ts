import { db } from "@/services/db/db";
import { aiCostLedger } from "@/infrastructure/database/drizzle/schema";
import { VIDEO_GENERATION_PROVIDER } from "@/utils/config/envUtil";
import { debugLog } from "@/utils/debug";
import { klingFalProvider } from "./providers/kling-fal";
import { runwayProvider } from "./providers/runway";
import { imageKenBurnsProvider } from "./providers/image-ken-burns";
import type {
  VideoProvider,
  VideoGenerationProvider,
  GenerateVideoClipParams,
  VideoClipResult,
} from "./types";

export type {
  VideoProvider,
  VideoGenerationProvider,
  GenerateVideoClipParams,
  VideoClipResult,
};

const PROVIDERS: Record<VideoProvider, VideoGenerationProvider> = {
  "kling-fal": klingFalProvider,
  runway: runwayProvider,
  "image-ken-burns": imageKenBurnsProvider,
};

export function getVideoGenerationProvider(
  override?: VideoProvider,
): VideoGenerationProvider {
  const name = (override ?? VIDEO_GENERATION_PROVIDER) as VideoProvider;
  const provider = PROVIDERS[name];

  if (!provider) {
    throw new Error(
      `Unknown video generation provider: "${name}". Valid options: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }

  if (!provider.isAvailable()) {
    // Gracefully fall back to the next available provider
    const fallbackOrder: VideoProvider[] = [
      "kling-fal",
      "image-ken-burns",
      "runway",
    ];
    for (const fallbackName of fallbackOrder) {
      if (fallbackName !== name && PROVIDERS[fallbackName].isAvailable()) {
        debugLog.warn(
          `Provider "${name}" not available (missing API key). Falling back to "${fallbackName}".`,
          {
            service: "video-generation",
            operation: "getProvider",
          },
        );
        return PROVIDERS[fallbackName];
      }
    }
    throw new Error(
      `No video generation provider is available. Set FAL_API_KEY or RUNWAY_API_KEY.`,
    );
  }

  return provider;
}

/**
 * Generate a video clip and record its cost to the ledger.
 * Uses the configured default provider unless `providerOverride` is specified.
 */
export async function generateVideoClip(
  params: GenerateVideoClipParams & { providerOverride?: VideoProvider },
): Promise<VideoClipResult> {
  const { providerOverride, ...clipParams } = params;
  const provider = getVideoGenerationProvider(providerOverride);

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
  provider: VideoProvider;
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
