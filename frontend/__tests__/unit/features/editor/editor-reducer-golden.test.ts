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
    const s0 = editorReducer(
      INITIAL_EDITOR_STATE,
      {
        type: "LOAD_PROJECT",
        project: baseProject({ tracks, durationMs: 1000 }),
      }
    );
    expect(s0.durationMs).toBe(10_000);
  });

  test("ADD_CLIP then UNDO restores tracks and duration", () => {
    let s = editorReducer(
      INITIAL_EDITOR_STATE,
      { type: "LOAD_PROJECT", project: baseProject() }
    );
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
});
