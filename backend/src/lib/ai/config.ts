/**
 * AI Provider Configuration
 *
 * Centralized configuration for all AI providers and models.
 * Easy to edit and maintain without touching the core logic.
 */

import {
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  OPEN_ROUTER_KEY,
  OPEN_ROUTER_MODEL,
  ANALYSIS_MODEL,
  GENERATION_MODEL,
  OPENAI_MODEL,
} from "../../utils/config/envUtil";

// ─── Provider Configuration ────────────────────────────────────────────────────────

export interface ProviderConfig {
  name: string;
  apiKey?: string;
  baseURL?: string;
  compatibility?: string;
  enabled: boolean;
}

export interface ModelConfig {
  analysis: string;
  generation: string;
}

export const AI_PROVIDERS: Record<string, ProviderConfig> = {
  openrouter: {
    name: "OpenRouter",
    apiKey: OPEN_ROUTER_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    compatibility: "compatible",
    enabled: !!OPEN_ROUTER_KEY,
  },
  openai: {
    name: "OpenAI",
    apiKey: OPENAI_API_KEY,
    enabled: !!OPENAI_API_KEY,
  },
  claude: {
    name: "Claude (Anthropic)",
    apiKey: ANTHROPIC_API_KEY,
    enabled: !!ANTHROPIC_API_KEY,
  },
};

export const AI_MODELS: Record<string, ModelConfig> = {
  openrouter: {
    analysis: OPEN_ROUTER_MODEL,
    generation: OPEN_ROUTER_MODEL,
  },
  openai: {
    analysis: OPENAI_MODEL,
    generation: OPENAI_MODEL,
  },
  claude: {
    analysis: ANALYSIS_MODEL,
    generation: GENERATION_MODEL,
  },
};

// ─── Provider Priority ─────────────────────────────────────────────────────────────

export const PROVIDER_PRIORITY: string[] = ["openrouter", "openai", "claude"];

// ─── Default Settings ─────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS = {
  maxTokens: 1024,
  modelTier: "analysis" as const,
  featureType: "unknown",
};

// ─── Helper Functions ─────────────────────────────────────────────────────────────

export function getEnabledProviders(): ("openrouter" | "openai" | "claude")[] {
  return PROVIDER_PRIORITY.filter(
    (provider) => AI_PROVIDERS[provider]?.enabled,
  ) as ("openrouter" | "openai" | "claude")[];
}

export function getModelForProvider(
  provider: string,
  modelTier: "analysis" | "generation",
): string {
  const models = AI_MODELS[provider];
  if (!models) {
    throw new Error(`No models configured for provider: ${provider}`);
  }
  return models[modelTier];
}

export function getProviderInfo(provider: string): ProviderConfig {
  const config = AI_PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return config;
}
