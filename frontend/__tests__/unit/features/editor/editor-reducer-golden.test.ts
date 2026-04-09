import { describe, expect, test } from "bun:test";
import { editorReducer } from "@/features/editor/model/editor-reducer";
import {
  INITIAL_EDITOR_STATE,
  DEFAULT_TRACKS,
} from "@/features/editor/model/editor-reducer-helpers";
import type { Clip, EditProject, Track } from "@/features/editor/types/editor";

function baseProject(over: Partial<EditProject> = {}): EditProject {
  return {
    id: "p1",
    userId: "u1",
    title: "Test",
    generatedContentId: 1,
    tracks: DEFAULT_TRACKS,
    durationMs: 0,
    fps: 30,
    resolution: "1080x1920",
    createdAt: "",
    updatedAt: "2024-01-01T00:00:00Z",
    status: "draft",
    publishedAt: null,
    parentProjectId: null,
    ...over,
  };
}

describe("editorReducer golden paths", () => {
  test("LOAD_PROJECT uses max of server duration and clip extent", () => {
    const tracks: Track[] = DEFAULT_TRACKS.map((t) =>
      t.id === "video"
        ? {
            ...t,
            clips: [
              {
                id: "c1",
                locallyModified: false,
                assetId: "a1",
                type: "video",
                label: "x",
                startMs: 0,
                durationMs: 10_000,
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
              } satisfies Clip,
            ],
          }
        : t
    );
    const s0 = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject({ tracks, durationMs: 1000 }),
    });
    expect(s0.durationMs).toBe(10_000);
  });

  test("ADD_CLIP then UNDO restores tracks and duration", () => {
    let s = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject(),
    });
    const clip: Clip = {
      id: "nc",
      locallyModified: false,
      assetId: "a2",
      type: "video",
      label: "n",
      startMs: 0,
      durationMs: 5000,
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
    };
    s = editorReducer(s, { type: "ADD_CLIP", trackId: "video", clip });
    expect(s.tracks.find((t) => t.id === "video")?.clips).toHaveLength(1);
    expect(s.durationMs).toBe(5000);
    s = editorReducer(s, { type: "UNDO" });
    expect(s.tracks.find((t) => t.id === "video")?.clips).toHaveLength(0);
    expect(s.durationMs).toBe(0);
  });

  test("LOAD_PROJECT hydrates runtime-only local flags", () => {
    const tracks = DEFAULT_TRACKS.map((t) =>
      t.id === "text"
        ? {
            ...t,
            clips: [
              {
                id: "legacy-text",
                type: "text",
                label: "Legacy",
                startMs: 0,
                durationMs: 1500,
                speed: 1,
                enabled: true,
                opacity: 1,
                warmth: 0,
                contrast: 0,
                positionX: 0,
                positionY: 0,
                scale: 1,
                rotation: 0,
                textContent: "legacy",
                textAutoChunk: false,
              },
              {
                id: "legacy-caption",
                type: "caption",
                startMs: 0,
                durationMs: 1500,
                originVoiceoverClipId: null,
                captionDocId: "cap-1",
                sourceStartMs: 0,
                sourceEndMs: 1500,
                stylePresetId: "hormozi",
                styleOverrides: {},
                groupingMs: 1400,
              },
            ],
          }
        : t
    ) as unknown as Track[];

    const state = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject({ tracks }),
    });

    const textClip = state.tracks
      .find((t) => t.id === "text")
      ?.clips.find((clip) => clip.id === "legacy-text");
    const captionClip = state.tracks
      .find((t) => t.id === "text")
      ?.clips.find((clip) => clip.id === "legacy-caption");

    expect(textClip).toMatchObject({
      id: "legacy-text",
      locallyModified: false,
    });
    expect(captionClip).toMatchObject({
      id: "legacy-caption",
      locallyModified: false,
    });
  });

  test("SET_PLAYBACK_RATE and SELECT_CLIP", () => {
    let s = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject(),
    });
    s = editorReducer(s, { type: "SET_PLAYBACK_RATE", rate: -2 });
    expect(s.playbackRate).toBe(-2);
    s = editorReducer(s, { type: "SELECT_CLIP", clipId: "x" });
    expect(s.selectedClipId).toBe("x");
  });

  test("SET_PLAYBACK_RATE then UNDO restores previous rate", () => {
    let s = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject(),
    });
    expect(s.playbackRate).toBe(1);
    s = editorReducer(s, { type: "SET_PLAYBACK_RATE", rate: -2 });
    expect(s.playbackRate).toBe(-2);
    s = editorReducer(s, { type: "UNDO" });
    expect(s.playbackRate).toBe(1);
  });

  test("UPDATE_CLIP ignores fields from other clip variants", () => {
    const tracks: Track[] = DEFAULT_TRACKS.map((t) =>
      t.id === "text"
        ? {
            ...t,
            clips: [
              {
                id: "txt-1",
                locallyModified: false,
                type: "text",
                label: "Title",
                startMs: 0,
                durationMs: 3000,
                speed: 1,
                opacity: 1,
                enabled: true,
                warmth: 0,
                contrast: 0,
                positionX: 0,
                positionY: 0,
                scale: 1,
                rotation: 0,
                textContent: "Before",
                textAutoChunk: false,
              },
            ],
          }
        : t
    );

    const loaded = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject({ tracks }),
    });
    const updated = editorReducer(loaded, {
      type: "UPDATE_CLIP",
      clipId: "txt-1",
      patch: {
        textContent: "After",
        assetId: "asset-should-not-stick",
        captionDocId: "caption-should-not-stick",
      },
    });

    const textClip = updated.tracks
      .find((t) => t.id === "text")
      ?.clips.find((clip) => clip.id === "txt-1");

    expect(textClip).toMatchObject({
      id: "txt-1",
      type: "text",
      textContent: "After",
    });
    expect(textClip).not.toHaveProperty("assetId");
    expect(textClip).not.toHaveProperty("captionDocId");
  });

  test("ADD_CAPTION_CLIP adds a caption clip when the range is valid", () => {
    const loaded = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject(),
    });

    const updated = editorReducer(loaded, {
      type: "ADD_CAPTION_CLIP",
      trackId: "text",
      captionDocId: "cap-1",
      originVoiceoverClipId: "voice-1",
      startMs: 500,
      durationMs: 1500,
      sourceStartMs: 0,
      sourceEndMs: 1500,
      presetId: "clean-minimal",
      groupingMs: 1200,
    });

    const captionClip = updated.tracks
      .find((track) => track.id === "text")
      ?.clips.find((clip) => clip.type === "caption");

    expect(captionClip).toMatchObject({
      captionDocId: "cap-1",
      stylePresetId: "clean-minimal",
      groupingMs: 1200,
    });
  });

  test("LOAD_PROJECT self-heals overlapping clips", () => {
    const tracks = DEFAULT_TRACKS.map((track) =>
      track.id === "video"
        ? {
            ...track,
            clips: [
              {
                id: "clip-1",
                locallyModified: false,
                assetId: "a1",
                type: "video",
                label: "First",
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
              {
                id: "clip-2",
                locallyModified: false,
                assetId: "a2",
                type: "video",
                label: "Second",
                startMs: 500,
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
            ],
          }
        : track
    );

    const state = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject({ tracks }),
    });

    const videoTrack = state.tracks.find((track) => track.id === "video");
    expect(videoTrack?.clips[0]?.startMs).toBe(0);
    expect(videoTrack?.clips[1]?.startMs).toBe(1000);
  });

  test("LOAD_PROJECT preserves original order when clips share the same start", () => {
    const tracks = DEFAULT_TRACKS.map((track) =>
      track.id === "video"
        ? {
            ...track,
            clips: [
              {
                id: "z-clip",
                locallyModified: false,
                assetId: "a1",
                type: "video",
                label: "First inserted",
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
              {
                id: "a-clip",
                locallyModified: false,
                assetId: "a2",
                type: "video",
                label: "Second inserted",
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
            ],
          }
        : track
    );

    const state = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject({ tracks }),
    });

    const videoTrack = state.tracks.find((track) => track.id === "video");
    expect(videoTrack?.clips[0]?.id).toBe("z-clip");
    expect(videoTrack?.clips[1]).toMatchObject({
      id: "a-clip",
      startMs: 1000,
    });
  });

  test("UPDATE_CLIP moving onto another clip auto-resolves", () => {
    const loaded = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject({
        tracks: DEFAULT_TRACKS.map((track) =>
          track.id === "video"
            ? {
                ...track,
                clips: [
                  {
                    id: "clip-1",
                    locallyModified: false,
                    assetId: "a1",
                    type: "video",
                    label: "First",
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
                  {
                    id: "clip-2",
                    locallyModified: false,
                    assetId: "a2",
                    type: "video",
                    label: "Second",
                    startMs: 2000,
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
                ],
              }
            : track
        ),
      }),
    });

    const updated = editorReducer(loaded, {
      type: "UPDATE_CLIP",
      clipId: "clip-2",
      patch: { startMs: 500 },
    });

    const videoTrack = updated.tracks.find((track) => track.id === "video");
    expect(videoTrack?.clips[0]?.id).toBe("clip-1");
    expect(videoTrack?.clips[1]).toMatchObject({
      id: "clip-2",
      startMs: 1000,
    });
  });

  test("PASTE_CLIP on the same track does not overlap the source clip", () => {
    const loaded = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject({
        tracks: DEFAULT_TRACKS.map((track) =>
          track.id === "text"
            ? {
                ...track,
                clips: [
                  {
                    id: "text-1",
                    locallyModified: false,
                    type: "text",
                    label: "Title",
                    startMs: 0,
                    durationMs: 1000,
                    speed: 1,
                    enabled: true,
                    opacity: 1,
                    warmth: 0,
                    contrast: 0,
                    positionX: 0,
                    positionY: 0,
                    scale: 1,
                    rotation: 0,
                    textContent: "hello",
                    textAutoChunk: false,
                  },
                ],
              }
            : track
        ),
      }),
    });

    const copied = editorReducer(loaded, {
      type: "COPY_CLIP",
      clipId: "text-1",
    });
    const pasted = editorReducer(copied, {
      type: "PASTE_CLIP",
      trackId: "text",
      startMs: 0,
    });

    const textTrack = pasted.tracks.find((track) => track.id === "text");
    expect(textTrack?.clips).toHaveLength(2);
    expect(textTrack?.clips[0]?.startMs).toBe(0);
    expect(textTrack?.clips[1]?.startMs).toBe(1000);
  });

  test("MERGE_TRACKS_FROM_SERVER sanitizes conflicting local and server clips", () => {
    const loaded = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject({
        tracks: DEFAULT_TRACKS.map((track) =>
          track.id === "video"
            ? {
                ...track,
                clips: [
                  {
                    id: "local-user",
                    locallyModified: true,
                    assetId: "user-asset",
                    type: "video",
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
                    source: "user",
                  },
                ],
              }
            : track
        ),
      }),
    });

    const merged = editorReducer(loaded, {
      type: "MERGE_TRACKS_FROM_SERVER",
      tracks: DEFAULT_TRACKS.map((track) =>
        track.id === "video"
          ? {
              ...track,
              clips: [
                {
                  id: "server-content",
                  locallyModified: false,
                  assetId: "content-asset",
                  type: "video",
                  label: "Server clip",
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
              ],
            }
          : track
      ),
    });

    const videoTrack = merged.tracks.find((track) => track.id === "video");
    expect(videoTrack?.clips).toHaveLength(2);
    expect(videoTrack?.clips[0]?.id).toBe("server-content");
    expect(videoTrack?.clips[1]).toMatchObject({
      id: "local-user",
      startMs: 1000,
    });
  });

  test("rapid ADD_CLIP calls sequentialize overlapping imports", () => {
    let state = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject(),
    });

    for (const id of ["clip-1", "clip-2", "clip-3"]) {
      state = editorReducer(state, {
        type: "ADD_CLIP",
        trackId: "video",
        clip: {
          id,
          locallyModified: false,
          assetId: `${id}-asset`,
          type: "video",
          label: id,
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
      });
    }

    const videoTrack = state.tracks.find((track) => track.id === "video");
    expect(videoTrack?.clips.map((clip) => clip.startMs)).toEqual([
      0, 1000, 2000,
    ]);
  });

  test("DUPLICATE_CLIP on a non-contiguous track stays non-overlapping", () => {
    const loaded = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject({
        tracks: DEFAULT_TRACKS.map((track) =>
          track.id === "video"
            ? {
                ...track,
                clips: [
                  {
                    id: "clip-1",
                    locallyModified: false,
                    assetId: "a1",
                    type: "video",
                    label: "First",
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
                  {
                    id: "clip-2",
                    locallyModified: false,
                    assetId: "a2",
                    type: "video",
                    label: "Second",
                    startMs: 3000,
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
                ],
              }
            : track
        ),
      }),
    });

    const duplicated = editorReducer(loaded, {
      type: "DUPLICATE_CLIP",
      clipId: "clip-1",
    });

    const videoTrack = duplicated.tracks.find((track) => track.id === "video");
    expect(videoTrack?.clips).toHaveLength(3);
    expect(videoTrack?.clips.map((clip) => clip.startMs)).toEqual([
      0, 3000, 4000,
    ]);
  });

  test("ADD_CAPTION_CLIP ignores invalid local caption ranges", () => {
    const loaded = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject(),
    });

    const updated = editorReducer(loaded, {
      type: "ADD_CAPTION_CLIP",
      trackId: "text",
      captionDocId: "cap-1",
      originVoiceoverClipId: "voice-1",
      startMs: 500,
      durationMs: 0,
      sourceStartMs: 1000,
      sourceEndMs: 1000,
      presetId: "clean-minimal",
    });

    expect(updated).toBe(loaded);
    expect(
      updated.tracks.find((track) => track.id === "text")?.clips
    ).toHaveLength(0);
  });

  test("UPDATE_CAPTION_STYLE merges overrides and preserves the preset by default", () => {
    const tracks = DEFAULT_TRACKS.map((track) =>
      track.id === "text"
        ? {
            ...track,
            clips: [
              {
                id: "caption-1",
                type: "caption",
                startMs: 0,
                durationMs: 1500,
                locallyModified: false,
                originVoiceoverClipId: null,
                captionDocId: "cap-1",
                sourceStartMs: 0,
                sourceEndMs: 1500,
                stylePresetId: "clean-minimal",
                styleOverrides: { fontSize: 56 },
                groupingMs: 1400,
              },
            ],
          }
        : track
    ) as Track[];

    const loaded = editorReducer(INITIAL_EDITOR_STATE, {
      type: "LOAD_PROJECT",
      project: baseProject({ tracks }),
    });

    const updated = editorReducer(loaded, {
      type: "UPDATE_CAPTION_STYLE",
      clipId: "caption-1",
      overrides: { textTransform: "uppercase" },
      groupingMs: 900,
    });

    expect(
      updated.tracks.find((track) => track.id === "text")?.clips[0]
    ).toMatchObject({
      stylePresetId: "clean-minimal",
      styleOverrides: {
        fontSize: 56,
        textTransform: "uppercase",
      },
      groupingMs: 900,
      locallyModified: true,
    });
  });
});
