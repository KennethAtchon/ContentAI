import { describe, expect, test } from "bun:test";
import { sliceTokensToRange } from "@/features/editor/caption/slice-tokens";
import type { Token } from "@/features/editor/caption/types";

describe("sliceTokensToRange", () => {
  test("rebases in-range tokens", () => {
    const tokens: Token[] = [
      { text: "hello", startMs: 1000, endMs: 1300 },
      { text: "world", startMs: 1400, endMs: 1800 },
    ];

    expect(sliceTokensToRange(tokens, 1000, 2000)).toEqual([
      { text: "hello", startMs: 0, endMs: 300 },
      { text: "world", startMs: 400, endMs: 800 },
    ]);
  });

  test("clamps boundary-overlapping tokens", () => {
    const tokens: Token[] = [
      { text: "left", startMs: 800, endMs: 1100 },
      { text: "right", startMs: 1450, endMs: 1800 },
    ];

    expect(sliceTokensToRange(tokens, 1000, 1500)).toEqual([
      { text: "left", startMs: 0, endMs: 100 },
      { text: "right", startMs: 450, endMs: 500 },
    ]);
  });
});
