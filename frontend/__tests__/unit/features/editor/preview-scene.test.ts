import { describe, expect, test } from "bun:test";
import {
  computeAdaptiveMountWindowMs,
  derivePreviewScene,
} from "@/features/editor/scene/preview-scene";
import type { Track } from "@/features/editor/types/editor";

function makeTracks(clipCount = 2): Track[] {
  return [
    {
      id: "video-track-1",
      type: "video",
      name: "Video 1",
      muted: false,
      locked: false,
      transitions: [],
      clips: Array.from({ length: clipCount }, (_, index) => ({
        id: `video-${index + 1}`,
        type: "video" as const,
        label: `Video ${index + 1}`,
        enabled: true,
        speed: 1,
        opacity: 1,
        warmth: 0,
        contrast: 0,
        positionX: 0,
        positionY: 0,
        scale: 1,
        rotation: 0,
        assetId: `asset-${index + 1}`,
        trimStartMs: 0,
        trimEndMs: 0,
        volume: 1,
        muted: false,
        locallyModified: false,
        startMs: index * 1_000,
        durationMs: 1_000,
      })),
    },
    {
      id: "text-track",
      type: "text",
      name: "Text",
      muted: false,
      locked: false,
      transitions: [],
      clips: [
        {
          id: "text-1",
          type: "text" as const,
          label: "Text 1",
          enabled: true,
          speed: 1,
          opacity: 1,
          warmth: 0,
          contrast: 0,
          positionX: 20,
          positionY: 10,
          scale: 1,
          rotation: 0,
          textContent: "hello world",
          textAutoChunk: false,
          locallyModified: false,
          startMs: 0,
          durationMs: 2_000,
        },
      ],
    },
  ];
}

describe("preview scene", () => {
  test("shrinks the adaptive mount window for dense timelines", () => {
    expect(computeAdaptiveMountWindowMs(2)).toBe(12_000);
    expect(computeAdaptiveMountWindowMs(40)).toBeLessThan(12_000);
    expect(computeAdaptiveMountWindowMs(400)).toBe(6_000);
  });

  test("derives preview objects from tracks and effect overrides", () => {
    const scene = derivePreviewScene({
      assetUrlMap: new Map([["asset-1", "https://cdn.test/video-1.mp4"]]),
      currentTimeMs: 500,
      effectPreviewOverride: {
        clipId: "video-1",
        patch: { opacity: 0.4, warmth: 20 },
      },
      tracks: makeTracks(),
    });

    expect(scene.hasContent).toBe(true);
    expect(scene.videoObjects).toHaveLength(2);
    expect(scene.textObjects).toHaveLength(1);
    expect(scene.videoObjects[0]?.src).toBe("https://cdn.test/video-1.mp4");
    expect(scene.videoObjects[0]?.style.opacity).toBe(0.4);
    expect(scene.videoObjects[0]?.style.filter).toContain("hue-rotate");
    expect(scene.videoObjects[0]?.shouldMount).toBe(true);
  });
});
