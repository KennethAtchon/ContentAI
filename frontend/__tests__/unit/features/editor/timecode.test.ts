import { describe, expect, test } from "bun:test";
import {
  formatHHMMSSFF,
  parseTimecode,
} from "@/features/editor/utils/timecode";

describe("parseTimecode", () => {
  test("parses HH:MM:SS as hours:minutes:seconds (not min:sec:frames)", () => {
    expect(parseTimecode("01:30:00", 30)).toBe(5400000);
    expect(parseTimecode("00:01:00", 30)).toBe(60000);
  });

  test("parses HH:MM:SS:FF with frames", () => {
    expect(parseTimecode("00:00:01:15", 30)).toBe(1500);
  });

  test("parses MM:SS", () => {
    expect(parseTimecode("02:30", 30)).toBe(150000);
  });

  test("returns null for invalid input", () => {
    expect(parseTimecode("", 30)).toBe(null);
    expect(parseTimecode("abc", 30)).toBe(null);
  });
});

describe("formatHHMMSSFF", () => {
  test("round-trips with parseTimecode for frame boundary at 30fps", () => {
    const fps = 30;
    const ms = 61000;
    const s = formatHHMMSSFF(ms, fps);
    expect(parseTimecode(s, fps)).toBe(ms);
  });
});
