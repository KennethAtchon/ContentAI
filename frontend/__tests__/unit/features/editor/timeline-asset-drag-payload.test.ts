import { describe, expect, test } from "bun:test";
import { parseTimelineAssetDragPayload } from "@/features/editor/utils/timeline-asset-drag-payload";

describe("parseTimelineAssetDragPayload", () => {
  test("parses valid payload", () => {
    expect(
      parseTimelineAssetDragPayload(
        JSON.stringify({
          assetId: "abc",
          type: "video_clip",
          durationMs: 12_000,
          label: "clip",
        })
      )
    ).toEqual({
      assetId: "abc",
      type: "video_clip",
      durationMs: 12_000,
      label: "clip",
    });
  });

  test("defaults duration when null", () => {
    const r = parseTimelineAssetDragPayload(
      JSON.stringify({
        assetId: "x",
        type: "music",
        durationMs: null,
        label: "",
      })
    );
    expect(r?.durationMs).toBe(5000);
  });

  test("rejects invalid json and bad shapes", () => {
    expect(parseTimelineAssetDragPayload("not json")).toBe(null);
    expect(parseTimelineAssetDragPayload("{}")).toBe(null);
    expect(
      parseTimelineAssetDragPayload(
        JSON.stringify({ assetId: "", type: "x", label: "" })
      )
    ).toBe(null);
  });

  test("clamps huge duration", () => {
    const r = parseTimelineAssetDragPayload(
      JSON.stringify({
        assetId: "a",
        type: "video_clip",
        durationMs: 999 * 24 * 60 * 60 * 1000,
        label: "",
      })
    );
    expect(r?.durationMs).toBe(24 * 60 * 60 * 1000);
  });
});
