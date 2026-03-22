import type { CaptionWord } from "../../../infrastructure/database/drizzle/schema";

/**
 * ASS preset config for server-side subtitle generation.
 * Maps from the frontend's CaptionPreset to ASS V4+ Style fields.
 */
interface ASSPresetConfig {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  primaryColor: string; // ASS &HAABBGGRR format
  outlineColor: string; // ASS &HAABBGGRR format
  outlineWidth: number;
  backColor: string; // ASS &HAABBGGRR format
  borderStyle: number; // 1 = outline+shadow, 3 = opaque box
  positionY: number; // percentage (0-100)
  animation: "none" | "highlight" | "karaoke";
  activeColor?: string; // ASS &HAABBGGRR for highlight/karaoke active word
}

/**
 * Convert CSS hex color to ASS &HAABBGGRR format.
 * ASS uses BGR order with alpha prefix.
 */
function cssToASS(hex: string, alpha = 0): string {
  // Handle rgba(...) by extracting alpha
  if (hex.startsWith("rgba")) {
    const match = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
    if (match) {
      const r = parseInt(match[1]).toString(16).padStart(2, "0");
      const g = parseInt(match[2]).toString(16).padStart(2, "0");
      const b = parseInt(match[3]).toString(16).padStart(2, "0");
      const a = match[4]
        ? Math.round((1 - parseFloat(match[4])) * 255)
            .toString(16)
            .padStart(2, "0")
        : "00";
      return `&H${a.toUpperCase()}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}`;
    }
  }

  // Handle #RRGGBB
  const clean = hex.replace("#", "");
  const r = clean.substring(0, 2);
  const g = clean.substring(2, 4);
  const b = clean.substring(4, 6);
  const a = alpha.toString(16).padStart(2, "0");
  return `&H${a.toUpperCase()}${b.toUpperCase()}${g.toUpperCase()}${r.toUpperCase()}`;
}

/**
 * Map frontend preset IDs to ASS style configurations.
 */
const PRESET_TO_ASS: Record<string, ASSPresetConfig> = {
  "clean-white": {
    fontFamily: "Inter",
    fontSize: 48,
    bold: true,
    primaryColor: cssToASS("#FFFFFF"),
    outlineColor: cssToASS("#000000"),
    outlineWidth: 0,
    backColor: cssToASS("#000000", 128),
    borderStyle: 1,
    positionY: 80,
    animation: "none",
  },
  "bold-outline": {
    fontFamily: "Inter",
    fontSize: 56,
    bold: true,
    primaryColor: cssToASS("#FFFFFF"),
    outlineColor: cssToASS("#000000"),
    outlineWidth: 3,
    backColor: cssToASS("#000000", 128),
    borderStyle: 1,
    positionY: 80,
    animation: "none",
  },
  "box-dark": {
    fontFamily: "Inter",
    fontSize: 44,
    bold: true,
    primaryColor: cssToASS("#FFFFFF"),
    outlineColor: cssToASS("#000000"),
    outlineWidth: 0,
    backColor: cssToASS("#000000", 100),
    borderStyle: 3,
    positionY: 80,
    animation: "none",
  },
  "box-accent": {
    fontFamily: "Inter",
    fontSize: 44,
    bold: true,
    primaryColor: cssToASS("#111111"),
    outlineColor: cssToASS("#111111"),
    outlineWidth: 0,
    backColor: cssToASS("#FACC15"),
    borderStyle: 3,
    positionY: 80,
    animation: "none",
  },
  highlight: {
    fontFamily: "Inter",
    fontSize: 48,
    bold: true,
    primaryColor: cssToASS("#FFFFFF"),
    outlineColor: cssToASS("#000000"),
    outlineWidth: 2,
    backColor: cssToASS("#000000", 128),
    borderStyle: 1,
    positionY: 80,
    animation: "highlight",
    activeColor: cssToASS("#FACC15"),
  },
  karaoke: {
    fontFamily: "Inter",
    fontSize: 48,
    bold: true,
    primaryColor: cssToASS("#FFFFFF", 153), // 60% transparent for inactive
    outlineColor: cssToASS("#000000"),
    outlineWidth: 2,
    backColor: cssToASS("#000000", 128),
    borderStyle: 1,
    positionY: 80,
    animation: "karaoke",
    activeColor: cssToASS("#FFFFFF"),
  },
};

function getASSPreset(presetId: string): ASSPresetConfig {
  return PRESET_TO_ASS[presetId] ?? PRESET_TO_ASS["clean-white"];
}

function msToASSTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * Generate a complete ASS subtitle file from caption words and a preset.
 *
 * For "none" animation: groups of words appear/disappear as blocks.
 * For "highlight": each group is one Dialogue line; the active word uses
 *   ASS override tags to change its color inline.
 * For "karaoke": same as highlight but inactive words use the dim primary
 *   color and the active word uses the bright activeColor.
 */
export function generateASS(
  words: CaptionWord[],
  presetId: string,
  resolution: [number, number],
  groupSize: number,
  clipStartMs: number,
): string {
  const preset = getASSPreset(presetId);
  const [resW, resH] = resolution;
  const marginV = Math.round(resH * (1 - preset.positionY / 100));

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${resW}
PlayResY: ${resH}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${preset.fontFamily},${preset.fontSize},${preset.primaryColor},&H000000FF,${preset.outlineColor},${preset.backColor},${preset.bold ? 1 : 0},0,0,0,100,100,0,0,${preset.borderStyle},${preset.outlineWidth},0,2,10,10,${marginV},1
`;

  const events: string[] = [];
  events.push(
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  );

  for (let i = 0; i < words.length; i += groupSize) {
    const group = words.slice(i, i + groupSize);
    const start = msToASSTime(group[0].startMs + clipStartMs);
    const end = msToASSTime(group[group.length - 1].endMs + clipStartMs);

    let text: string;

    if (preset.animation === "highlight" || preset.animation === "karaoke") {
      const activeColor = preset.activeColor ?? preset.primaryColor;
      const tag = preset.animation === "karaoke" ? "kf" : "k";

      const parts = group.map((w) => {
        const durationCs = Math.round((w.endMs - w.startMs) / 10);
        return `{\\${tag}${durationCs}}${w.word}`;
      });

      text = `{\\1c${preset.primaryColor}\\2c${activeColor}}` + parts.join(" ");
    } else {
      text = group.map((w) => w.word).join(" ");
    }

    events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`);
  }

  return header + "[Events]\n" + events.join("\n") + "\n";
}
