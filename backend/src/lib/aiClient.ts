import Anthropic from "@anthropic-ai/sdk";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, streamText } from "ai";
import {
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  ANALYSIS_MODEL,
  GENERATION_MODEL,
  OPENAI_MODEL,
} from "../utils/config/envUtil";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { debugLog } from "../utils/debug/debug";

// ─── Providers ────────────────────────────────────────────────────────────────

/** Legacy raw Anthropic SDK client — kept for backward compatibility */
export const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

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
}

export interface AiResponse {
  text: string;
  provider: "openai" | "claude";
  model: string;
}

// ─── callAi: OpenAI-first, Claude fallback ───────────────────────────────────

/**
 * Call OpenAI via the Vercel AI SDK. If OPENAI_API_KEY is not set or OpenAI
 * throws, automatically retries with Claude Anthropic (also via Vercel AI SDK).
 */
export async function callAi(params: AiMessage): Promise<AiResponse> {
  const {
    system,
    userContent,
    maxTokens = 1024,
    modelTier = "analysis",
  } = params;

  // ── Try OpenAI first (via Vercel AI SDK) ──
  if (openaiProvider) {
    try {
      const { text } = await generateText({
        model: openaiProvider(OPENAI_MODEL),
        system,
        prompt: userContent,
        maxOutputTokens: maxTokens,
      });

      debugLog.info("AI call succeeded via OpenAI", {
        service: "ai-client",
        operation: "callAi",
        model: OPENAI_MODEL,
      });

      return { text, provider: "openai", model: OPENAI_MODEL };
    } catch (err) {
      debugLog.warn("OpenAI call failed — falling back to Claude", {
        service: "ai-client",
        operation: "callAi",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── Fallback: Claude (via Vercel AI SDK) ──
  const claudeModel =
    modelTier === "generation" ? GENERATION_MODEL : ANALYSIS_MODEL;

  const { text } = await generateText({
    model: anthropicProvider(claudeModel),
    system,
    prompt: userContent,
    maxOutputTokens: maxTokens,
  });

  debugLog.info("AI call succeeded via Claude", {
    service: "ai-client",
    operation: "callAi",
    model: claudeModel,
  });

  return { text, provider: "claude", model: claudeModel };
}

// ─── Helper Functions for Streaming ───────────────────────────────────────

export function getModel(modelTier: "analysis" | "generation" = "generation") {
  // Prefer OpenAI if available, otherwise use Claude
  if (openaiProvider) {
    return openaiProvider(OPENAI_MODEL);
  }

  const claudeModel =
    modelTier === "generation" ? GENERATION_MODEL : ANALYSIS_MODEL;
  return anthropicProvider(claudeModel);
}

export async function streamAi(params: AiMessage): Promise<any> {
  const {
    system,
    userContent,
    maxTokens = 1024,
    modelTier = "generation",
  } = params;

  const model = getModel(modelTier);

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
  });
}
