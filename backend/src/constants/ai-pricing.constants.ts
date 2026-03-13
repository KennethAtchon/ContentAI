/**
 * Per-model token pricing (USD per 1M tokens).
 * Update when providers change their pricing.
 */

interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const AI_MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10.0 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gpt-4-turbo": { inputPerMillion: 10.0, outputPerMillion: 30.0 },
  // Anthropic Claude
  "claude-haiku-4-5-20251001": { inputPerMillion: 0.8, outputPerMillion: 4.0 },
  "claude-sonnet-4-6": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "claude-opus-4-6": { inputPerMillion: 15.0, outputPerMillion: 75.0 },
  // Fallback for unknown models
  default: { inputPerMillion: 0, outputPerMillion: 0 },
};

export function calculateAiCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): { inputCost: number; outputCost: number; totalCost: number } {
  const pricing = AI_MODEL_PRICING[model] ?? AI_MODEL_PRICING.default;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}
