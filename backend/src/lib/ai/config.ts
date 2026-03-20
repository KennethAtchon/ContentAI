/**
 * AI Runtime Configuration
 *
 * Manages provider priority and default call settings.
 * Provider-specific config (models, keys, SDK factories) lives in providers.ts.
 */

import {
  PROVIDER_REGISTRY,
  DEFAULT_PROVIDER_PRIORITY,
  type ProviderId,
} from "./providers";

// ─── Default Call Settings ────────────────────────────────────────────────────

export const DEFAULT_SETTINGS = {
  maxTokens: 1024,
  modelTier: "analysis" as const,
  featureType: "unknown",
};

// ─── Provider Priority — DB-backed, falls back to static default ─────────────

/** Returns the live provider priority from DB config, falls back to the static default. */
export async function getProviderPriorityAsync(): Promise<ProviderId[]> {
  try {
    const { systemConfigService } =
      await import("../../services/config/system-config.service");
    return await systemConfigService.getJson<ProviderId[]>(
      "ai",
      "provider_priority",
      [...DEFAULT_PROVIDER_PRIORITY],
    );
  } catch {
    return [...DEFAULT_PROVIDER_PRIORITY];
  }
}

/**
 * Returns providers that are currently enabled (have a configured API key),
 * in priority order, using DB config with ENV fallback.
 */
export async function getEnabledProvidersAsync(): Promise<ProviderId[]> {
  const { systemConfigService } =
    await import("../../services/config/system-config.service");

  const priority = await getProviderPriorityAsync();

  const enabled = await Promise.all(
    priority.map((id) => {
      const def = PROVIDER_REGISTRY[id];
      return systemConfigService.hasApiKey(def.dbApiKeyName, def.envApiKey);
    }),
  );

  return priority.filter((_, i) => enabled[i]);
}

/**
 * Returns the model string for a given provider and tier,
 * checking DB overrides first then falling back to the registry default.
 */
export async function getModelForProviderAsync(
  providerId: ProviderId,
  tier: "analysis" | "generation",
): Promise<string> {
  try {
    const { systemConfigService } =
      await import("../../services/config/system-config.service");
    const dbKey = PROVIDER_REGISTRY[providerId].dbModelKeys[tier];
    const dbVal = await systemConfigService.get("ai", dbKey);
    if (dbVal) return dbVal;
  } catch {
    // fall through to default
  }
  return PROVIDER_REGISTRY[providerId].defaultModels[tier];
}
