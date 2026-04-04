import { describe, expect, test } from "bun:test";
import { renderFrame } from "@/features/editor/caption/renderer";
import type { CaptionLayout, CaptionPage, TextPreset } from "@/features/editor/caption/types";

interface DrawCall {
  kind: string;
  text?: string;
  fillStyle?: string;
  strokeStyle?: string;
  shadowColor?: string;
}

function createMockContext() {
  const calls: DrawCall[] = [];
  const stateStack: Array<Record<string, unknown>> = [];

  const ctx = {
    font: "",
    textBaseline: "alphabetic",
    textAlign: "left",
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    lineJoin: "miter",
    shadowColor: "transparent",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    globalAlpha: 1,
    save() {
      stateStack.push({
        fillStyle: this.fillStyle,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        lineJoin: this.lineJoin,
        shadowColor: this.shadowColor,
        shadowOffsetX: this.shadowOffsetX,
        shadowOffsetY: this.shadowOffsetY,
        shadowBlur: this.shadowBlur,
        globalAlpha: this.globalAlpha,
      });
    },
    restore() {
      const previous = stateStack.pop();
      if (!previous) return;
      Object.assign(this, previous);
    },
    translate() {},
    rotate() {},
    scale() {},
    beginPath() {},
    roundRect() {},
    fill() {
      calls.push({
        kind: "fill",
        fillStyle: this.fillStyle,
      });
    },
    fillRect() {
      calls.push({
        kind: "fillRect",
        fillStyle: this.fillStyle,
      });
    },
    fillText(text: string) {
      calls.push({
        kind: "fillText",
        text,
        fillStyle: this.fillStyle,
        shadowColor: this.shadowColor,
      });
    },
    strokeText(text: string) {
      calls.push({
        kind: "strokeText",
        text,
        strokeStyle: this.strokeStyle,
      });
    },
  } as unknown as CanvasRenderingContext2D;

  return { ctx, calls };
}

function makeLayout(): CaptionLayout {
  const page: CaptionPage = {
    startMs: 1000,
    endMs: 2000,
    text: "hello",
    tokens: [{ text: "hello", startMs: 1200, endMs: 1500, index: 0 }],
  };

  return {
    page,
    tokens: [
      {
        text: "hello",
        startMs: 1200,
        endMs: 1500,
        index: 0,
        x: 100,
        y: 300,
        width: 80,
        lineIndex: 0,
      },
    ],
    blockX: 100,
    blockY: 250,
    blockWidth: 80,
    blockHeight: 60,
    lineHeightPx: 60,
  };
}

function makePreset(layers: TextPreset["layers"]): TextPreset {
  return {
    id: "test",
    name: "Test",
    typography: {
      fontFamily: "Inter",
      fontWeight: 700,
      fontSize: 56,
      textTransform: "none",
      letterSpacing: 0,
      lineHeight: 1.2,
    },
    layers,
    layout: { alignment: "center", maxWidthPercent: 80, positionY: 80 },
    entryAnimation: null,
    exitAnimation: null,
    wordActivation: null,
    groupingMs: 1400,
    exportMode: "full",
  };
}

describe("renderFrame", () => {
  test("renders layers back-to-front", () => {
    const { ctx, calls } = createMockContext();
    const preset = makePreset([
      {
        id: "bg",
        type: "background",
        color: "#111111",
        padding: 8,
        radius: 0,
        mode: "word",
      },
      { id: "stroke", type: "stroke", color: "#222222", width: 2, join: "round" },
      { id: "fill", type: "fill", color: "#FFFFFF" },
    ]);

    renderFrame(ctx, makeLayout(), 1300, preset);

    expect(calls.map((call) => call.kind)).toEqual(["fillRect", "strokeText", "fillText"]);
  });

  test("applies active-token layer overrides before rendering", () => {
    const { ctx, calls } = createMockContext();
    const preset = {
      ...makePreset([{ id: "fill", type: "fill", color: "#FFFFFF" }]),
      wordActivation: {
        layerOverrides: [{ layerId: "fill", color: "#FF0000" }],
      },
    } satisfies TextPreset;

    renderFrame(ctx, makeLayout(), 1300, preset);

    expect(calls.find((call) => call.kind === "fillText")?.fillStyle).toBe("#FF0000");
  });

  test("renders shadow layers with shadow styling before fill", () => {
    const { ctx, calls } = createMockContext();
    const preset = makePreset([
      {
        id: "shadow",
        type: "shadow",
        color: "rgba(0,0,0,0.6)",
        offsetX: 0,
        offsetY: 2,
        blur: 6,
      },
      { id: "fill", type: "fill", color: "#FFFFFF" },
    ]);

    renderFrame(ctx, makeLayout(), 1300, preset);

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      kind: "fillText",
      fillStyle: "rgba(0,0,0,0.6)",
      shadowColor: "rgba(0,0,0,0.6)",
    });
    expect(calls[1]).toMatchObject({
      kind: "fillText",
      text: "hello",
      fillStyle: "#FFFFFF",
      shadowColor: "transparent",
    });
  });

  test("applies textTransform before drawing text layers", () => {
    const { ctx, calls } = createMockContext();
    const preset = {
      ...makePreset([{ id: "fill", type: "fill", color: "#FFFFFF" }]),
      typography: {
        ...makePreset([{ id: "fill", type: "fill", color: "#FFFFFF" }]).typography,
        textTransform: "uppercase" as const,
      },
    };

    renderFrame(ctx, makeLayout(), 1300, preset);

    expect(calls.find((call) => call.kind === "fillText")?.text).toBe("HELLO");
  });
});
