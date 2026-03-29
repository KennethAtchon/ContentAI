import { describe, expect, test } from "bun:test";
import { composeOverlayText } from "../../../../src/domain/editor/build-initial-timeline";

describe("composeOverlayText", () => {
  test("uses hook when no voiceover body", () => {
    expect(
      composeOverlayText({
        generatedHook: "Hook line",
        voiceoverScript: null,
      }),
    ).toBe("Hook line");
  });

  test("joins hook and clean voiceover body", () => {
    expect(
      composeOverlayText({
        generatedHook: "Open",
        voiceoverScript: "Middle body for TTS.",
      }),
    ).toBe("Open\n\nMiddle body for TTS.");
  });

  test("skips clean when identical to hook", () => {
    expect(
      composeOverlayText({
        generatedHook: "Same text",
        voiceoverScript: "Same text",
      }),
    ).toBe("Same text");
  });

  test("uses clean alone when hook empty", () => {
    expect(
      composeOverlayText({
        generatedHook: null,
        voiceoverScript: "Narration only",
      }),
    ).toBe("Narration only");
  });

  test("returns empty when hook and voiceover absent", () => {
    expect(
      composeOverlayText({
        generatedHook: null,
        voiceoverScript: null,
      }),
    ).toBe("");
  });
});
