import { describe, expect, test } from "bun:test";
import { evaluateClientExportCapability } from "@/features/editor/services/client-export";

describe("client export capability", () => {
  test("falls back when required browser export capabilities are unavailable", async () => {
    const capability = await evaluateClientExportCapability({
      tracks: [],
      assetUrlMap: new Map(),
      durationMs: 30_000,
      resolution: "1080x1920",
      fps: 30,
    });

    expect(capability.supported).toBe(false);
    expect(capability.reasons).toContain(
      "VideoEncoder is not available in this browser."
    );
  });
});
