import { describe, expect, test } from "bun:test";
import {
  collectSnapTargets,
  findNearestSnap,
} from "@/features/editor/utils/snap-targets";
import type { Track } from "@/features/editor/types/editor";

const tracks: Track[] = [
  {
    id: "video",
    type: "video",
    name: "Video",
    muted: false,
    locked: false,
    transitions: [],
    clips: [
      {
        id: "clip-a",
        assetId: "a",
        label: "A",
        startMs: 1000,
        durationMs: 2000,
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
      },
      {
        id: "clip-b",
        assetId: "b",
        label: "B",
        startMs: 5000,
        durationMs: 1000,
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
      },
    ],
  },
];

describe("snap-targets", () => {
  test("collectSnapTargets includes playhead and clip boundaries, excluding dragged clip", () => {
    const targets = collectSnapTargets(tracks, "clip-a", 7000);
    expect(targets).toEqual([0, 5000, 6000, 7000]);
  });

  test("findNearestSnap returns nearest target within threshold", () => {
    expect(findNearestSnap(5985, [0, 5000, 6000], 20)).toBe(6000);
    expect(findNearestSnap(6030, [0, 5000, 6000], 20)).toBeNull();
  });
});
