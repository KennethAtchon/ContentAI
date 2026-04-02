import { createHash } from "crypto";
import type {
  CaptionPage,
  FillLayer,
  StrokeLayer,
  StyleLayer,
  TextPreset,
} from "../captions/types";

export interface ExportResolution {
  width: number;
  height: number;
}

export interface AssEvent {
  startMs: number;
  endMs: number;
  text: string;
  styleName: string;
}

export interface AssStyleDef {
  styleName: string;
  preset: TextPreset;
}

export interface AssColor {
  color: string;
  alpha: string;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function applyTextTransform(
  text: string,
  textTransform: TextPreset["typography"]["textTransform"],
): string {
  switch (textTransform) {
    case "uppercase":
      return text.toUpperCase();
    case "lowercase":
      return text.toLowerCase();
    default:
      return text;
  }
}

function parseCssColor(input: string): { r: number; g: number; b: number; a: number } {
  const normalized = input.trim().toLowerCase();
  if (normalized === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const shorthandHex = normalized.match(/^#([0-9a-f]{3})$/i);
  if (shorthandHex) {
    const value = shorthandHex[1]!;
    return parseCssColor(
      `#${value
        .split("")
        .map((char) => `${char}${char}`)
        .join("")}`,
    );
  }

  const hex = normalized.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const value = hex[1]!;
    return {
      r: Number.parseInt(value.slice(0, 2), 16),
      g: Number.parseInt(value.slice(2, 4), 16),
      b: Number.parseInt(value.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgb = normalized.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\s*\)$/i,
  );
  if (rgb) {
    return {
      r: clampByte(Number(rgb[1])),
      g: clampByte(Number(rgb[2])),
      b: clampByte(Number(rgb[3])),
      a: rgb[4] === undefined ? 1 : Math.max(0, Math.min(1, Number(rgb[4]))),
    };
  }

  throw new Error(`Unsupported CSS color: ${input}`);
}

export function cssToASS(input: string): AssColor {
  const { r, g, b, a } = parseCssColor(input);
  const alpha = clampByte((1 - a) * 255)
    .toString(16)
    .toUpperCase()
    .padStart(2, "0");
  const color = `&H${b.toString(16).toUpperCase().padStart(2, "0")}${g
    .toString(16)
    .toUpperCase()
    .padStart(2, "0")}${r.toString(16).toUpperCase().padStart(2, "0")}&`;
  return { color, alpha: `&H${alpha}&` };
}

export function msToASSTime(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const centiseconds = Math.floor((total % 1000) / 10);
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\n/g, "\\N");
}

function scaleForResolution(resolution: ExportResolution): number {
  return Math.min(resolution.width / 1080, resolution.height / 1920);
}

function findLayer<T extends StyleLayer["type"]>(
  layers: StyleLayer[],
  type: T,
): Extract<StyleLayer, { type: T }> | undefined {
  return [...layers].reverse().find(
    (layer): layer is Extract<StyleLayer, { type: T }> => layer.type === type,
  );
}

function toAssAlignment(alignment: TextPreset["layout"]["alignment"]): number {
  if (alignment === "left") return 1;
  if (alignment === "right") return 3;
  return 2;
}

function toStyleLine(
  styleName: string,
  preset: TextPreset,
  resolution: ExportResolution,
): string {
  const scale = scaleForResolution(resolution);
  const fill = findLayer(preset.layers, "fill") as FillLayer | undefined;
  const stroke = findLayer(preset.layers, "stroke") as StrokeLayer | undefined;
  const shadow = findLayer(preset.layers, "shadow");
  const background = findLayer(preset.layers, "background");

  const primary = cssToASS(fill?.color ?? "#FFFFFF");
  const secondary = cssToASS(
    fill?.stateColors?.active ?? fill?.color ?? "#FFFFFF",
  );
  const outline = cssToASS(stroke?.color ?? "#000000");
  const back = cssToASS(background?.color ?? "rgba(0,0,0,0.5)");
  const marginV = Math.max(
    20,
    Math.round(
      resolution.height - resolution.height * (preset.layout.positionY / 100),
    ),
  );

  return [
    "Style:",
    styleName,
    preset.typography.fontFamily,
    Math.round(preset.typography.fontSize * scale),
    primary.color,
    secondary.color,
    outline.color,
    back.color,
    preset.typography.fontWeight >= 700 ? -1 : 0,
    0,
    0,
    0,
    100,
    100,
    Math.round(preset.typography.letterSpacing * 100),
    0,
    background ? 3 : 1,
    Math.max(0, Math.round((stroke?.width ?? 0) * scale)),
    Math.max(0, Math.round((shadow?.blur ?? shadow?.offsetY ?? 0) * scale)),
    toAssAlignment(preset.layout.alignment),
    30,
    30,
    marginV,
    1,
  ].join(",");
}

export function generateASS(
  pages: CaptionPage[],
  preset: TextPreset,
  _resolution: ExportResolution,
  clipStartMs: number,
  styleName: string,
): AssEvent[] {
  return pages.map((page) => ({
    startMs: clipStartMs + page.startMs,
    endMs: clipStartMs + page.endMs,
    styleName,
    text:
      preset.exportMode === "approximate"
        ? page.tokens
            .map((token) => {
              const durationCs = Math.max(
                1,
                Math.round((token.endMs - token.startMs) / 10),
              );
              return `{\\k${durationCs}}${escapeAssText(
                applyTextTransform(token.text, preset.typography.textTransform),
              )}`;
            })
            .join(" ")
        : escapeAssText(
            applyTextTransform(page.text, preset.typography.textTransform),
          ),
  }));
}

export function deriveAssStyleName(preset: TextPreset): string {
  const digest = createHash("sha1")
    .update(JSON.stringify(preset))
    .digest("hex")
    .slice(0, 10);
  return `Cap_${preset.id}_${digest}`;
}

export function serializeASS(
  events: AssEvent[],
  styles: AssStyleDef[],
  resolution: ExportResolution,
): string {
  const uniqueStyles = new Map<string, AssStyleDef>();
  for (const style of styles) {
    uniqueStyles.set(style.styleName, style);
  }

  const sortedEvents = [...events].sort((a, b) => {
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    if (a.endMs !== b.endMs) return a.endMs - b.endMs;
    return a.styleName.localeCompare(b.styleName);
  });

  const styleLines = [...uniqueStyles.values()]
    .sort((a, b) => a.styleName.localeCompare(b.styleName))
    .map((style) => toStyleLine(style.styleName, style.preset, resolution));

  const eventLines = sortedEvents.map(
    (event) =>
      `Dialogue: 0,${msToASSTime(event.startMs)},${msToASSTime(event.endMs)},${event.styleName},,0,0,0,,${event.text}`,
  );

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${resolution.width}`,
    `PlayResY: ${resolution.height}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    ...styleLines,
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    ...eventLines,
    "",
  ].join("\n");
}
