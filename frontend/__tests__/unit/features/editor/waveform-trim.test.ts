import { describe, expect, test } from "bun:test";
import { slicePeaksForClipTrim } from "@/features/editor/utils/waveform-trim";
import type { Clip } from "@/features/editor/types/editor";

function baseClip(overrides: Partial<Clip>): Clip {
  return {
    id: "c1",
    assetId: "a1",
    label: "x",
    startMs: 0,
    durationMs: 10_000,
    trimStartMs: 0,
    trimEndMs: 0,
    speed: 1,
    opacity: 1,
    warmth: 0,
    contrast: 0,
    positionX: 0,
    positionY: 0,
    scale: 1,
    rotation: 0,
    volume: 1,
    muted: false,
    sourceMaxDurationMs: 20_000,
    ...overrides,
  };
}

describe("slicePeaksForClipTrim", () => {
  test("clip spanning full source keeps all peaks", () => {
    const peaks = Float32Array.from({ length: 200 }, (_, i) => i / 200);
    const out = slicePeaksForClipTrim(
      peaks,
      baseClip({
        durationMs: 20_000,
        sourceMaxDurationMs: 20_000,
        trimStartMs: 0,
        trimEndMs: 0,
      })
    );
    expect(out!.length).toBe(200);
  });

  test("half-duration clip on full source uses half the peaks", () => {
    const peaks = Float32Array.from({ length: 200 }, (_, i) => i);
    const out = slicePeaksForClipTrim(
      peaks,
      baseClip({
        durationMs: 10_000,
        sourceMaxDurationMs: 20_000,
        trimStartMs: 0,
        trimEndMs: 10_000,
      })
    );
    expect(out!.length).toBe(100);
  });

  test("second half of source when left trim 50%", () => {
    const peaks = Float32Array.from({ length: 100 }, (_, i) => i);
    const out = slicePeaksForClipTrim(
      peaks,
      baseClip({
        trimStartMs: 10_000,
        durationMs: 10_000,
        trimEndMs: 0,
        sourceMaxDurationMs: 20_000,
      })
    );
    expect(out!.length).toBe(50);
    expect(out![0]).toBe(50);
    expect(out![49]).toBe(99);
  });

  test("first half when right trim 50%", () => {
    const peaks = Float32Array.from({ length: 100 }, (_, i) => i);
    const out = slicePeaksForClipTrim(
      peaks,
      baseClip({
        trimStartMs: 0,
        durationMs: 10_000,
        trimEndMs: 10_000,
        sourceMaxDurationMs: 20_000,
      })
    );
    expect(out!.length).toBe(50);
    expect(out![0]).toBe(0);
    expect(out![49]).toBe(49);
  });
});
