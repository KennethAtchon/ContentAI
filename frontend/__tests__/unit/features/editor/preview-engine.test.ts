import { describe, expect, test } from "bun:test";
import { buildAudioClipDescriptors } from "@/features/editor/engine/AudioMixer";
import { buildCompositorClips } from "@/features/editor/engine/PreviewEngine";
import type { Track, VideoClip } from "@/features/editor/types/editor";

describe("buildAudioClipDescriptors", () => {
  test("includes video, audio, and music clips with resolved asset URLs", () => {
    const tracks: Track[] = [
      {
        id: "video-track",
        type: "video",
        name: "Video",
        muted: false,
        locked: false,
        transitions: [],
        clips: [
          {
            id: "video-1",
            type: "video",
            label: "Video clip",
            enabled: true,
            locallyModified: false,
            startMs: 0,
            durationMs: 2000,
            trimStartMs: 100,
            trimEndMs: 0,
            assetId: "asset-video",
            volume: 0.8,
            muted: false,
            speed: 1.25,
            opacity: 1,
            warmth: 0,
            contrast: 0,
            positionX: 0,
            positionY: 0,
            scale: 1,
            rotation: 0,
          },
        ],
      },
      {
        id: "music-track",
        type: "music",
        name: "Music",
        muted: true,
        locked: false,
        transitions: [],
        clips: [
          {
            id: "music-1",
            type: "music",
            label: "Music clip",
            enabled: true,
            locallyModified: false,
            startMs: 500,
            durationMs: 4000,
            trimStartMs: 0,
            trimEndMs: 0,
            assetId: "asset-music",
            volume: 0.6,
            muted: false,
            speed: 1,
            opacity: 1,
            warmth: 0,
            contrast: 0,
            positionX: 0,
            positionY: 0,
            scale: 1,
            rotation: 0,
          },
        ],
      },
    ];

    const descriptors = buildAudioClipDescriptors(
      tracks,
      new Map([
        ["asset-video", "https://cdn.test/video.mp4"],
        ["asset-music", "https://cdn.test/music.mp3"],
      ])
    );

    expect(descriptors).toEqual([
      expect.objectContaining({
        clipId: "video-1",
        assetUrl: "https://cdn.test/video.mp4",
        trackId: "video-track",
        trackMuted: false,
        volume: 0.8,
        speed: 1.25,
      }),
      expect.objectContaining({
        clipId: "music-1",
        assetUrl: "https://cdn.test/music.mp3",
        trackId: "music-track",
        trackMuted: true,
        volume: 0.6,
      }),
    ]);
  });
});

describe("buildCompositorClips", () => {
  test("applies effect preview overrides and transition output", () => {
    const clipA: VideoClip = {
      id: "clip-a",
      type: "video",
      label: "A",
      enabled: true,
      locallyModified: false,
      startMs: 0,
      durationMs: 1000,
      trimStartMs: 0,
      trimEndMs: 0,
      assetId: "asset-a",
      volume: 1,
      muted: false,
      speed: 1,
      opacity: 1,
      warmth: 0,
      contrast: 0,
      positionX: 0,
      positionY: 0,
      scale: 1,
      rotation: 0,
    };
    const clipB: VideoClip = {
      ...clipA,
      id: "clip-b",
      startMs: 1000,
      durationMs: 1000,
      warmth: 20,
      contrast: 15,
      positionX: 12,
      positionY: -8,
      scale: 1.1,
      rotation: 4,
    };
    const tracks: Track[] = [
      {
        id: "video-track",
        type: "video",
        name: "Video",
        muted: false,
        locked: false,
        clips: [clipA, clipB],
        transitions: [
          {
            id: "transition-1",
            type: "dissolve",
            durationMs: 250,
            clipAId: "clip-a",
            clipBId: "clip-b",
          },
        ],
      },
    ];

    const clips = buildCompositorClips(tracks, 900, {
      clipId: "clip-b",
      patch: { opacity: 0.7, contrast: 20 },
    });

    expect(clips).toHaveLength(2);
    expect(clips[0]).toEqual(
      expect.objectContaining({
        clipId: "clip-a",
        opacity: 0.4,
      })
    );
    expect(clips[1]).toEqual(
      expect.objectContaining({
        clipId: "clip-b",
        opacity: 0.6,
        filter: expect.stringContaining("contrast(1.2)"),
        clipPath: null,
      })
    );
  });
});
