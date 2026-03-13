import Anthropic from "@anthropic-ai/sdk";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, streamText } from "ai";
import {
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  OPEN_ROUTER_KEY,
  OPEN_ROUTER_MODEL,
  ANALYSIS_MODEL,
  GENERATION_MODEL,
  OPENAI_MODEL,
} from "../utils/config/envUtil";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { debugLog } from "../utils/debug/debug";
import { recordAiCost } from "./cost-tracker";

// ─── Providers ────────────────────────────────────────────────────────────────

/** Legacy raw Anthropic SDK client — kept for backward compatibility */
export const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const openRouterProvider = OPEN_ROUTER_KEY
  ? createOpenAI({
      apiKey: OPEN_ROUTER_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    })
  : null;

const openaiProvider = OPENAI_API_KEY
  ? createOpenAI({ apiKey: OPENAI_API_KEY })
  : null;

const anthropicProvider = createAnthropic({ apiKey: ANTHROPIC_API_KEY });

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

function extractUsageTokens(usage: unknown): {
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

// ─── callAi: OpenRouter → OpenAI → Claude ────────────────────────────────────

/**
 * Calls AI with provider priority: OpenRouter → OpenAI → Claude.
 * Falls back to the next provider on failure.
 */
export async function callAi(params: AiMessage): Promise<AiResponse> {
  const {
    system,
    userContent,
    maxTokens = 1024,
    modelTier = "analysis",
    featureType = "unknown",
    userId,
    metadata,
  } = params;

  // ── Try OpenRouter first ──
  if (openRouterProvider) {
    try {
      const startMs = Date.now();
      const { text, usage } = await generateText({
        model: openRouterProvider(OPEN_ROUTER_MODEL),
        system,
        prompt: userContent,
        maxOutputTokens: maxTokens,
      });
      const { inputTokens, outputTokens } = extractUsageTokens(usage);

      recordAiCost({
        userId,
        provider: "openrouter",
        model: OPEN_ROUTER_MODEL,
        featureType,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startMs,
        metadata,
      }).catch(() => {});

      debugLog.info("AI call succeeded via OpenRouter", {
        service: "ai-client",
        operation: "callAi",
        model: OPEN_ROUTER_MODEL,
      });

      return {
        text,
        provider: "openrouter",
        model: OPEN_ROUTER_MODEL,
        inputTokens,
        outputTokens,
      };
    } catch (err) {
      debugLog.warn("OpenRouter call failed — falling back to OpenAI", {
        service: "ai-client",
        operation: "callAi",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Try OpenAI ──
  if (openaiProvider) {
    try {
      const startMs = Date.now();
      const { text, usage } = await generateText({
        model: openaiProvider(OPENAI_MODEL),
        system,
        prompt: userContent,
        maxOutputTokens: maxTokens,
      });
      const { inputTokens, outputTokens } = extractUsageTokens(usage);

      recordAiCost({
        userId,
        provider: "openai",
        model: OPENAI_MODEL,
        featureType,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startMs,
        metadata,
      }).catch(() => {});

      debugLog.info("AI call succeeded via OpenAI", {
        service: "ai-client",
        operation: "callAi",
        model: OPENAI_MODEL,
      });

      return {
        text,
        provider: "openai",
        model: OPENAI_MODEL,
        inputTokens,
        outputTokens,
      };
    } catch (err) {
      debugLog.warn("OpenAI call failed — falling back to Claude", {
        service: "ai-client",
        operation: "callAi",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Fallback: Claude ──
  const claudeModel =
    modelTier === "generation" ? GENERATION_MODEL : ANALYSIS_MODEL;

  const startMs = Date.now();
  const { text, usage } = await generateText({
    model: anthropicProvider(claudeModel),
    system,
    prompt: userContent,
    maxOutputTokens: maxTokens,
  });
  const { inputTokens, outputTokens } = extractUsageTokens(usage);

  recordAiCost({
    userId,
    provider: "claude",
    model: claudeModel,
    featureType,
    inputTokens,
    outputTokens,
    durationMs: Date.now() - startMs,
    metadata,
  }).catch(() => {});

  debugLog.info("AI call succeeded via Claude", {
    service: "ai-client",
    operation: "callAi",
    model: claudeModel,
  });

  return {
    text,
    provider: "claude",
    model: claudeModel,
    inputTokens,
    outputTokens,
  };
}

// ─── Helper Functions for Streaming ──────────────────────────────────────────

export function getModel(modelTier: "analysis" | "generation" = "generation") {
  if (openRouterProvider) return openRouterProvider(OPEN_ROUTER_MODEL);
  if (openaiProvider) return openaiProvider(OPENAI_MODEL);
  const claudeModel =
    modelTier === "generation" ? GENERATION_MODEL : ANALYSIS_MODEL;
  return anthropicProvider(claudeModel);
}

export function getModelInfo(
  modelTier: "analysis" | "generation" = "generation",
): { provider: "openrouter" | "openai" | "claude"; model: string } {
  if (openRouterProvider)
    return { provider: "openrouter", model: OPEN_ROUTER_MODEL };
  if (openaiProvider) return { provider: "openai", model: OPENAI_MODEL };
  const model = modelTier === "generation" ? GENERATION_MODEL : ANALYSIS_MODEL;
  return { provider: "claude", model };
}

export async function streamAi(params: AiMessage): Promise<any> {
  const {
    system,
    userContent,
    maxTokens = 1024,
    modelTier = "generation",
    featureType = "unknown",
    userId,
    metadata,
  } = params;

  const model = getModel(modelTier);
  const modelInfo = getModelInfo(modelTier);
  const startMs = Date.now();

  return streamText({
    model,
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
      await recordAiCost({
        userId,
        provider: modelInfo.provider,
        model: modelInfo.model,
        featureType,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startMs,
        metadata,
      }).catch(() => {});
    },
  });
}
