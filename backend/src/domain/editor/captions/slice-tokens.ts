import type { Token } from "./types";

export function sliceTokensToRange(
  tokens: Token[],
  sourceStartMs: number,
  sourceEndMs: number,
): Token[] {
  if (sourceEndMs <= sourceStartMs) return [];

  return tokens
    .map((token) => ({
      text: token.text,
      startMs: Math.max(token.startMs, sourceStartMs),
      endMs: Math.min(token.endMs, sourceEndMs),
    }))
    .filter((token) => token.endMs > token.startMs)
    .map((token) => ({
      text: token.text,
      startMs: token.startMs - sourceStartMs,
      endMs: token.endMs - sourceStartMs,
    }));
}
