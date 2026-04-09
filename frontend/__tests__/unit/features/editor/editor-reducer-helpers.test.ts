import { describe, expect, test } from "bun:test";
import { alignClipTrimEndToInvariant } from "@/features/editor/model/editor-reducer-helpers";
import type { Clip } from "@/features/editor/types/editor";

function mediaClip(overrides: Partial<Clip>): Clip {
  return {
    id: "clip-1",
    type: "audio",
    assetId: "asset-1",
    label: "Clip",
    startMs: 0,
    durationMs: 10_000,
    trimStartMs: 0,
    trimEndMs: 0,
    sourceMaxDurationMs: 10_000,
    speed: 1,
    enabled: true,
    opacity: 1,
    warmth: 0,
    contrast: 0,
    positionX: 0,
    positionY: 0,
    scale: 1,
    rotation: 0,
    volume: 1,
    muted: false,
    locallyModified: false,
    ...overrides,
  } as Clip;
}

describe("editor-reducer-helpers", () => {
  test("shrinks timeline duration when speed would overrun source media", () => {
    const clip = mediaClip({ speed: 2 });
    const aligned = alignClipTrimEndToInvariant(clip);
    expect(aligned.durationMs).toBe(5_000);
    expect(aligned.trimEndMs).toBe(0);
  });

  test("keeps slower clips within source bounds by updating trimEnd", () => {
    const clip = mediaClip({ durationMs: 8_000, speed: 0.5 });
    const aligned = alignClipTrimEndToInvariant(clip);
    expect(aligned.durationMs).toBe(8_000);
    expect(aligned.trimEndMs).toBe(6_000);
  });
});
