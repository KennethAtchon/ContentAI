import { describe, expect, test } from "bun:test";
import type { Clip, Track, Transition } from "@/features/editor/types/editor";
import {
  buildActiveVideoClipIdsByTrackMap,
  effectiveHtmlMediaPlaybackRate,
  getClipSourceTimeSecondsAtTimelineTime,
  getIncomingTransitionStyle,
  getOutgoingTransitionStyle,
  isClipActiveAtTimelineTime,
  isIncomingDissolveOrWipePrerenderWindow,
  videoClipNeedsHeavyPreload,
} from "@/features/editor/utils/editor-composition";

function clip(p: Partial<Clip> & Pick<Clip, "id" | "startMs" | "durationMs">): Clip {
  return {
    type: "video",
    enabled: true,
    assetId: "asset-1",
    trimStartMs: 0,
    trimEndMs: 0,
    speed: 1,
    opacity: 1,
    scale: 1,
    rotation: 0,
    positionX: 0,
    positionY: 0,
    volume: 1,
    muted: false,
    label: "",
    ...p,
  } as Clip;
}

describe("editor-composition", () => {
  test("isClipActiveAtTimelineTime respects enabled and range", () => {
    const c = clip({
      id: "a",
      startMs: 1000,
      durationMs: 2000,
      enabled: true,
    });
    expect(isClipActiveAtTimelineTime(c, 500)).toBe(false);
    expect(isClipActiveAtTimelineTime(c, 1000)).toBe(true);
    expect(isClipActiveAtTimelineTime(c, 2999)).toBe(true);
    expect(isClipActiveAtTimelineTime(c, 3000)).toBe(false);
    expect(isClipActiveAtTimelineTime({ ...c, enabled: false }, 1500)).toBe(false);
  });

  test("getClipSourceTimeSecondsAtTimelineTime applies speed and trim", () => {
    const c = clip({
      id: "a",
      startMs: 0,
      durationMs: 10_000,
      trimStartMs: 500,
      speed: 2,
    });
    expect(getClipSourceTimeSecondsAtTimelineTime(c, 1000)).toBeCloseTo(2 + 0.5, 5);
  });

  test("buildActiveVideoClipIdsByTrackMap groups by track", () => {
    const vt: Track = {
      id: "v1",
      type: "video",
      name: "V1",
      muted: false,
      locked: false,
      clips: [
        clip({ id: "c1", startMs: 0, durationMs: 1000 }),
        clip({ id: "c2", startMs: 2000, durationMs: 1000 }),
      ],
      transitions: [],
    };
    const map = buildActiveVideoClipIdsByTrackMap([vt], 500);
    expect([...(map.get("v1") ?? [])]).toEqual(["c1"]);
  });

  test("getOutgoingTransitionStyle fades clipA over window", () => {
    const transitions: Transition[] = [
      {
        id: "t1",
        clipAId: "a",
        clipBId: "b",
        type: "fade",
        durationMs: 1000,
      },
    ];
    const c = clip({ id: "a", startMs: 0, durationMs: 5000 });
    expect(getOutgoingTransitionStyle(c, transitions, 3999)).toEqual({});
    const mid = getOutgoingTransitionStyle(c, transitions, 4500);
    expect(mid.opacity).toBeCloseTo(0.5, 5);
  });

  test("getIncomingTransitionStyle returns dissolve opacity for clipB", () => {
    const a = clip({ id: "a", startMs: 0, durationMs: 5000 });
    const b = clip({ id: "b", startMs: 4500, durationMs: 5000 });
    const transitions: Transition[] = [
      {
        id: "t1",
        clipAId: "a",
        clipBId: "b",
        type: "dissolve",
        durationMs: 1000,
      },
    ];
    expect(getIncomingTransitionStyle(b, transitions, [a, b], 3500)).toBe(null);
    const mid = getIncomingTransitionStyle(b, transitions, [a, b], 4500);
    expect(mid?.opacity).toBeCloseTo(0.5, 5);
  });

  test("isIncomingDissolveOrWipePrerenderWindow", () => {
    const a = clip({ id: "a", startMs: 0, durationMs: 5000 });
    const b = clip({ id: "b", startMs: 4500, durationMs: 5000 });
    const tr: Transition[] = [
      {
        id: "t1",
        clipAId: "a",
        clipBId: "b",
        type: "dissolve",
        durationMs: 1000,
      },
    ];
    expect(
      isIncomingDissolveOrWipePrerenderWindow(b, tr, [a, b], 4500)
    ).toBe(true);
    expect(
      isIncomingDissolveOrWipePrerenderWindow(b, tr, [a, b], 3500)
    ).toBe(false);
  });

  test("effectiveHtmlMediaPlaybackRate multiplies JKL and clip speed", () => {
    expect(effectiveHtmlMediaPlaybackRate(2, 2)).toBe(4);
    expect(effectiveHtmlMediaPlaybackRate(-1, 2)).toBe(-2);
    expect(effectiveHtmlMediaPlaybackRate(1, 1)).toBe(1);
  });

  test("videoClipNeedsHeavyPreload for active clip", () => {
    const c = clip({ id: "x", startMs: 0, durationMs: 1000 });
    const active = new Set(["x"]);
    expect(
      videoClipNeedsHeavyPreload(c, 500, [], [c], active)
    ).toBe(true);
  });
});
