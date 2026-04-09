import { describe, expect, test } from "bun:test";
import { computeLayout } from "@/features/editor/caption/layout-engine";
import type { CaptionPage, TextPreset } from "@/features/editor/caption/types";

function makeContext(): CanvasRenderingContext2D {
  return {
    font: "",
    measureText(text: string) {
      return { width: text.length * 10 } as TextMetrics;
    },
  } as CanvasRenderingContext2D;
}

const preset: TextPreset = {
  id: "clean-minimal",
  name: "Clean Minimal",
  typography: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 56,
    textTransform: "none",
    letterSpacing: 0,
    lineHeight: 1.2,
  },
  layers: [{ id: "fill-base", type: "fill", color: "#FFFFFF" }],
  layout: { alignment: "center", maxWidthPercent: 50, positionY: 80 },
  entryAnimation: null,
  exitAnimation: null,
  wordActivation: null,
  groupingMs: 1400,
  exportMode: "full",
};

describe("computeLayout", () => {
  test("wraps tokens into multiple lines when max width is exceeded", () => {
    const page: CaptionPage = {
      startMs: 0,
      endMs: 1000,
      text: "hello world again",
      tokens: [
        { text: "hello", startMs: 0, endMs: 200, index: 0 },
        { text: "world", startMs: 220, endMs: 400, index: 1 },
        { text: "again", startMs: 420, endMs: 700, index: 2 },
      ],
    };

    const layout = computeLayout(makeContext(), page, preset, 200, 400);

    expect(
      new Set(layout.tokens.map((token) => token.lineIndex)).size
    ).toBeGreaterThan(1);
    expect(layout.blockHeight).toBeGreaterThan(layout.lineHeightPx);
  });

  test("positions the block near the configured Y anchor", () => {
    const page: CaptionPage = {
      startMs: 0,
      endMs: 500,
      text: "hello",
      tokens: [{ text: "hello", startMs: 0, endMs: 500, index: 0 }],
    };

    const layout = computeLayout(makeContext(), page, preset, 1080, 1920);

    expect(layout.blockY).toBeGreaterThan(1200);
  });

  test("measures transformed text for layout width", () => {
    const page: CaptionPage = {
      startMs: 0,
      endMs: 500,
      text: "hi",
      tokens: [{ text: "hi", startMs: 0, endMs: 500, index: 0 }],
    };
    const uppercasePreset: TextPreset = {
      ...preset,
      typography: {
        ...preset.typography,
        textTransform: "uppercase",
      },
    };
    const ctx = {
      font: "",
      measureText(text: string) {
        return { width: text === "HI" ? 40 : 10 } as TextMetrics;
      },
    } as CanvasRenderingContext2D;

    const layout = computeLayout(ctx, page, uppercasePreset, 1080, 1920);

    expect(layout.tokens[0]?.width).toBe(40);
  });
});
