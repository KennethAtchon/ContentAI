import { describe, expect, test } from "bun:test";
import {
  buildMockDevReelShots,
  deriveUseClipAudioByIndex,
  durationSecondsToMs,
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

  test("parseScriptShots uses full script span up to product max (not capped at 10s)", () => {
    const script =
      "[0-20s] Long scene description that meets minimum length here";
    const result = parseScriptShots(script);
    expect(result).toHaveLength(1);
    expect(result[0]?.durationSeconds).toBe(20);
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

  test("durationSecondsToMs rounds fractional seconds for integer DB ms", () => {
    expect(durationSecondsToMs(15.021666666666667)).toBe(15022);
    expect(durationSecondsToMs(5)).toBe(5000);
  });

  test("buildMockDevReelShots returns four shots with requested duration", () => {
    const shots = buildMockDevReelShots("hook text", 4);
    expect(shots).toHaveLength(4);
    expect(shots.map((s) => s.shotIndex)).toEqual([0, 1, 2, 3]);
    expect(shots[0]?.durationSeconds).toBe(4);
    expect(shots[0]?.description).toContain("[mock 1/4]");
    expect(shots[0]?.description).toContain("hook text");
  });

  test("buildMockDevReelShots does not cap duration at 10 seconds", () => {
    const shots = buildMockDevReelShots("prompt", 15);
    expect(shots[0]?.durationSeconds).toBe(15);
  });
});
