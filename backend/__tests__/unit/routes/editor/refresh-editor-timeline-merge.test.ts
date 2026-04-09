import { describe, expect, test } from "bun:test";
import {
  mergePlaceholdersWithRealClips,
  reconcileVideoClipsWithoutPlaceholders,
} from "../../../../src/domain/editor/timeline/merge-placeholders-with-assets";
import { normalizeMediaClipTrimFields } from "../../../../src/domain/editor/timeline/clip-trim";

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
    name: "Caption",
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
    expect(video.clips[0]!.trimEndMs).toBe(0);
    expect(video.clips[0]!.sourceMaxDurationMs).toBe(3000);
    expect(video.clips[1]!.assetId).toBe("asset-1");
    expect(video.clips[1]!.startMs).toBe(3000);
    expect(video.clips[1]!.durationMs).toBe(4000);
    expect(video.clips[1]!.trimEndMs).toBe(0);
    expect(video.clips[1]!.sourceMaxDurationMs).toBe(4000);
  });

  test("reconciles empty video track from assets (no placeholders)", () => {
    const tracks = structuredClone(baseTracks);
    const videoClips = [
      {
        id: "a1",
        role: "video_clip",
        durationMs: 2000,
        metadata: { shotIndex: 0 },
      },
      {
        id: "a2",
        role: "video_clip",
        durationMs: 3000,
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
    expect(video.clips[0]!.assetId).toBe("a1");
    expect(video.clips[0]!.startMs).toBe(0);
    expect(video.clips[1]!.assetId).toBe("a2");
    expect(video.clips[1]!.startMs).toBe(2000);
  });

  test("reconcile preserves clip id when a second asset appears", () => {
    const first = reconcileVideoClipsWithoutPlaceholders(
      [],
      [
        {
          id: "only",
          role: "video_clip",
          durationMs: 1000,
          metadata: { shotIndex: 0 },
        },
      ],
    );
    expect(first).toHaveLength(1);
    const id0 = first[0]!.id;

    const second = reconcileVideoClipsWithoutPlaceholders(first, [
      {
        id: "only",
        role: "video_clip",
        durationMs: 1000,
        metadata: { shotIndex: 0 },
      },
      {
        id: "new",
        role: "video_clip",
        durationMs: 2000,
        metadata: { shotIndex: 1 },
      },
    ]);
    expect(second).toHaveLength(2);
    expect(second[0]!.id).toBe(id0);
    expect(second[0]!.assetId).toBe("only");
    expect(second[1]!.assetId).toBe("new");
    expect(second[1]!.startMs).toBe(1000);
  });

  test("normalizeMediaClipTrimFields repairs legacy tail field duplicated as source length", () => {
    const out = normalizeMediaClipTrimFields(5000, {
      id: "c1",
      trimStartMs: 0,
      durationMs: 5000,
      trimEndMs: 5000,
    });
    expect(out.trimEndMs).toBe(0);
    expect(out.sourceMaxDurationMs).toBe(5000);
    expect(out.durationMs).toBe(5000);
  });

  test("reconcile normalizes stretched duration to asset source length", () => {
    const out = reconcileVideoClipsWithoutPlaceholders(
      [
        {
          id: "clip-1",
          assetId: "a1",
          startMs: 0,
          durationMs: 30_000,
          trimStartMs: 0,
          trimEndMs: 20_000,
        },
      ],
      [
        {
          id: "a1",
          role: "video_clip",
          durationMs: 20_000,
          metadata: { shotIndex: 0 },
        },
      ],
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.durationMs).toBe(20_000);
    expect(out[0]!.trimEndMs).toBe(0);
    expect(out[0]!.sourceMaxDurationMs).toBe(20_000);
  });

  test("reconcile pushes preserved starts rightward when they would overlap", () => {
    const out = reconcileVideoClipsWithoutPlaceholders(
      [
        {
          id: "clip-1",
          assetId: "a1",
          startMs: 0,
          durationMs: 3000,
          trimStartMs: 0,
          trimEndMs: 0,
        },
        {
          id: "clip-2",
          assetId: "a2",
          startMs: 1000,
          durationMs: 2000,
          trimStartMs: 0,
          trimEndMs: 0,
        },
      ],
      [
        {
          id: "a1",
          role: "video_clip",
          durationMs: 3000,
          metadata: { shotIndex: 0 },
        },
        {
          id: "a2",
          role: "video_clip",
          durationMs: 2000,
          metadata: { shotIndex: 1 },
        },
      ],
    );

    expect(out[0]!.startMs).toBe(0);
    expect(out[1]!.startMs).toBe(3000);
  });

  test("voiceover merge resolves overlap with user audio clips at zero", () => {
    const tracks = structuredClone(baseTracks);
    tracks[1]!.clips = [
      {
        id: "user-audio",
        type: "audio",
        assetId: "user-audio-asset",
        label: "User clip",
        startMs: 0,
        durationMs: 1000,
        trimStartMs: 0,
        trimEndMs: 0,
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
      },
    ];

    const out = mergePlaceholdersWithRealClips(
      tracks,
      [],
      {
        id: "voiceover-asset",
        role: "voiceover",
        durationMs: 3000,
        metadata: {},
      },
      undefined,
    );
    const audio = out.find((track) => track.type === "audio")!;
    expect(audio.clips).toHaveLength(2);
    expect(audio.clips[0]!.id).toBe("user-audio");
    expect(audio.clips[1]!.startMs).toBe(1000);
  });

  test("music merge resolves overlap with user music clips at zero", () => {
    const tracks = structuredClone(baseTracks);
    tracks[2]!.clips = [
      {
        id: "user-music",
        type: "music",
        assetId: "user-music-asset",
        label: "User music",
        startMs: 0,
        durationMs: 1500,
        trimStartMs: 0,
        trimEndMs: 0,
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
      },
    ];

    const out = mergePlaceholdersWithRealClips(tracks, [], undefined, {
      id: "music-asset",
      role: "background_music",
      durationMs: 3000,
      metadata: {},
    });
    const music = out.find((track) => track.type === "music")!;
    expect(music.clips).toHaveLength(2);
    expect(music.clips[0]!.id).toBe("user-music");
    expect(music.clips[1]!.startMs).toBe(1500);
  });
});
