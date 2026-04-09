import { describe, expect, test } from "bun:test";
import {
  splitTextIntoSegments,
  getActiveSegment,
  getTextClipPreviewDisplay,
} from "@/features/editor/utils/text-segments";

describe("splitTextIntoSegments", () => {
  test("single short sentence stays as one segment", () => {
    const segs = splitTextIntoSegments("Hello world", 3000);
    expect(segs).toHaveLength(1);
    expect(segs[0].text).toBe("Hello world");
    expect(segs[0].startMs).toBe(0);
    expect(segs[0].endMs).toBe(3000);
  });

  test("splits on sentence boundaries", () => {
    const segs = splitTextIntoSegments("Hello world. Go now.", 6000);
    expect(segs).toHaveLength(2);
    expect(segs[0].text).toBe("Hello world.");
    expect(segs[1].text).toBe("Go now.");
  });

  test("time is proportional to word count", () => {
    // "Hello world." = 2 words, "One two three four." = 4 words → 6 total
    // ms per word = 6000 / 6 = 1000
    const segs = splitTextIntoSegments(
      "Hello world. One two three four.",
      6000
    );
    expect(segs[0].endMs).toBe(2000); // 2 words × 1000ms
    expect(segs[1].startMs).toBe(2000);
    expect(segs[1].endMs).toBe(6000); // 4 words × 1000ms
  });

  test("long sentence splits by clause then chunks", () => {
    const text =
      "One two three four five six, seven eight nine ten eleven twelve";
    const segs = splitTextIntoSegments(text, 12000);
    // First clause ≤ MAX_WORDS (6 words: "One two three four five six,")
    // Second clause > MAX_WORDS → chunked into groups of 4
    expect(segs.length).toBeGreaterThan(1);
    for (const seg of segs) {
      expect(seg.text.split(/\s+/).length).toBeLessThanOrEqual(6);
    }
  });

  test("segments cover full duration (start to end)", () => {
    const text = "First sentence here. Second one. Third final sentence done.";
    const segs = splitTextIntoSegments(text, 9000);
    expect(segs[0].startMs).toBe(0);
    expect(segs[segs.length - 1].endMs).toBeCloseTo(9000, 0);
  });

  test("empty string returns one segment", () => {
    const segs = splitTextIntoSegments("", 3000);
    expect(segs).toHaveLength(1);
  });
});

describe("getActiveSegment", () => {
  test("returns correct segment at elapsed time", () => {
    const segs = splitTextIntoSegments("Hello world. Go now.", 6000);
    // segs[0]: 0–(2/4)*6000 = 0–3000, segs[1]: 3000–6000
    expect(getActiveSegment(segs, 0)).toBe("Hello world.");
    expect(getActiveSegment(segs, 1500)).toBe("Hello world.");
    expect(getActiveSegment(segs, 3000)).toBe("Go now.");
    expect(getActiveSegment(segs, 5999)).toBe("Go now.");
  });

  test("clamps to last segment when elapsed exceeds duration", () => {
    const segs = splitTextIntoSegments("Hello world.", 3000);
    expect(getActiveSegment(segs, 9999)).toBe("Hello world.");
  });
});

describe("getTextClipPreviewDisplay", () => {
  const text = "Hello world. Go now.";

  test("when textAutoChunk is false or undefined, returns full text (default off)", () => {
    expect(getTextClipPreviewDisplay(text, 6000, 0, false)).toBe(text);
    expect(getTextClipPreviewDisplay(text, 6000, 5000, false)).toBe(text);
    expect(getTextClipPreviewDisplay(text, 6000, 0, undefined)).toBe(text);
    expect(getTextClipPreviewDisplay(text, 6000, 3500, undefined)).toBe(text);
  });

  test("when textAutoChunk is true, uses timed segments", () => {
    expect(getTextClipPreviewDisplay(text, 6000, 0, true)).toBe("Hello world.");
    expect(getTextClipPreviewDisplay(text, 6000, 3500, true)).toBe("Go now.");
  });
});
