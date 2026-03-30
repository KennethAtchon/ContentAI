import { describe, expect, test } from "bun:test";
import type { TimelinePayload } from "../../../src/domain/video/video.schemas";
import {
  normalizeTimelineForPersistence,
  validateTimeline,
} from "../../../src/domain/video/timeline-validation";

function baseTimeline(
  overrides?: Partial<TimelinePayload>,
): TimelinePayload {
  return {
    schemaVersion: 1,
    fps: 30,
    durationMs: 10_000,
    tracks: {
      video: [{ id: "v1", startMs: 0, endMs: 5000 }],
      audio: [],
      text: [],
      captions: [],
    },
    ...overrides,
  };
}

describe("video timeline-validation", () => {
  test("validateTimeline reports missing video when track is empty", async () => {
    const issues = await validateTimeline({
      userId: "user-1",
      generatedContentId: 1,
      timeline: baseTimeline({
        tracks: {
          video: [],
          audio: [],
          text: [],
          captions: [],
        },
      }),
    });
    expect(issues.some((i) => i.code === "MISSING_VIDEO_SEGMENTS")).toBe(true);
  });

  test("validateTimeline returns no errors for a single clip without asset refs (no DB)", async () => {
    const issues = await validateTimeline({
      userId: "user-1",
      generatedContentId: 1,
      timeline: baseTimeline(),
    });
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  test("normalizeTimelineForPersistence caps duration and caption segments", () => {
    const timeline: TimelinePayload = {
      schemaVersion: 1,
      fps: 30,
      durationMs: 200_000,
      tracks: {
        video: [],
        audio: [],
        text: [],
        captions: [
          {
            segments: [
              { id: "c1", startMs: 0, endMs: 250_000 },
            ],
          } as Record<string, unknown>,
        ],
      },
    };
    const normalized = normalizeTimelineForPersistence(timeline);
    expect(normalized.durationMs).toBe(180_000);
    const cap = normalized.tracks.captions[0] as {
      segments: Array<{ startMs: number; endMs: number }>;
    };
    expect(cap.segments[0]?.endMs).toBe(180_000);
  });
});
