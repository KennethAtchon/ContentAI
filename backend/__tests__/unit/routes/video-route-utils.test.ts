import { describe, expect, test } from "bun:test";
import {
  buildMockDevReelShots,
  deriveUseClipAudioByIndex,
  extractCaptionSourceText,
  formatAssTime,
  parseScriptShots,
} from "../../../src/routes/video/utils";

describe("video route utils", () => {
  test("parseScriptShots parses timestamped script lines", () => {
    const script = [
      "[0-5s] First scene visual",
      "[5-10s] Second scene visual",
      "not a shot line",
      "[10-15s] Third scene visual",
    ].join("\n");

    const result = parseScriptShots(script);
    expect(result.length).toBe(3);
    expect(result[0]).toEqual({
      shotIndex: 0,
      description: "First scene visual",
      durationSeconds: 5,
    });
    expect(result[2]?.shotIndex).toBe(2);
  });

  test("extractCaptionSourceText removes timing tags and normalizes spacing", () => {
    const text = extractCaptionSourceText({
      cleanScriptForAudio: null,
      generatedScript: "[0-3s]  Hello   world \n[3-6s] This   is   content",
    });

    expect(text).toBe("Hello world This is content");
  });

  test("deriveUseClipAudioByIndex maps per-shot toggle values", () => {
    const flags = deriveUseClipAudioByIndex([
      { metadata: { useClipAudio: true } },
      { metadata: { useClipAudio: false } },
      { metadata: {} },
      { metadata: null },
    ] as any);

    expect(flags).toEqual([true, false, false, false]);
  });

  test("formatAssTime returns ASS timestamp shape", () => {
    expect(formatAssTime(65.42)).toBe("0:01:05.42");
  });

  test("buildMockDevReelShots returns four clamped shots", () => {
    const shots = buildMockDevReelShots("hook text", 4);
    expect(shots).toHaveLength(4);
    expect(shots.map((s) => s.shotIndex)).toEqual([0, 1, 2, 3]);
    expect(shots[0]?.durationSeconds).toBe(4);
    expect(shots[0]?.description).toContain("[mock 1/4]");
    expect(shots[0]?.description).toContain("hook text");
  });
});
