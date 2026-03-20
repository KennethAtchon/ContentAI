/**
 * AI Client Helper Functions
 *
 * Common utilities and reusable logic for AI operations.
 */

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { debugLog } from "../../utils/debug/debug";
import { recordAiCost } from "../cost-tracker";
import { getModelForProviderAsync, getEnabledProvidersAsync } from "./config";
import {
  ANTHROPIC_API_KEY as ENV_ANTHROPIC,
  OPENAI_API_KEY as ENV_OPENAI,
  OPEN_ROUTER_KEY as ENV_OPENROUTER,
} from "../../utils/config/envUtil";

// ─── Provider Instances (async, DB-backed) ────────────────────────────────────────

/**
 * Builds a fresh provider instance using the resolved API key.
 * Keys are read from DB (api_keys category) with ENV fallback on every call,
 * so changes made via the admin panel take effect within one cache TTL (~60s).
 */
export async function getProviderInstanceAsync(provider: string) {
  const { systemConfigService } =
    await import("../../services/config/system-config.service");

  switch (provider) {
    case "openrouter": {
      const key = await systemConfigService.getApiKey(
        "openrouter",
        ENV_OPENROUTER,
      );
      if (!key) return null;
      return createOpenAI({
        apiKey: key,
        baseURL: "https://openrouter.ai/api/v1",
      });
    }
    case "openai": {
      const key = await systemConfigService.getApiKey("openai", ENV_OPENAI);
      if (!key) return null;
      return createOpenAI({ apiKey: key });
    }
    case "claude": {
      const key = await systemConfigService.getApiKey(
        "anthropic",
        ENV_ANTHROPIC,
      );
      if (!key) return null;
      return createAnthropic({ apiKey: key });
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/** Sync fallback — uses ENV-loaded keys. Used for streaming until refactored. */
export function getProviderInstance(provider: string) {
  const { AI_PROVIDERS } = require("./config") as typeof import("./config");
  const config = AI_PROVIDERS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  switch (provider) {
    case "openrouter":
      if (!config.enabled) return null;
      return createOpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
    case "openai":
      if (!config.enabled) return null;
      return createOpenAI({ apiKey: config.apiKey });
    case "claude":
      if (!config.enabled) return null;
      return createAnthropic({ apiKey: config.apiKey });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ─── Token Extraction ─────────────────────────────────────────────────────────────

export function extractUsageTokens(usage: unknown): {
  inputTokens: number;
  outputTokens: number;
} {
  if (!usage || typeof usage !== "object") {
    return { inputTokens: 0, outputTokens: 0 };
  }

  const record = usage as Record<string, unknown>;
  const inputTokens =
    typeof record.inputTokens === "number"
      ? record.inputTokens
      : typeof record.promptTokens === "number"
        ? record.promptTokens
        : 0;
  const outputTokens =
    typeof record.outputTokens === "number"
      ? record.outputTokens
      : typeof record.completionTokens === "number"
        ? record.completionTokens
        : 0;

  return { inputTokens, outputTokens };
}

// ─── Cost Tracking & Logging ─────────────────────────────────────────────────────

export async function trackAiCall(params: {
  userId?: string;
  provider: "openrouter" | "openai" | "claude";
  model: string;
  featureType: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}) {
  await recordAiCost(params).catch(() => {});
}

export function logAiSuccess(provider: string, model: string) {
  debugLog.info(`AI call succeeded via ${provider}`, {
    service: "ai-client",
    operation: "callAi",
    model,
  });
}

export function logAiFailure(provider: string, error: unknown) {
  debugLog.warn(`${provider} call failed — falling back`, {
    service: "ai-client",
    operation: "callAi",
    error: error instanceof Error ? error.message : String(error),
  });
}

// ─── Unified AI Call Logic ───────────────────────────────────────────────────────

export interface AiCallParams {
  system: string;
  userContent: string;
  maxTokens?: number;
  modelTier?: "analysis" | "generation";
  featureType?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface AiCallResult {
  text: string;
  provider: "openrouter" | "openai" | "claude";
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function attemptAiCall(
  provider: "openrouter" | "openai" | "claude",
  params: AiCallParams,
): Promise<AiCallResult> {
  const instance = await getProviderInstanceAsync(provider);
  if (!instance) {
    throw new Error(`Provider ${provider} is not available`);
  }

  const model = await getModelForProviderAsync(
    provider,
    params.modelTier || "analysis",
  );
  const startMs = Date.now();

  const resolvedModel =
    typeof (instance as any).chat === "function"
      ? (instance as any).chat(model)
      : instance(model);

  const { text, usage } = await generateText({
    model: resolvedModel,
    system: params.system,
    messages: [
      {
        role: "user",
        content: params.userContent,
      },
    ],
    maxOutputTokens: params.maxTokens || 1024,
  });

  const { inputTokens, outputTokens } = extractUsageTokens(usage);

  await trackAiCall({
    userId: params.userId,
    provider,
    model,
    featureType: params.featureType || "unknown",
    inputTokens,
    outputTokens,
    durationMs: Date.now() - startMs,
    metadata: params.metadata,
  });

  logAiSuccess(provider, model);

  return {
    text,
    provider,
    model,
    inputTokens,
    outputTokens,
  };
}

// ─── Provider Fallback Logic ─────────────────────────────────────────────────────

export async function callAiWithFallback(
  params: AiCallParams,
): Promise<AiCallResult> {
  const enabledProviders = await getEnabledProvidersAsync();

  if (enabledProviders.length === 0) {
    throw new Error("No AI providers are enabled");
  }

  const errors: unknown[] = [];

  for (const provider of enabledProviders) {
    try {
      return await attemptAiCall(provider, params);
    } catch (error) {
      errors.push(error);
      logAiFailure(provider, error);
      continue;
    }
  }

  throw new Error(
    `All AI providers failed. Errors: ${errors.map((e) => (e instanceof Error ? e.message : String(e))).join("; ")}`,
  );
}

// ─── Streaming Helper ────────────────────────────────────────────────────────────

export async function getModelInstance(
  modelTier: "analysis" | "generation" = "generation",
) {
  const enabledProviders = await getEnabledProvidersAsync();

  for (const provider of enabledProviders) {
    const instance = await getProviderInstanceAsync(provider);
    if (instance) {
      const model = await getModelForProviderAsync(provider, modelTier);
      return {
        instance,
        provider,
        model,
      };
    }
  }

  throw new Error("No AI providers are available");
}
