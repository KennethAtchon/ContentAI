import { describe, expect, test } from "bun:test";
import { buildPages } from "../../../../src/domain/editor/captions/page-builder";
import type { Token } from "../../../../src/domain/editor/captions/types";

describe("buildPages", () => {
  test("groups adjacent tokens until grouping window is exceeded", () => {
    const tokens: Token[] = [
      { word: "one", startMs: 0, endMs: 300 },
      { word: "two", startMs: 320, endMs: 650 },
      { word: "three", startMs: 700, endMs: 1100 },
      { word: "four", startMs: 1150, endMs: 1700 },
    ];

    const pages = buildPages(tokens, 1200, 800);

    expect(pages).toHaveLength(2);
    expect(pages[0]?.text).toBe("one two three");
    expect(pages[0]?.startMs).toBe(0);
    expect(pages[0]?.endMs).toBe(1100);
    expect(pages[1]?.text).toBe("four");
  });

  test("starts a new page when there is a natural pause gap", () => {
    const tokens: Token[] = [
      { word: "hello", startMs: 0, endMs: 250 },
      { word: "there", startMs: 1200, endMs: 1600 },
    ];

    const pages = buildPages(tokens, 2000, 800);

    expect(pages).toHaveLength(2);
    expect(pages[0]?.text).toBe("hello");
    expect(pages[1]?.text).toBe("there");
  });

  test("keeps a long single token as its own page", () => {
    const tokens: Token[] = [{ word: "superlong", startMs: 0, endMs: 2500 }];

    const pages = buildPages(tokens, 1200, 800);

    expect(pages).toHaveLength(1);
    expect(pages[0]?.startMs).toBe(0);
    expect(pages[0]?.endMs).toBe(2500);
  });

  test("returns empty list for empty input", () => {
    expect(buildPages([])).toEqual([]);
  });
});
