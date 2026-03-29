import { describe, expect, test } from "bun:test";
import {
  hasCollision,
  clampMoveToFreeSpace,
  clampTrimEnd,
  clampTrimStart,
} from "@/features/editor/utils/clip-constraints";
import type { Clip, Track } from "@/features/editor/types/editor";

function makeClip(id: string, startMs: number, durationMs: number): Clip {
  return {
    id,
    assetId: id,
    label: id,
    startMs,
    durationMs,
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
  };
}

function makeTrack(clips: Clip[]): Track {
  return {
    id: "video",
    type: "video",
    name: "Video",
    muted: false,
    locked: false,
    transitions: [],
    clips,
  };
}

describe("clip-constraints", () => {
  test("hasCollision detects overlap", () => {
    const track = makeTrack([makeClip("a", 0, 1000), makeClip("b", 2000, 1000)]);
    expect(hasCollision(track, 900, 300)).toBeTrue();
    expect(hasCollision(track, 1000, 1000)).toBeFalse();
  });

  test("clampMoveToFreeSpace snaps to nearest side of collision", () => {
    const moving = makeClip("moving", 0, 1000);
    const track = makeTrack([moving, makeClip("block", 1000, 1000)]);
    expect(clampMoveToFreeSpace(track, "moving", 900, 1000)).toBe(0);
    expect(clampMoveToFreeSpace(track, "moving", 1300, 1000)).toBe(2000);
  });

  test("clampTrimEnd cannot overlap next clip", () => {
    const clip = makeClip("a", 1000, 1000);
    const track = makeTrack([clip, makeClip("b", 2500, 1000)]);
    expect(clampTrimEnd(track, clip, 2000)).toBe(1500);
  });

  test("clampTrimStart cannot move before previous clip end", () => {
    const clip = makeClip("b", 2000, 1000);
    const track = makeTrack([makeClip("a", 0, 1500), clip]);
    expect(clampTrimStart(track, clip, 1200)).toBe(1500);
    expect(clampTrimStart(track, clip, 1800)).toBe(1800);
  });
});

