import { describe, expect, test } from "bun:test";
import { applyCaptionStyleOverrides } from "@/features/editor/caption/apply-style-overrides";
import type { TextPreset } from "@/features/editor/caption/types";

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

describe("applyCaptionStyleOverrides", () => {
  test("applies supported overrides without mutating unrelated preset fields", () => {
    const result = applyCaptionStyleOverrides(preset, {
      fontSize: 72,
      positionY: 64,
      textTransform: "uppercase",
    });

    expect(result.typography.fontSize).toBe(72);
    expect(result.typography.textTransform).toBe("uppercase");
    expect(result.layout.positionY).toBe(64);
    expect(result.layout.alignment).toBe("center");
    expect(result.layers).toEqual(preset.layers);
  });
});
