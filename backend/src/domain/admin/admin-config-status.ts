import type { SystemConfigService } from "../../services/config/system-config.service";
import { getAdminVideoProviderRows } from "../../services/video-generation/provider-registry";
import { systemConfigService } from "../singletons";

export async function buildAdminAiProvidersStatus() {
  const {
    getEnabledProvidersAsync,
    getProviderPriorityAsync,
    getModelForProviderAsync,
  } = await import("../../services/ai/config");
  const { PROVIDER_REGISTRY } = await import("../../services/ai/providers");

  const [priority, enabled] = await Promise.all([
    getProviderPriorityAsync(),
    getEnabledProvidersAsync(),
  ]);

  const enabledSet = new Set(enabled);

  const providers = await Promise.all(
    priority.map(async (id) => {
      const def = PROVIDER_REGISTRY[id];
      const active = enabledSet.has(id);
      const [analysisModel, generationModel] = active
        ? await Promise.all([
            getModelForProviderAsync(id, "analysis"),
            getModelForProviderAsync(id, "generation"),
          ])
        : [def.defaultModels.analysis, def.defaultModels.generation];

      return {
        id,
        label: def.label,
        active,
        analysisModel,
        generationModel,
      };
    }),
  );

  return {
    providers,
    defaultProvider: enabled[0] ?? null,
  };
}

export async function buildAdminVideoProvidersStatus(
  cfg: Pick<SystemConfigService, "get" | "getJson"> = systemConfigService,
) {
  const ALL_VIDEO_PROVIDERS = getAdminVideoProviderRows();

  const [availabilities, dbDefault, dbFallback] = await Promise.all([
    Promise.all(ALL_VIDEO_PROVIDERS.map((p) => p.provider.isAvailable())),
    cfg.get("video", "default_provider"),
    cfg.getJson<string[]>("video", "fallback_order", [
      "kling-fal",
      "image-ken-burns",
      "runway",
    ]),
  ]);

  const providers = await Promise.all(
    ALL_VIDEO_PROVIDERS.map(async (p, i) => {
      const active = availabilities[i] ?? false;
      const model = await cfg
        .get("video", p.modelKey)
        .then((v) => v || p.defaultModel);
      return { id: p.id, label: p.label, active, model };
    }),
  );

  const defaultProvider = dbDefault ?? "kling-fal";
  const activeDefault =
    providers.find((p) => p.id === defaultProvider && p.active) ??
    providers.find((p) => dbFallback.includes(p.id) && p.active) ??
    null;

  return {
    providers,
    defaultProvider: activeDefault?.id ?? null,
    configuredDefault: defaultProvider,
  };
}

export async function buildAdminApiKeysStatus(
  cfg: Pick<SystemConfigService, "get" | "hasApiKey"> = systemConfigService,
) {
  const {
    ANTHROPIC_API_KEY,
    OPENAI_API_KEY,
    OPEN_ROUTER_KEY,
    FAL_API_KEY,
    RUNWAY_API_KEY,
    ELEVENLABS_API_KEY,
    RESEND_API_KEY,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
    INSTAGRAM_API_TOKEN,
    SOCIAL_API_KEY,
  } = await import("../../utils/config/envUtil");

  const keyEnvMap: Record<string, string> = {
    anthropic_api_key: ANTHROPIC_API_KEY,
    openai_api_key: OPENAI_API_KEY,
    openrouter_api_key: OPEN_ROUTER_KEY,
    fal_api_key: FAL_API_KEY,
    runway_api_key: RUNWAY_API_KEY,
    elevenlabs_api_key: ELEVENLABS_API_KEY,
    resend_api_key: RESEND_API_KEY,
    stripe_secret_key: STRIPE_SECRET_KEY,
    stripe_webhook_secret: STRIPE_WEBHOOK_SECRET,
    instagram_api_token: INSTAGRAM_API_TOKEN,
    social_api_key: SOCIAL_API_KEY,
  };

  const results = await Promise.all(
    Object.entries(keyEnvMap).map(async ([key, envVal]) => {
      const active = await cfg.hasApiKey(key, envVal);
      const source = await cfg
        .get("api_keys", key)
        .then((v) => (v && v.trim() ? "db" : envVal ? "env" : "none"))
        .catch(() => (envVal ? "env" : "none"));
      return [key, { active, source }] as const;
    }),
  );

  return { keys: Object.fromEntries(results) };
}
