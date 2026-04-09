import type { CaptionLayout, CaptionPage, TextPreset } from "./types";
import { applyTextTransform } from "./text-transform";

/** Scales preset font size from the design reference frame (1080×1920) to the actual canvas, preserving aspect. */
function resolveFontPx(preset: TextPreset, canvasW: number, canvasH: number): number {
  const scale = Math.min(canvasW / 1080, canvasH / 1920);
  return preset.typography.fontSize * scale;
}

/**
 * Lays out caption tokens for a single page: wraps into lines by measured width, then assigns canvas
 * coordinates and a bounding box for hit-testing / highlights.
 *
 * Uses `ctx.measureText` (after setting `ctx.font` from the preset). Wrapping respects
 * `preset.layout.maxWidthPercent`; horizontal alignment is within that column centered on the canvas.
 * Vertical placement centers the text block on `preset.layout.positionY` (percent of canvas height).
 *
 * @param ctx - 2D context; only `font` and `measureText` are used. Callers should use the same font when drawing.
 * @param page - Caption page whose `tokens` are laid out in order (spaces implied between consecutive tokens).
 * @param preset - Typography and layout (font, line height, max width %, alignment, vertical anchor).
 * @param canvasW - Canvas width in CSS pixels.
 * @param canvasH - Canvas height in CSS pixels.
 * @returns Measured layout: positioned tokens, line metrics, and block rect (`blockX`/`blockY`/`blockWidth`/`blockHeight`).
 */
export function computeLayout(
  ctx: CanvasRenderingContext2D,
  page: CaptionPage,
  preset: TextPreset,
  canvasW: number,
  canvasH: number,
): CaptionLayout {
  // Typography and wrapping box: sizes are in canvas pixels; maxWidth caps how wide a line may grow.
  const fontPx = resolveFontPx(preset, canvasW, canvasH);
  const lineHeightPx = fontPx * preset.typography.lineHeight;
  const maxWidth = canvasW * (preset.layout.maxWidthPercent / 100);

  // measureText() uses ctx.font; must match the font used when drawing.
  ctx.font = `${preset.typography.fontWeight} ${fontPx}px ${preset.typography.fontFamily}`;

  // --- Token → lines: greedy wrap by cumulative width (tokens are words/pieces; spaces between tokens). ---
  const lines: Array<Array<CaptionLayout["tokens"][number]>> = [];
  let currentLine: Array<CaptionLayout["tokens"][number]> = [];
  let currentWidth = 0;
  const spaceWidth = ctx.measureText(" ").width;

  page.tokens.forEach((token, index) => {
    const displayText = applyTextTransform(
      token.text,
      preset.typography.textTransform,
    );
    const width = ctx.measureText(displayText).width;
    // Width if we append this token: first token on the line has no leading space; later tokens add one space.
    const nextWidth = currentLine.length === 0 ? width : currentWidth + spaceWidth + width;

    // Break before this token if the current line is non-empty and would exceed the wrap width.
    if (currentLine.length > 0 && nextWidth > maxWidth) {
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
    }

    // Placeholders x/y; real coordinates are assigned after we know line widths and alignment.
    currentLine.push({
      ...token,
      x: 0,
      y: 0,
      width,
      lineIndex: lines.length,
      index,
    });
    currentWidth = currentLine.length === 1 ? width : currentWidth + spaceWidth + width;
  });

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  // Pixel width of each line (sum of token widths + spaces between tokens).
  const lineWidths = lines.map((line) =>
    line.reduce((sum, token, idx) => sum + token.width + (idx > 0 ? spaceWidth : 0), 0),
  );
  const blockWidth = Math.max(0, ...lineWidths);
  const blockHeight = Math.max(lineHeightPx, lines.length * lineHeightPx);
  // Vertical anchor: preset positionY is a percentage down the canvas; block is vertically centered on that point.
  const anchorY = canvasH * (preset.layout.positionY / 100);
  const blockY = anchorY - blockHeight / 2;

  // --- Horizontal placement per line: start within the maxWidth column, then advance cursorX per token. ---
  const positionedTokens = lines.flatMap((line, lineIndex) => {
    const lineWidth = lineWidths[lineIndex] ?? 0;
    // Left/right/center are relative to the maxWidth band centered on the canvas (not the full canvas width).
    const startX =
      preset.layout.alignment === "left"
        ? (canvasW - maxWidth) / 2
        : preset.layout.alignment === "right"
          ? (canvasW + maxWidth) / 2 - lineWidth
          : canvasW / 2 - lineWidth / 2;

    let cursorX = startX;
    return line.map((token, tokenIndex) => {
      const positioned = {
        ...token,
        x: cursorX,
        // +0.8 nudges text toward optical center within the line box (baseline vs cap height).
        y: blockY + lineHeightPx * (lineIndex + 0.8),
        lineIndex,
      };
      cursorX += token.width + (tokenIndex < line.length - 1 ? spaceWidth : 0);
      return positioned;
    });
  });

  return {
    page,
    preset,
    tokens: positionedTokens,
    // Bounding box origin X: left alignment pins to the left edge of the maxWidth column; else center on actual block width.
    blockX:
      preset.layout.alignment === "left"
        ? (canvasW - maxWidth) / 2
        : canvasW / 2 - blockWidth / 2,
    blockY,
    blockWidth,
    blockHeight,
    lineHeightPx,
    lineCount: lines.length,
    canvasW,
    canvasH,
  };
}
