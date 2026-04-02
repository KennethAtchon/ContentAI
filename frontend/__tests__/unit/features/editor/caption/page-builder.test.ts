import { describe, expect, test } from "bun:test";
import { buildPages } from "@/features/editor/caption/page-builder";
import type { Token } from "@/features/editor/caption/types";

describe("buildPages", () => {
  test("groups nearby tokens until the grouping window is exceeded", () => {
    const tokens: Token[] = [
      { text: "one", startMs: 0, endMs: 300 },
      { text: "two", startMs: 340, endMs: 700 },
      { text: "three", startMs: 760, endMs: 1100 },
      { text: "four", startMs: 1200, endMs: 1700 },
    ];

    const pages = buildPages(tokens, 1200, 800);

    expect(pages).toHaveLength(2);
    expect(pages[0]?.text).toBe("one two three");
    expect(pages[1]?.text).toBe("four");
  });

  test("forces a new page on a natural pause", () => {
    const tokens: Token[] = [
      { text: "hello", startMs: 0, endMs: 200 },
      { text: "again", startMs: 1200, endMs: 1500 },
    ];

    const pages = buildPages(tokens, 2000, 800);

    expect(pages).toHaveLength(2);
  });
});
