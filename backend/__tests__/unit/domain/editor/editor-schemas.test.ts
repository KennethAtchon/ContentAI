import { describe, expect, test } from "bun:test";
import {
  editorStoredTracksSchema,
  manualCaptionDocSchema,
} from "@/domain/editor/editor.schemas";

describe("editor.schemas caption validation", () => {
  test("rejects caption clips with non-positive duration or inverted source range", () => {
    const result = editorStoredTracksSchema.safeParse([
      {
        id: "text",
        type: "text",
        name: "Text",
        muted: false,
        locked: false,
        transitions: [],
        clips: [
          {
            id: "caption-1",
            type: "caption",
            startMs: 0,
            durationMs: 0,
            originVoiceoverClipId: null,
            captionDocId: "cap-1",
            sourceStartMs: 1200,
            sourceEndMs: 1200,
            stylePresetId: "clean-minimal",
            styleOverrides: {},
            groupingMs: 1400,
          },
        ],
      },
    ]);

    expect(result.success).toBeFalse();
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        "Caption clip durationMs must be greater than 0",
        "Caption clip sourceStartMs must be less than sourceEndMs",
      ]),
    );
  });

  test("rejects overlapping manual caption tokens", () => {
    const result = manualCaptionDocSchema.safeParse({
      assetId: null,
      fullText: "hello world",
      language: "en",
      tokens: [
        { text: "hello", startMs: 0, endMs: 500 },
        { text: "world", startMs: 400, endMs: 900 },
      ],
    });

    expect(result.success).toBeFalse();
    expect(result.error?.issues.some((issue) => issue.message === "Tokens must not overlap")).toBe(
      true,
    );
  });

  test("rejects overlapping clips on the same track", () => {
    const result = editorStoredTracksSchema.safeParse([
      {
        id: "video",
        type: "video",
        name: "Video",
        muted: false,
        locked: false,
        transitions: [],
        clips: [
          {
            id: "clip-1",
            type: "video",
            assetId: "asset-1",
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
            type: "video",
            assetId: "asset-2",
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
      },
    ]);

    expect(result.success).toBeFalse();
    expect(
      result.error?.issues.some((issue) =>
        issue.message.includes('Clip "clip-2" overlaps with "clip-1"'),
      ),
    ).toBe(true);
  });
});
