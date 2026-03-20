import { db } from "../services/db/db";
import { aiCostLedger } from "../infrastructure/database/drizzle/schema";
import { calculateAiCost } from "../constants/ai-pricing.constants";
import { debugLog } from "../utils/debug/debug";

import type { ProviderId } from "./ai/providers";

export interface AiCostParams {
  userId?: string;
  provider: ProviderId;
  model: string;
  featureType: string;
  inputTokens: number;
  outputTokens: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Records an AI call's cost to the aiCostLedger table.
 * Fails silently — never blocks the main request.
 */
export async function recordAiCost(params: AiCostParams): Promise<void> {
  try {
    const { inputCost, outputCost, totalCost } = calculateAiCost(
      params.model,
      params.inputTokens,
      params.outputTokens,
    );

    await db.insert(aiCostLedger).values({
      userId: params.userId ?? null,
      provider: params.provider,
      model: params.model,
      featureType: params.featureType,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      inputCost: inputCost.toFixed(8),
      outputCost: outputCost.toFixed(8),
      totalCost: totalCost.toFixed(8),
      durationMs: params.durationMs ?? 0,
      metadata: params.metadata ?? null,
    });
  } catch (err) {
    debugLog.error("Failed to record AI cost", {
      service: "cost-tracker",
      operation: "recordAiCost",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
