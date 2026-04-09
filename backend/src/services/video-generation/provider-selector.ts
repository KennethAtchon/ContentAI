import { VIDEO_GENERATION_PROVIDER } from "@/utils/config/envUtil";
import { debugLog } from "@/utils/debug";
import { videoGenerationProvidersById } from "./provider-registry";
import type { VideoGenerationProvider, VideoProvider } from "./types";

/**
 * Resolves which video provider implementation to use (DB default, env, override, fallback chain).
 */
export async function getVideoGenerationProvider(
  override?: VideoProvider,
): Promise<VideoGenerationProvider> {
  let providerName: VideoProvider;

  if (override) {
    providerName = override;
  } else {
    try {
      const { systemConfigService } = await import("@/domain/singletons");
      const dbProvider = await systemConfigService.get(
        "video",
        "default_provider",
      );
      providerName =
        (dbProvider as VideoProvider) ??
        (VIDEO_GENERATION_PROVIDER as VideoProvider);
    } catch {
      providerName = VIDEO_GENERATION_PROVIDER as VideoProvider;
    }
  }

  const provider = videoGenerationProvidersById[providerName];

  if (!provider) {
    throw new Error(
      `Unknown video generation provider: "${providerName}". Valid options: ${Object.keys(videoGenerationProvidersById).join(", ")}`,
    );
  }

  if (!(await provider.isAvailable())) {
    let fallbackOrder: VideoProvider[] = [
      "kling-fal",
      "image-ken-burns",
      "runway",
    ];
    try {
      const { systemConfigService } = await import("@/domain/singletons");
      fallbackOrder = await systemConfigService.getJson<VideoProvider[]>(
        "video",
        "fallback_order",
        fallbackOrder,
      );
    } catch {
      // use static fallback
    }

    for (const fallbackName of fallbackOrder) {
      if (
        fallbackName !== providerName &&
        (await videoGenerationProvidersById[fallbackName].isAvailable())
      ) {
        debugLog.warn(
          `Provider "${providerName}" not available (missing API key). Falling back to "${fallbackName}".`,
          {
            service: "video-generation",
            operation: "getProvider",
          },
        );
        return videoGenerationProvidersById[fallbackName];
      }
    }
    throw new Error(
      `No video generation provider is available. Set FAL_API_KEY or RUNWAY_API_KEY.`,
    );
  }

  return provider;
}
