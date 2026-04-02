import { describe, expect, test } from "bun:test";
import { sliceTokensToRange } from "../../../../src/domain/editor/captions/slice-tokens";
import type { Token } from "../../../../src/domain/editor/captions/types";

describe("sliceTokensToRange", () => {
  test("keeps fully in-range tokens and rebases them", () => {
    const tokens: Token[] = [
      { word: "hello", startMs: 1000, endMs: 1300 },
      { word: "world", startMs: 1400, endMs: 1800 },
    ];

    expect(sliceTokensToRange(tokens, 1000, 2000)).toEqual([
      { word: "hello", startMs: 0, endMs: 300 },
      { word: "world", startMs: 400, endMs: 800 },
    ]);
  });

  test("clamps boundary-overlapping tokens before rebasing", () => {
    const tokens: Token[] = [
      { word: "left", startMs: 800, endMs: 1100 },
      { word: "middle", startMs: 1200, endMs: 1400 },
      { word: "right", startMs: 1450, endMs: 1800 },
    ];

    expect(sliceTokensToRange(tokens, 1000, 1500)).toEqual([
      { word: "left", startMs: 0, endMs: 100 },
      { word: "middle", startMs: 200, endMs: 400 },
      { word: "right", startMs: 450, endMs: 500 },
    ]);
  });

  test("drops tokens outside the selected range", () => {
    const tokens: Token[] = [
      { word: "before", startMs: 0, endMs: 100 },
      { word: "after", startMs: 900, endMs: 1000 },
    ];

    expect(sliceTokensToRange(tokens, 200, 800)).toEqual([]);
  });

  test("returns empty list for invalid range", () => {
    expect(sliceTokensToRange([], 1000, 1000)).toEqual([]);
  });
});
