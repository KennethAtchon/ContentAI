import { VIDEO_GENERATION_PROVIDER } from "@/utils/config/envUtil";
import { debugLog } from "@/utils/debug";
import { klingFalProvider } from "./providers/kling-fal";
import { runwayProvider } from "./providers/runway";
import { imageKenBurnsProvider } from "./providers/image-ken-burns";
import type { VideoGenerationProvider, VideoProvider } from "./types";

const PROVIDERS: Record<VideoProvider, VideoGenerationProvider> = {
  "kling-fal": klingFalProvider,
  runway: runwayProvider,
  "image-ken-burns": imageKenBurnsProvider,
};

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
      const { systemConfigService } =
        await import("@/services/config/system-config.service");
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

  const provider = PROVIDERS[providerName];

  if (!provider) {
    throw new Error(
      `Unknown video generation provider: "${providerName}". Valid options: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }

  if (!(await provider.isAvailable())) {
    let fallbackOrder: VideoProvider[] = [
      "kling-fal",
      "image-ken-burns",
      "runway",
    ];
    try {
      const { systemConfigService } =
        await import("@/services/config/system-config.service");
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
        (await PROVIDERS[fallbackName].isAvailable())
      ) {
        debugLog.warn(
          `Provider "${providerName}" not available (missing API key). Falling back to "${fallbackName}".`,
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
