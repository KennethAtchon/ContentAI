/**
 * AI Client Helper Functions
 *
 * Provider resolution, token extraction, cost tracking, and the main
 * fallback orchestration. All provider-specific logic lives in providers.ts.
 */

import { generateText } from "ai";
import { debugLog } from "../../utils/debug/debug";
import { recordAiCost } from "../cost-tracker";
import { getEnabledProvidersAsync, getModelForProviderAsync } from "./config";
import {
  PROVIDER_REGISTRY,
  type ProviderId,
  type ModelTier,
} from "./providers";

// ─── Provider Resolution ──────────────────────────────────────────────────────

/**
 * Builds a provider instance using the resolved API key from DB (with ENV fallback).
 * Returns null if no key is configured for this provider.
 * Changes made in the admin panel take effect within one cache TTL (~60s).
 */
export async function getProviderInstanceAsync(providerId: ProviderId) {
  const { systemConfigService } = await import("../../domain/singletons");

  const def = PROVIDER_REGISTRY[providerId];
  const key = await systemConfigService.getApiKey(
    def.dbApiKeyName,
    def.envApiKey,
  );
  if (!key) return null;

  return def.createInstance(key);
}

/**
 * Resolves the first available provider in priority order and returns
 * the model instance ready to be passed to streamText / generateText.
 */
export async function getModelInstance(tier: ModelTier = "generation") {
  const enabledProviders = await getEnabledProvidersAsync();

  for (const providerId of enabledProviders) {
    const instance = await getProviderInstanceAsync(providerId);
    if (!instance) continue;

    const model = await getModelForProviderAsync(providerId, tier);

    // OpenAI-compatible providers expose a .chat() method; Anthropic does not
    const resolvedModel =
      typeof (instance as any).chat === "function"
        ? (instance as any).chat(model)
        : instance(model);

    return { resolvedModel, providerId, model };
  }

  throw new Error("No AI providers are available");
}

// ─── Token Extraction ─────────────────────────────────────────────────────────

/** Normalises token usage across provider response shapes (OpenAI vs Anthropic naming). */
export function extractUsageTokens(usage: unknown): {
  inputTokens: number;
  outputTokens: number;
} {
  if (!usage || typeof usage !== "object") {
    return { inputTokens: 0, outputTokens: 0 };
  }
  const u = usage as Record<string, unknown>;
  return {
    inputTokens:
      typeof u.inputTokens === "number"
        ? u.inputTokens
        : typeof u.promptTokens === "number"
          ? u.promptTokens
          : 0,
    outputTokens:
      typeof u.outputTokens === "number"
        ? u.outputTokens
        : typeof u.completionTokens === "number"
          ? u.completionTokens
          : 0,
  };
}

// ─── Cost Tracking ────────────────────────────────────────────────────────────

export async function trackAiCall(params: {
  userId?: string;
  providerId: ProviderId;
  model: string;
  featureType: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}) {
  await recordAiCost({
    userId: params.userId,
    provider: params.providerId,
    model: params.model,
    featureType: params.featureType,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    durationMs: params.durationMs,
    metadata: params.metadata,
  }).catch(() => {});
}

// ─── Fallback Orchestration ───────────────────────────────────────────────────

export interface AiCallParams {
  system: string;
  userContent: string;
  maxTokens?: number;
  modelTier?: ModelTier;
  featureType?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface AiCallResult {
  text: string;
  providerId: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Attempts a single AI call against the given provider. Throws on failure. */
async function attemptAiCall(
  providerId: ProviderId,
  params: AiCallParams,
): Promise<AiCallResult> {
  const instance = await getProviderInstanceAsync(providerId);
  if (!instance) throw new Error(`Provider ${providerId} is not configured`);

  const tier = params.modelTier ?? "analysis";
  const model = await getModelForProviderAsync(providerId, tier);
  const startMs = Date.now();

  const resolvedModel =
    typeof (instance as any).chat === "function"
      ? (instance as any).chat(model)
      : instance(model);

  const { text, usage } = await generateText({
    model: resolvedModel,
    system: params.system,
    messages: [{ role: "user", content: params.userContent }],
    maxOutputTokens: params.maxTokens ?? 1024,
  });

  const { inputTokens, outputTokens } = extractUsageTokens(usage);

  await trackAiCall({
    userId: params.userId,
    providerId,
    model,
    featureType: params.featureType ?? "unknown",
    inputTokens,
    outputTokens,
    durationMs: Date.now() - startMs,
    metadata: params.metadata,
  });

  debugLog.info(`AI call succeeded via ${providerId}`, {
    service: "ai-client",
    model,
  });

  return { text, providerId, model, inputTokens, outputTokens };
}

/** Calls AI with automatic provider fallback in priority order. */
export async function callAiWithFallback(
  params: AiCallParams,
): Promise<AiCallResult> {
  const enabledProviders = await getEnabledProvidersAsync();
  if (enabledProviders.length === 0)
    throw new Error("No AI providers are enabled");

  const errors: string[] = [];

  for (const providerId of enabledProviders) {
    try {
      return await attemptAiCall(providerId, params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${providerId}: ${msg}`);
      debugLog.warn(`${providerId} call failed — trying next provider`, {
        service: "ai-client",
        error: msg,
      });
    }
  }

  throw new Error(`All AI providers failed. ${errors.join("; ")}`);
}
