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
//
// Change the order here to set which AI provider is tried first.
// Providers are tried in this order, falling back to the next if one fails.
// Only enabled providers (those with API keys) will be used.
//
// Current order: OpenRouter → OpenAI → Claude
// To prioritize Claude first: ["claude", "openrouter", "openai"]
// To prioritize OpenAI first: ["openai", "openrouter", "claude"]

export const PROVIDER_PRIORITY: string[] = [
  "openai", // 1st priority - OpenAI (reliable, native tool calling)
  "claude", // 2nd priority - Claude/Anthropic (strong reasoning)
  "openrouter", // 3rd priority - OpenRouter (good model variety)
];

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

// ─── Priority Management ────────────────────────────────────────────────────────────

export function setProviderPriority(priority: string[]): void {
  // Validate all providers exist
  const invalidProviders = priority.filter((p) => !AI_PROVIDERS[p]);
  if (invalidProviders.length > 0) {
    throw new Error(`Unknown providers: ${invalidProviders.join(", ")}`);
  }

  // Update the priority array
  PROVIDER_PRIORITY.length = 0; // Clear existing
  PROVIDER_PRIORITY.push(...priority);
}

export function getProviderPriority(): string[] {
  return [...PROVIDER_PRIORITY]; // Return copy to prevent external modification
}

// Quick presets for common configurations
export const PRESETS = {
  openrouterFirst: ["openrouter", "openai", "claude"],
  openaiFirst: ["openai", "openrouter", "claude"],
  claudeFirst: ["claude", "openrouter", "openai"],
  openaiOnly: ["openai"],
  claudeOnly: ["claude"],
  openrouterOnly: ["openrouter"],
} as const;

export function applyPreset(preset: keyof typeof PRESETS): void {
  setProviderPriority([...PRESETS[preset]]);
}
