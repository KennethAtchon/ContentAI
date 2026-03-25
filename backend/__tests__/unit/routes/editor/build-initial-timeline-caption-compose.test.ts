import { describe, expect, test } from "bun:test";
import { composeCaptionOverlayText } from "../../../../src/routes/editor/services/build-initial-timeline";

describe("composeCaptionOverlayText", () => {
  test("joins hook and caption with blank line", () => {
    expect(
      composeCaptionOverlayText({
        generatedHook: "Hook line",
        generatedCaption: "Social caption",
        cleanScriptForAudio: null,
      }),
    ).toBe("Hook line\n\nSocial caption");
  });

  test("inserts clean script between hook and caption", () => {
    expect(
      composeCaptionOverlayText({
        generatedHook: "Open",
        generatedCaption: "CTA",
        cleanScriptForAudio: "Middle body for TTS.",
      }),
    ).toBe("Open\n\nMiddle body for TTS.\n\nCTA");
  });

  test("skips clean when identical to hook", () => {
    expect(
      composeCaptionOverlayText({
        generatedHook: "Same text",
        generatedCaption: "Cap",
        cleanScriptForAudio: "Same text",
      }),
    ).toBe("Same text\n\nCap");
  });

  test("uses clean alone when hook and caption empty", () => {
    expect(
      composeCaptionOverlayText({
        generatedHook: null,
        generatedCaption: null,
        cleanScriptForAudio: "Narration only",
      }),
    ).toBe("Narration only");
  });

  test("returns empty when all absent", () => {
    expect(
      composeCaptionOverlayText({
        generatedHook: null,
        generatedCaption: null,
        cleanScriptForAudio: null,
      }),
    ).toBe("");
  });
});
