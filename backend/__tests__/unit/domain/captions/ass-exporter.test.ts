import { describe, expect, test } from "bun:test";
import {
  cssToASS,
  deriveAssStyleName,
  generateASS,
  msToASSTime,
  serializeASS,
} from "../../../../src/domain/editor/export/ass-exporter";
import { SEEDED_CAPTION_PRESETS } from "../../../../src/domain/editor/captions/preset-seed";
import type { CaptionPage } from "../../../../src/domain/editor/captions/types";

const resolution = { width: 1080, height: 1920 };

const samplePages: CaptionPage[] = [
  {
    startMs: 0,
    endMs: 900,
    text: "hello world",
    tokens: [
      { text: "hello", startMs: 0, endMs: 300, index: 0 },
      { text: "world", startMs: 350, endMs: 900, index: 1 },
    ],
  },
];

describe("ass-exporter", () => {
  test("msToASSTime formats centiseconds", () => {
    expect(msToASSTime(3723456)).toBe("1:02:03.45");
  });

  test("cssToASS converts hex and alpha-aware rgba colors", () => {
    expect(cssToASS("#112233")).toEqual({
      color: "&H332211&",
      alpha: "&H00&",
    });
    expect(cssToASS("rgba(255, 255, 255, 0.5)")).toEqual({
      color: "&HFFFFFF&",
      alpha: "&H80&",
    });
  });

  test("generateASS emits plain text for full/static export styles", () => {
    const preset = SEEDED_CAPTION_PRESETS.find((item) => item.id === "clean-minimal")!;

    const events = generateASS(samplePages, preset, resolution, 2000, "Cap_clean");

    expect(events).toEqual([
      {
        startMs: 2000,
        endMs: 2900,
        styleName: "Cap_clean",
        text: "hello world",
      },
    ]);
  });

  test("generateASS emits karaoke tags for approximate export styles", () => {
    const preset = SEEDED_CAPTION_PRESETS.find((item) => item.id === "hormozi")!;

    const events = generateASS(samplePages, preset, resolution, 0, "Cap_hormozi");

    expect(events[0]?.text).toContain("{\\k30}hello");
    expect(events[0]?.text).toContain("{\\k55}world");
  });

  test("deriveAssStyleName changes when export-relevant overrides change", () => {
    const base = SEEDED_CAPTION_PRESETS.find((item) => item.id === "clean-minimal")!;
    const adjusted = {
      ...base,
      typography: {
        ...base.typography,
        fontSize: base.typography.fontSize + 8,
      },
    };

    expect(deriveAssStyleName(base)).not.toBe(deriveAssStyleName(adjusted));
  });

  test("serializeASS deduplicates styles and sorts events", () => {
    const preset = SEEDED_CAPTION_PRESETS.find((item) => item.id === "clean-minimal")!;
    const styleName = deriveAssStyleName(preset);
    const ass = serializeASS(
      [
        { startMs: 1500, endMs: 2200, text: "second", styleName },
        { startMs: 200, endMs: 800, text: "first", styleName },
      ],
      [
        { styleName, preset },
        { styleName, preset },
      ],
      resolution,
    );

    expect(ass).toContain("[V4+ Styles]");
    expect(ass.match(/^Style:/gm)?.length).toBe(1);
    expect(ass.indexOf("Dialogue: 0,0:00:00.20")).toBeLessThan(
      ass.indexOf("Dialogue: 0,0:00:01.50"),
    );
  });
});
