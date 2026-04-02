import type { CaptionPage, Token } from "./types";

const DEFAULT_GROUPING_MS = 1400;
const DEFAULT_GAP_THRESHOLD_MS = 800;

function joinPageText(tokens: Token[]): string {
  return tokens.map((token) => token.text).join(" ").trim();
}

function toPage(tokens: Token[]): CaptionPage {
  return {
    startMs: tokens[0]!.startMs,
    endMs: tokens[tokens.length - 1]!.endMs,
    tokens: tokens.map((token, index) => ({
      text: token.text,
      startMs: token.startMs,
      endMs: token.endMs,
      index,
    })),
    text: joinPageText(tokens),
  };
}

export function buildPages(
  tokens: Token[],
  groupingMs = DEFAULT_GROUPING_MS,
  gapThresholdMs = DEFAULT_GAP_THRESHOLD_MS,
): CaptionPage[] {
  if (tokens.length === 0) return [];

  const pages: CaptionPage[] = [];
  let current: Token[] = [];

  for (const token of tokens) {
    if (current.length === 0) {
      current.push(token);
      continue;
    }

    const prev = current[current.length - 1]!;
    const gapMs = token.startMs - prev.endMs;
    const wouldSpanMs = token.endMs - current[0]!.startMs;

    if (gapMs > gapThresholdMs || wouldSpanMs > groupingMs) {
      pages.push(toPage(current));
      current = [token];
      continue;
    }

    current.push(token);
  }

  if (current.length > 0) {
    pages.push(toPage(current));
  }

  return pages;
}
