import { describe, expect, test } from "bun:test";
import { mergePlaceholdersWithRealClips } from "../../../../src/routes/editor/services/refresh-editor-timeline";

const baseTracks = [
  {
    id: "v1",
    type: "video" as const,
    name: "Video",
    muted: false,
    locked: false,
    clips: [] as Record<string, unknown>[],
    transitions: [] as unknown[],
  },
  {
    id: "a1",
    type: "audio" as const,
    name: "Voiceover",
    muted: false,
    locked: false,
    clips: [] as Record<string, unknown>[],
    transitions: [] as unknown[],
  },
  {
    id: "m1",
    type: "music" as const,
    name: "Music",
    muted: false,
    locked: false,
    clips: [] as Record<string, unknown>[],
    transitions: [] as unknown[],
  },
  {
    id: "t1",
    type: "text" as const,
    name: "Text",
    muted: false,
    locked: false,
    clips: [] as Record<string, unknown>[],
    transitions: [] as unknown[],
  },
];

describe("mergePlaceholdersWithRealClips", () => {
  test("assigns assets missing shotIndex by slot order and sequentializes starts", () => {
    const tracks = structuredClone(baseTracks);
    tracks[0]!.clips = [
      {
        id: "placeholder-shot-0",
        isPlaceholder: true,
        placeholderShotIndex: 0,
        placeholderLabel: "A",
        startMs: 0,
        durationMs: 5000,
        trimStartMs: 0,
        trimEndMs: 5000,
      },
      {
        id: "placeholder-shot-1",
        isPlaceholder: true,
        placeholderShotIndex: 1,
        placeholderLabel: "B",
        startMs: 5000,
        durationMs: 5000,
        trimStartMs: 0,
        trimEndMs: 5000,
      },
    ];

    const videoClips = [
      { id: "asset-0", role: "video_clip", durationMs: 3000, metadata: {} },
      {
        id: "asset-1",
        role: "video_clip",
        durationMs: 4000,
        metadata: { shotIndex: 1 },
      },
    ];

    const out = mergePlaceholdersWithRealClips(
      tracks,
      videoClips,
      undefined,
      undefined,
    );
    const video = out.find((t) => t.type === "video")!;
    expect(video.clips).toHaveLength(2);
    expect(video.clips[0]!.assetId).toBe("asset-0");
    expect(video.clips[0]!.startMs).toBe(0);
    expect(video.clips[0]!.durationMs).toBe(3000);
    expect(video.clips[1]!.assetId).toBe("asset-1");
    expect(video.clips[1]!.startMs).toBe(3000);
    expect(video.clips[1]!.durationMs).toBe(4000);
  });
});
