/**
 * AI Provider Registry
 *
 * Single source of truth for all provider configuration.
 * To add a new provider, add one entry here — no other files need to change.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  OPEN_ROUTER_KEY,
  OPEN_ROUTER_MODEL,
  ANALYSIS_MODEL,
  GENERATION_MODEL,
  OPENAI_MODEL,
} from "../../utils/config/envUtil";

export type ModelTier = "analysis" | "generation";

export interface ProviderDefinition {
  /** Human-readable label used in logs */
  label: string;
  /** ENV variable fallback for the API key */
  envApiKey: string;
  /** Key name stored in systemConfig api_keys category */
  dbApiKeyName: string;
  /** systemConfig key names for each model tier (ai category) */
  dbModelKeys: Record<ModelTier, string>;
  /** Default models used when no DB override is set */
  defaultModels: Record<ModelTier, string>;
  /** Build the AI SDK provider instance from a resolved API key */
  createInstance: (
    apiKey: string,
  ) => ReturnType<typeof createOpenAI | typeof createAnthropic>;
}

/**
 * Registry of all supported AI providers.
 *
 * Adding a provider = adding one entry here.
 * The ProviderId type is automatically derived from the keys.
 */
export const PROVIDER_REGISTRY = {
  openai: {
    label: "OpenAI",
    envApiKey: OPENAI_API_KEY,
    dbApiKeyName: "openai",
    dbModelKeys: {
      analysis: "openai_model",
      generation: "openai_model",
    },
    defaultModels: {
      analysis: OPENAI_MODEL,
      generation: OPENAI_MODEL,
    },
    createInstance: (apiKey: string) => createOpenAI({ apiKey }),
  },
  claude: {
    label: "Claude (Anthropic)",
    envApiKey: ANTHROPIC_API_KEY,
    dbApiKeyName: "anthropic",
    dbModelKeys: {
      analysis: "claude_analysis_model",
      generation: "claude_generation_model",
    },
    defaultModels: {
      analysis: ANALYSIS_MODEL,
      generation: GENERATION_MODEL,
    },
    createInstance: (apiKey: string) => createAnthropic({ apiKey }),
  },
  openrouter: {
    label: "OpenRouter",
    envApiKey: OPEN_ROUTER_KEY,
    dbApiKeyName: "openrouter",
    dbModelKeys: {
      analysis: "openrouter_model",
      generation: "openrouter_model",
    },
    defaultModels: {
      analysis: OPEN_ROUTER_MODEL,
      generation: OPEN_ROUTER_MODEL,
    },
    createInstance: (apiKey: string) =>
      createOpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" }),
  },
} satisfies Record<string, ProviderDefinition>;

/** Union type of all valid provider IDs — derived automatically from the registry. */
export type ProviderId = keyof typeof PROVIDER_REGISTRY;

/** Default provider priority order — overridable at runtime via DB config. */
export const DEFAULT_PROVIDER_PRIORITY: ProviderId[] = [
  "openrouter",
  "openai",
  "claude",
];
