import { describe, expect, test } from "bun:test";
import { composeOverlayText } from "../../../../src/routes/editor/services/build-initial-timeline";

describe("composeOverlayText", () => {
  test("joins hook and caption with blank line", () => {
    expect(
      composeOverlayText({
        generatedHook: "Hook line",
        postCaption: "Social caption",
        voiceoverScript: null,
      }),
    ).toBe("Hook line\n\nSocial caption");
  });

  test("inserts clean script between hook and caption", () => {
    expect(
      composeOverlayText({
        generatedHook: "Open",
        postCaption: "CTA",
        voiceoverScript: "Middle body for TTS.",
      }),
    ).toBe("Open\n\nMiddle body for TTS.\n\nCTA");
  });

  test("skips clean when identical to hook", () => {
    expect(
      composeOverlayText({
        generatedHook: "Same text",
        postCaption: "Cap",
        voiceoverScript: "Same text",
      }),
    ).toBe("Same text\n\nCap");
  });

  test("uses clean alone when hook and caption empty", () => {
    expect(
      composeOverlayText({
        generatedHook: null,
        postCaption: null,
        voiceoverScript: "Narration only",
      }),
    ).toBe("Narration only");
  });

  test("returns empty when all absent", () => {
    expect(
      composeOverlayText({
        generatedHook: null,
        postCaption: null,
        voiceoverScript: null,
      }),
    ).toBe("");
  });
});
