import { klingFalProvider } from "./providers/kling-fal";
import { runwayProvider } from "./providers/runway";
import { imageKenBurnsProvider } from "./providers/image-ken-burns";
import type { VideoGenerationProvider, VideoProvider } from "./types";

/** Single map of provider id → implementation (admin UI, customer defaults, clip generation). */
export const videoGenerationProvidersById: Record<
  VideoProvider,
  VideoGenerationProvider
> = {
  "kling-fal": klingFalProvider,
  runway: runwayProvider,
  "image-ken-burns": imageKenBurnsProvider,
};

const ADMIN_ENTRIES = [
  {
    id: "kling-fal" as const,
    label: "Kling (via Fal.ai)",
    modelKey: "kling_model",
    defaultModel: "fal-ai/kling-video/v2.1/standard/text-to-video",
  },
  {
    id: "runway" as const,
    label: "Runway",
    modelKey: "runway_model",
    defaultModel: "gen3a_turbo",
  },
  {
    id: "image-ken-burns" as const,
    label: "Image + Ken Burns",
    modelKey: "flux_model",
    defaultModel: "fal-ai/flux/schnell",
  },
] as const;

const CUSTOMER_ENTRIES = [
  { id: "kling-fal" as const, label: "Kling (via Fal.ai)" },
  { id: "runway" as const, label: "Runway" },
  { id: "image-ken-burns" as const, label: "Image + Ken Burns" },
] as const;

export type AdminVideoProviderRow = (typeof ADMIN_ENTRIES)[number] & {
  provider: VideoGenerationProvider;
};

export function getAdminVideoProviderRows(): AdminVideoProviderRow[] {
  return ADMIN_ENTRIES.map((e) => ({
    ...e,
    provider: videoGenerationProvidersById[e.id],
  }));
}

export type CustomerVideoProviderRow = (typeof CUSTOMER_ENTRIES)[number] & {
  provider: VideoGenerationProvider;
};

export function getCustomerVideoProviderRows(): CustomerVideoProviderRow[] {
  return CUSTOMER_ENTRIES.map((e) => ({
    ...e,
    provider: videoGenerationProvidersById[e.id],
  }));
}
