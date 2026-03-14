import { streamText } from "ai";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { callAiWithFallback, getModelInstance, extractUsageTokens, trackAiCall } from "./ai/helpers";
import { DEFAULT_SETTINGS } from "./ai/config";

// ─── Prompt Loader ────────────────────────────────────────────────────────────

const promptCache: Record<string, string> = {};

/**
 * Load a prompt file by name from src/prompts/.
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

// ─── Unified Message Params ───────────────────────────────────────────────────

export interface AiMessage {
  system: string;
  userContent: string;
  maxTokens?: number;
  /** "analysis" = cheaper/fast model, "generation" = smarter model */
  modelTier?: "analysis" | "generation";
  /** Feature identifier for cost tracking */
  featureType?: string;
  /** Optional user ID for cost tracking */
  userId?: string;
  /** Extra metadata for cost tracking */
  metadata?: Record<string, unknown>;
}

export interface AiResponse {
  text: string;
  provider: "openrouter" | "openai" | "claude";
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// ─── callAi: Unified Provider Fallback ────────────────────────────────────

/**
 * Calls AI with automatic provider fallback and error handling.
 * Uses configuration-based provider priority: OpenRouter → OpenAI → Claude.
 */
export async function callAi(params: AiMessage): Promise<AiResponse> {
  const {
    system,
    userContent,
    maxTokens = DEFAULT_SETTINGS.maxTokens,
    modelTier = DEFAULT_SETTINGS.modelTier,
    featureType = DEFAULT_SETTINGS.featureType,
    userId,
    metadata,
  } = params;

  return callAiWithFallback({
    system,
    userContent,
    maxTokens,
    modelTier,
    featureType,
    userId,
    metadata,
  });
}

// ─── Helper Functions for Streaming ──────────────────────────────────────────

export function getModel(modelTier: "analysis" | "generation" = "generation") {
  const { instance } = getModelInstance(modelTier);
  return instance;
}

export function getModelInfo(
  modelTier: "analysis" | "generation" = "generation",
): { provider: "openrouter" | "openai" | "claude"; model: string } {
  const { provider, model } = getModelInstance(modelTier);
  return { provider, model };
}

export async function streamAi(params: AiMessage): Promise<any> {
  const {
    system,
    userContent,
    maxTokens = DEFAULT_SETTINGS.maxTokens,
    modelTier = "generation",
    featureType = DEFAULT_SETTINGS.featureType,
    userId,
    metadata,
  } = params;

  const { instance, provider, model } = getModelInstance(modelTier);
  const startMs = Date.now();

  return streamText({
    model: instance,
    system,
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
    maxOutputTokens: maxTokens,
    onFinish: async ({ usage }) => {
      const { inputTokens, outputTokens } = extractUsageTokens(usage);
      await trackAiCall({
        userId,
        provider,
        model,
        featureType,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startMs,
        metadata,
      });
    },
  });
}
