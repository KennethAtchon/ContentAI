import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  estimateMp3DurationMs,
  estimateMp3DurationMsFromBufferSize,
} from "../../../../src/services/tts/mp3-duration";

describe("estimateMp3DurationMs", () => {
  it("returns near-actual duration for the dev mock voiceover fixture", () => {
    const buffer = readFileSync("fixtures/media/dev-mock-voiceover.mp3");
    const ms = estimateMp3DurationMs(buffer);

    // afinfo reports ~45.662s for this fixture.
    expect(ms).toBeGreaterThan(45_000);
    expect(ms).toBeLessThan(46_000);
  });

  it("falls back to byte-size heuristic when frame parsing is impossible", () => {
    const invalid = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
    const expected = estimateMp3DurationMsFromBufferSize(invalid.length);
    expect(estimateMp3DurationMs(invalid)).toBe(expected);
  });

  it("masks syncsafe ID3 bytes so malformed high-bit tags do not skip parsing", () => {
    const id3 = Buffer.from([
      0x49, 0x44, 0x33, // ID3
      0x04, 0x00, // v2.4.0
      0x00, // flags
      0x80, 0x00, 0x00, 0x00, // malformed syncsafe bytes (high bit set)
    ]);
    const frameHeader = Buffer.from([0xff, 0xfb, 0xe0, 0x00]); // MPEG1 L3, 320 kbps, 44.1 kHz
    const frameLength = 1044;
    const framePayload = Buffer.alloc(frameLength - frameHeader.length, 0);
    const frame = Buffer.concat([frameHeader, framePayload]);
    const body = Buffer.concat(new Array(10).fill(frame));
    const buffer = Buffer.concat([id3, body]);

    const ms = estimateMp3DurationMs(buffer);
    expect(ms).toBeGreaterThan(220);
    expect(ms).toBeLessThan(320);
  });
});
