import { describe, expect, test } from "bun:test";
import { sliceTokensToRange } from "../../../../src/domain/editor/captions/slice-tokens";
import type { Token } from "../../../../src/domain/editor/captions/types";

describe("sliceTokensToRange", () => {
  test("keeps fully in-range tokens and rebases them", () => {
    const tokens: Token[] = [
      { text: "hello", startMs: 1000, endMs: 1300 },
      { text: "world", startMs: 1400, endMs: 1800 },
    ];

    expect(sliceTokensToRange(tokens, 1000, 2000)).toEqual([
      { text: "hello", startMs: 0, endMs: 300 },
      { text: "world", startMs: 400, endMs: 800 },
    ]);
  });

  test("clamps boundary-overlapping tokens before rebasing", () => {
    const tokens: Token[] = [
      { text: "left", startMs: 800, endMs: 1100 },
      { text: "middle", startMs: 1200, endMs: 1400 },
      { text: "right", startMs: 1450, endMs: 1800 },
    ];

    expect(sliceTokensToRange(tokens, 1000, 1500)).toEqual([
      { text: "left", startMs: 0, endMs: 100 },
      { text: "middle", startMs: 200, endMs: 400 },
      { text: "right", startMs: 450, endMs: 500 },
    ]);
  });

  test("drops tokens outside the selected range", () => {
    const tokens: Token[] = [
      { text: "before", startMs: 0, endMs: 100 },
      { text: "after", startMs: 900, endMs: 1000 },
    ];

    expect(sliceTokensToRange(tokens, 200, 800)).toEqual([]);
  });

  test("returns empty list for invalid range", () => {
    expect(sliceTokensToRange([], 1000, 1000)).toEqual([]);
  });
});
