import type { SystemConfigService } from "../../services/config/system-config.service";

/** Whether a provider + model supports vision (heuristic for UI). */
export function detectSupportsVision(provider: string, model: string): boolean {
  const m = model.toLowerCase();

  if (provider === "claude") {
    return (
      m.startsWith("claude-3") ||
      m.includes("-4-") ||
      m.includes("-sonnet-4") ||
      m.includes("-opus-4") ||
      m.includes("-haiku-4")
    );
  }

  if (provider === "openai") {
    return (
      m.startsWith("gpt-4o") ||
      m.includes("gpt-4-vision") ||
      m.includes("gpt-4-turbo") ||
      m.startsWith("o1") ||
      m.startsWith("o3") ||
      m.startsWith("o4")
    );
  }

  if (provider === "openrouter") {
    return (
      m.startsWith("anthropic/claude-3") ||
      (m.startsWith("anthropic/claude-") &&
        (m.includes("-4-") ||
          m.includes("sonnet-4") ||
          m.includes("opus-4"))) ||
      m.startsWith("openai/gpt-4o") ||
      m.startsWith("openai/o1") ||
      m.startsWith("openai/o3") ||
      m.startsWith("google/gemini") ||
      (m.startsWith("meta-llama/llama-3") && m.includes("vision")) ||
      m.startsWith("mistralai/pixtral") ||
      m.startsWith("qwen/qwen-vl") ||
      (m.startsWith("x-ai/grok") && !m.includes("mini"))
    );
  }

  return false;
}

/** Approximate context window for display; null if unknown. */
export function detectContextWindow(
  provider: string,
  model: string,
): number | null {
  const m = model.toLowerCase();

  if (provider === "claude") {
    if (
      m.startsWith("claude-3") ||
      (m.includes("claude-") && m.includes("-4-"))
    )
      return 200_000;
    return null;
  }

  if (provider === "openai") {
    if (
      m.startsWith("gpt-4o") ||
      m.startsWith("gpt-4-turbo") ||
      m.startsWith("o1") ||
      m.startsWith("o3") ||
      m.startsWith("o4")
    )
      return 128_000;
    if (m.startsWith("gpt-4")) return 8_192;
    if (m.startsWith("gpt-3.5-turbo-16k")) return 16_384;
    if (m.startsWith("gpt-3.5")) return 4_096;
    return null;
  }

  if (provider === "openrouter") {
    if (m.startsWith("anthropic/claude")) return 200_000;
    if (m.startsWith("google/gemini-1.5") || m.startsWith("google/gemini-2"))
      return 1_000_000;
    if (m.startsWith("openai/gpt-4o") || m.startsWith("openai/o1"))
      return 128_000;
    if (m.includes("deepseek")) return 128_000;
    if (m.includes("llama-3")) return 128_000;
    return null;
  }

  return null;
}

export async function buildCustomerAiDefaultsResponse() {
  const { getEnabledProvidersAsync, getModelForProviderAsync } =
    await import("../../lib/ai/config");
  const { PROVIDER_REGISTRY } = await import("../../lib/ai/providers");

  const enabled = await getEnabledProvidersAsync();
  const defaultProvider = enabled[0] ?? null;

  if (!defaultProvider) {
    return {
      defaultProvider: null,
      defaultProviderLabel: null,
      analysisModel: null,
      generationModel: null,
      supportsVision: false,
      contextWindow: null,
    };
  }

  const def = PROVIDER_REGISTRY[defaultProvider];
  const [analysisModel, generationModel] = await Promise.all([
    getModelForProviderAsync(defaultProvider, "analysis"),
    getModelForProviderAsync(defaultProvider, "generation"),
  ]);

  return {
    defaultProvider,
    defaultProviderLabel: def.label,
    analysisModel,
    generationModel,
    supportsVision: detectSupportsVision(defaultProvider, generationModel),
    contextWindow: detectContextWindow(defaultProvider, generationModel),
  };
}

export async function buildCustomerVideoDefaultsResponse(
  systemConfig: Pick<SystemConfigService, "get">,
) {
  const { klingFalProvider } =
    await import("../../services/video-generation/providers/kling-fal");
  const { runwayProvider } =
    await import("../../services/video-generation/providers/runway");
  const { imageKenBurnsProvider } =
    await import("../../services/video-generation/providers/image-ken-burns");

  const PROVIDERS = [
    {
      id: "kling-fal",
      label: "Kling (via Fal.ai)",
      provider: klingFalProvider,
    },
    { id: "runway", label: "Runway", provider: runwayProvider },
    {
      id: "image-ken-burns",
      label: "Image + Ken Burns",
      provider: imageKenBurnsProvider,
    },
  ] as const;

  const [dbDefault, availabilities] = await Promise.all([
    systemConfig.get("video", "default_provider"),
    Promise.all(PROVIDERS.map((p) => p.provider.isAvailable())),
  ]);

  const configuredDefault = dbDefault ?? "kling-fal";
  const preferred = PROVIDERS.find((p) => p.id === configuredDefault);
  const preferredActive =
    preferred && availabilities[PROVIDERS.indexOf(preferred)];

  const effectiveDefault = preferredActive
    ? preferred
    : (PROVIDERS.find((_, i) => availabilities[i]) ?? null);

  return {
    defaultProvider: effectiveDefault?.id ?? null,
    defaultProviderLabel: effectiveDefault?.label ?? null,
  };
}
