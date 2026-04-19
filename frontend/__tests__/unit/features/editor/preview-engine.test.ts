import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  AudioMixer,
  buildAudioClipDescriptors,
} from "@/features/editor/engine/AudioMixer";
import {
  buildCompositorClips,
  PreviewEngine,
} from "@/features/editor/engine/PreviewEngine";
import { systemPerformance } from "@/shared/utils/system/performance";
import type {
  Track,
  VideoClip,
  TextClip,
} from "@/features/editor/types/editor";

class MockGainNode {
  gain = {
    value: 1,
    setValueAtTime: () => {},
  };

  connect(): void {}

  disconnect(): void {}
}

class MockAudioContext {
  state: AudioContextState = "running";
  currentTime = 0;
  baseLatency = 0;
  destination = {};
  decodeAudioData = mock(async () => ({ duration: 1 }) as AudioBuffer);

  createGain(): GainNode {
    return new MockGainNode() as unknown as GainNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    return {
      buffer: null,
      playbackRate: { value: 1 },
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
    } as unknown as AudioBufferSourceNode;
  }

  createMediaElementSource(): MediaElementAudioSourceNode {
    return {
      connect() {},
      disconnect() {},
    } as unknown as MediaElementAudioSourceNode;
  }

  resume(): Promise<void> {
    this.state = "running";
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    this.state = "suspended";
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = "closed";
    return Promise.resolve();
  }
}

describe("AudioMixer", () => {
  const originalWindow = (globalThis as { window?: typeof window }).window;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    (globalThis as { window?: typeof window }).window = {
      ...(originalWindow ?? {}),
      AudioContext: MockAudioContext as unknown as typeof AudioContext,
    } as typeof window;
  });

  afterEach(() => {
    if (originalWindow) {
      (globalThis as { window?: typeof window }).window = originalWindow;
    } else {
      delete (globalThis as { window?: typeof window }).window;
    }
    globalThis.fetch = originalFetch;
  });

  test("drops rejected decode promises so a later attempt can retry", async () => {
    let attempts = 0;
    globalThis.fetch = mock(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("network down");
      }

      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      } as Response;
    });

    const mixer = new AudioMixer();

    await expect(
      (
        mixer as unknown as {
          getDecodedBuffer(assetUrl: string): Promise<AudioBuffer>;
        }
      ).getDecodedBuffer("https://cdn.test/audio.mp3")
    ).rejects.toThrow("network down");

    const buffer = await (
      mixer as unknown as {
        getDecodedBuffer(assetUrl: string): Promise<AudioBuffer>;
      }
    ).getDecodedBuffer("https://cdn.test/audio.mp3");

    expect(buffer).toEqual(expect.objectContaining({ duration: 1 }));
    expect(attempts).toBe(2);

    mixer.destroy();
  });
});

describe("PreviewEngine performance metrics", () => {
  test("exposes decoder metrics and seek compositor latency in the debug snapshot", async () => {
    systemPerformance.clear();

    const engine = new PreviewEngine(
      {
        onTimeUpdate() {},
        onPlaybackEnd() {},
        onFrame(frame) {
          frame.close();
        },
        onTick() {},
        onClearFrames() {},
      },
      { canvasWidth: 1080, canvasHeight: 1920, fps: 30 }
    );

    engine.update([], new Map(), 2000, null, {
      canvasWidth: 1080,
      canvasHeight: 1920,
      fps: 30,
    });
    await engine.seek(500);

    const metrics = engine.getMetrics();
    const snapshot = window.__REEL_EDITOR_DEBUG__?.snapshot();
    const previewDebug = snapshot?.debug.previewEngine as
      | { metrics?: ReturnType<PreviewEngine["getMetrics"]> }
      | undefined;

    expect(metrics.decoderPool.activeDecoderCount).toBe(0);
    expect(metrics.lastSeekLatency).toEqual(
      expect.objectContaining({
        targetMs: 500,
        firstCompositorTickMs: expect.any(Number),
      })
    );
    expect(previewDebug?.metrics?.decoderPool.activeDecoderCount).toBe(0);

    engine.destroy();
    systemPerformance.clear();
  });
});

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
        sourceTimeUs: 0,
        opacity: 0.6,
        filter: expect.stringContaining("contrast(1.2)"),
        clipPath: null,
      })
    );
  });

  test("uses source-media time for trimmed and speed-adjusted clips", () => {
    const tracks: Track[] = [
      {
        id: "video-track",
        type: "video",
        name: "Video",
        muted: false,
        locked: false,
        clips: [
          {
            id: "clip-speed",
            type: "video",
            label: "Speed",
            enabled: true,
            locallyModified: false,
            startMs: 1000,
            durationMs: 2000,
            trimStartMs: 500,
            trimEndMs: 0,
            assetId: "asset-speed",
            volume: 1,
            muted: false,
            speed: 2,
            opacity: 1,
            warmth: 0,
            contrast: 0,
            positionX: 0,
            positionY: 0,
            scale: 1,
            rotation: 0,
          },
        ],
        transitions: [],
      },
    ];

    const [clip] = buildCompositorClips(tracks, 2000, null);

    expect(clip).toEqual(
      expect.objectContaining({
        clipId: "clip-speed",
        sourceTimeUs: 2_500_000,
      })
    );
  });
});

describe("PreviewEngine text overlays", () => {
  test("serializes active text clips using preview chunking rules", () => {
    const textClip: TextClip = {
      id: "text-1",
      type: "text",
      label: "Text",
      enabled: true,
      locallyModified: false,
      startMs: 0,
      durationMs: 6000,
      speed: 1,
      opacity: 0.8,
      warmth: 0,
      contrast: 0,
      positionX: 20,
      positionY: -40,
      scale: 1,
      rotation: 0,
      textContent: "Hello world. Go now.",
      textAutoChunk: true,
      textStyle: {
        fontSize: 40,
        fontWeight: "bold",
        color: "#fff",
        align: "center",
      },
    };
    const tracks: Track[] = [
      {
        id: "text-track",
        type: "text",
        name: "Text",
        muted: false,
        locked: false,
        clips: [textClip],
        transitions: [],
      },
    ];

    let payload:
      | {
          textObjects: Array<{
            text: string;
            x: number;
            y: number;
            opacity: number;
          }>;
        }
      | undefined;

    const engine = new PreviewEngine(
      {
        onTimeUpdate() {},
        onPlaybackEnd() {},
        onFrame(frame) {
          frame.close();
        },
        onTick(_playheadMs, _clips, textObjects) {
          payload = { textObjects };
        },
        onClearFrames() {},
      },
      { canvasWidth: 1080, canvasHeight: 1920, fps: 30 }
    );

    engine.update(tracks, new Map(), 6000, null, {
      canvasWidth: 1080,
      canvasHeight: 1920,
      fps: 30,
    });

    expect(payload?.textObjects).toEqual([
      expect.objectContaining({
        text: "Hello world.",
        x: 560,
        y: 920,
        opacity: 0.8,
      }),
    ]);

    engine.destroy();
  });

  test("emits caption bitmap updates once and then keeps rendering without resending", () => {
    const captionBitmap = {
      close: mock(() => {}),
    } as unknown as ImageBitmap;
    const captionFrames: Array<unknown> = [];

    const engine = new PreviewEngine(
      {
        onTimeUpdate() {},
        onPlaybackEnd() {},
        onFrame(frame) {
          frame.close();
        },
        onTick(_playheadMs, _clips, _textObjects, captionFrame) {
          captionFrames.push(captionFrame);
        },
        onClearFrames() {},
      },
      { canvasWidth: 1080, canvasHeight: 1920, fps: 30 }
    );

    engine.setCaptionFrame({ bitmap: captionBitmap });
    engine.renderCurrentFrame();
    engine.renderCurrentFrame();

    expect(captionFrames).toEqual([{ bitmap: captionBitmap }, undefined]);

    engine.destroy();
  });

  test("closes superseded caption bitmap updates before they are emitted", () => {
    const captionBitmapA = {
      close: mock(() => {}),
    } as unknown as ImageBitmap;
    const captionBitmapB = {
      close: mock(() => {}),
    } as unknown as ImageBitmap;

    const engine = new PreviewEngine(
      {
        onTimeUpdate() {},
        onPlaybackEnd() {},
        onFrame(frame) {
          frame.close();
        },
        onTick() {},
        onClearFrames() {},
      },
      { canvasWidth: 1080, canvasHeight: 1920, fps: 30 }
    );

    engine.setCaptionFrame({ bitmap: captionBitmapA });
    engine.setCaptionFrame({ bitmap: captionBitmapB });

    expect(captionBitmapA.close).toHaveBeenCalledTimes(1);
    expect(captionBitmapB.close).toHaveBeenCalledTimes(0);

    engine.destroy();
    expect(captionBitmapB.close).toHaveBeenCalledTimes(1);
  });
});
