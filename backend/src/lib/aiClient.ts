import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  callAiWithFallback,
  getModelInstance,
  extractUsageTokens,
} from "./ai/helpers";
import { DEFAULT_SETTINGS } from "./ai/config";
import type { ProviderId, ModelTier } from "./ai/providers";

// ─── Prompt Loader ────────────────────────────────────────────────────────────

const promptCache: Record<string, string> = {};

/**
 * Loads a prompt file by name from src/prompts/.
 * Results are cached in memory after first read.
 */
export function loadPrompt(name: string): string {
  if (promptCache[name]) return promptCache[name];

  const filePath = join(import.meta.dir, "../prompts", `${name}.txt`);
  if (!existsSync(filePath)) {
    throw new Error(`Prompt file not found: ${name}.txt`);
  }

  const content = readFileSync(filePath, "utf-8").trim();
  promptCache[name] = content;
  return content;
}

// ─── Public Call Interface ────────────────────────────────────────────────────

export interface AiMessage {
  system: string;
  userContent: string;
  maxTokens?: number;
  /** "analysis" = cheaper/faster model, "generation" = smarter model */
  modelTier?: ModelTier;
  featureType?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface AiResponse {
  text: string;
  providerId: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Calls AI with automatic provider fallback. */
export async function callAi(params: AiMessage): Promise<AiResponse> {
  return callAiWithFallback({
    system: params.system,
    userContent: params.userContent,
    maxTokens: params.maxTokens ?? DEFAULT_SETTINGS.maxTokens,
    modelTier: params.modelTier ?? DEFAULT_SETTINGS.modelTier,
    featureType: params.featureType ?? DEFAULT_SETTINGS.featureType,
    userId: params.userId,
    metadata: params.metadata,
  });
}

// ─── Streaming Helpers ────────────────────────────────────────────────────────

/** Returns a resolved model instance ready to be passed to streamText(). */
export async function getModel(tier: ModelTier = "generation") {
  const { resolvedModel } = await getModelInstance(tier);
  return resolvedModel;
}

/** Returns provider and model name for the resolved tier — used for cost tracking. */
export async function getModelInfo(
  tier: ModelTier = "generation",
): Promise<{ providerId: ProviderId; model: string }> {
  const { providerId, model } = await getModelInstance(tier);
  return { providerId, model };
}

export { extractUsageTokens };
