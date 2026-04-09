import { describe, expect, test } from "bun:test";
import { splitClip } from "@/features/editor/utils/split-clip";
import type { Clip } from "@/features/editor/types/editor";

function makeClip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: "clip-1",
    assetId: "asset-1",
    label: "Clip 1",
    startMs: 1000,
    durationMs: 4000,
    trimStartMs: 100,
    trimEndMs: 200,
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
    ...overrides,
  };
}

describe("splitClip", () => {
  test("returns null at left boundary", () => {
    const clip = makeClip();
    expect(splitClip(clip, clip.startMs)).toBeNull();
  });

  test("returns null at right boundary", () => {
    const clip = makeClip();
    expect(splitClip(clip, clip.startMs + clip.durationMs)).toBeNull();
  });

  test("splits clip at midpoint and preserves trim invariant", () => {
    const clip = makeClip();
    const result = splitClip(clip, 3000);
    expect(result).not.toBeNull();
    if (!result) return;

    const [a, b] = result;
    expect(a.durationMs).toBe(2000);
    expect(b.startMs).toBe(3000);
    expect(b.durationMs).toBe(2000);

    const sourceDuration = clip.trimStartMs + clip.durationMs + clip.trimEndMs;
    expect(a.trimStartMs + a.durationMs + a.trimEndMs).toBe(sourceDuration);
    expect(b.trimStartMs + b.durationMs + b.trimEndMs).toBe(sourceDuration);
  });
});
