import { describe, it, expect } from "bun:test";
import { buildVoiceoverTextForTts } from "../../../../src/features/audio/utils/build-voiceover-text-for-tts";

describe("buildVoiceoverTextForTts", () => {
  it("returns hook only when no clean script", () => {
    expect(
      buildVoiceoverTextForTts({ generatedHook: "Hook line", cleanScriptForAudio: null }),
    ).toBe("Hook line");
  });

  it("returns body only when no hook", () => {
    expect(
      buildVoiceoverTextForTts({ generatedHook: null, cleanScriptForAudio: "Body text here" }),
    ).toBe("Body text here");
  });

  it("returns empty string when both are null", () => {
    expect(
      buildVoiceoverTextForTts({ generatedHook: null, cleanScriptForAudio: null }),
    ).toBe("");
  });

  it("returns empty string when both are empty/whitespace", () => {
    expect(
      buildVoiceoverTextForTts({ generatedHook: "  ", cleanScriptForAudio: "   " }),
    ).toBe("");
  });

  it("joins hook and body with double newline", () => {
    const result = buildVoiceoverTextForTts({
      generatedHook: "Hook line",
      cleanScriptForAudio: "Body text here",
    });
    expect(result).toBe("Hook line\n\nBody text here");
  });

  it("deduplicates body when it equals hook (normalized)", () => {
    expect(
      buildVoiceoverTextForTts({
        generatedHook: "Same text",
        cleanScriptForAudio: "Same text",
      }),
    ).toBe("Same text");
  });

  it("deduplicates body when equal after whitespace normalization", () => {
    expect(
      buildVoiceoverTextForTts({
        generatedHook: "Same   text",
        cleanScriptForAudio: "  Same text  ",
      }),
    ).toBe("Same text");
  });

  it("strips bracket-prefixed lines from clean script body", () => {
    const result = buildVoiceoverTextForTts({
      generatedHook: "Hook",
      cleanScriptForAudio: "[0-3s] Body text here",
    });
    expect(result).toBe("Hook\n\nBody text here");
  });

  it("omits body when clean script is only bracket lines (empty after extract)", () => {
    expect(
      buildVoiceoverTextForTts({
        generatedHook: "Hook",
        cleanScriptForAudio: "[intro]\n[outro]",
      }),
    ).toBe("Hook");
  });

  it("does not include generated_caption", () => {
    const result = buildVoiceoverTextForTts({
      generatedHook: "Hook",
      cleanScriptForAudio: "Body",
    });
    expect(result).not.toContain("caption");
    expect(result).toBe("Hook\n\nBody");
  });

  it("returns hook when body is empty after trim", () => {
    expect(
      buildVoiceoverTextForTts({ generatedHook: "Hook", cleanScriptForAudio: "" }),
    ).toBe("Hook");
  });
});
