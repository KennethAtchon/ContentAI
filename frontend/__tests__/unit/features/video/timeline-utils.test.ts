import { describe, expect, test } from "bun:test";
import {
  insertVideoItemAt,
  reorderVideoItems,
  setVideoItemDurationById,
  splitVideoItemAt,
} from "@/domains/video/lib/utils/timeline-utils";
import type { Timeline } from "@/domains/video/model/composition.types";

function makeTimeline(): Timeline {
  return {
    schemaVersion: 1,
    fps: 30,
    durationMs: 3000,
    tracks: {
      video: [
        { id: "clip-1", startMs: 0, endMs: 1000, assetId: "asset-a" },
        { id: "clip-2", startMs: 1000, endMs: 2000, assetId: "asset-b" },
        { id: "clip-3", startMs: 2000, endMs: 3000, assetId: "asset-c" },
      ],
      audio: [],
      text: [],
      captions: [],
    },
  };
}

describe("timeline utils", () => {
  test("reorders clips and normalizes starts", () => {
    const reordered = reorderVideoItems(makeTimeline(), 2, 0);
    expect(reordered.tracks.video[0]?.id).toBe("clip-3");
    expect(reordered.tracks.video[0]?.startMs).toBe(0);
    expect(reordered.tracks.video[1]?.startMs).toBe(
      reordered.tracks.video[0]?.endMs
    );
  });

  test("resizes clip by id and reflows timeline", () => {
    const resized = setVideoItemDurationById(makeTimeline(), "clip-2", 1600);
    const clip2 = resized.tracks.video.find((clip) => clip.id === "clip-2");
    expect((clip2?.endMs ?? 0) - (clip2?.startMs ?? 0)).toBe(1600);
    expect(resized.durationMs).toBeGreaterThan(3000);
  });

  test("splits selected clip at midpoint", () => {
    const split = splitVideoItemAt(makeTimeline(), "clip-2");
    expect(split.tracks.video.length).toBe(4);
    expect(
      split.tracks.video.some((clip) => clip.id.includes("clip-2-a-"))
    ).toBe(true);
    expect(
      split.tracks.video.some((clip) => clip.id.includes("clip-2-b-"))
    ).toBe(true);
  });

  test("inserts media at a specific index", () => {
    const inserted = insertVideoItemAt(makeTimeline(), {
      insertAtIndex: 1,
      assetId: "asset-new",
      durationMs: 800,
    });
    expect(inserted.tracks.video[1]?.assetId).toBe("asset-new");
    expect(inserted.tracks.video.length).toBe(4);
  });
});
