import type { CaptionLayout, CaptionPage, TextPreset } from "./types";
import { applyTextTransform } from "./text-transform";

function resolveFontPx(preset: TextPreset, canvasW: number, canvasH: number): number {
  const scale = Math.min(canvasW / 1080, canvasH / 1920);
  return preset.typography.fontSize * scale;
}

export function computeLayout(
  ctx: CanvasRenderingContext2D,
  page: CaptionPage,
  preset: TextPreset,
  canvasW: number,
  canvasH: number,
): CaptionLayout {
  const fontPx = resolveFontPx(preset, canvasW, canvasH);
  const lineHeightPx = fontPx * preset.typography.lineHeight;
  const maxWidth = canvasW * (preset.layout.maxWidthPercent / 100);

  ctx.font = `${preset.typography.fontWeight} ${fontPx}px ${preset.typography.fontFamily}`;

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
    const nextWidth = currentLine.length === 0 ? width : currentWidth + spaceWidth + width;

    if (currentLine.length > 0 && nextWidth > maxWidth) {
      lines.push(currentLine);
      currentLine = [];
      currentWidth = 0;
    }

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

  const lineWidths = lines.map((line) =>
    line.reduce((sum, token, idx) => sum + token.width + (idx > 0 ? spaceWidth : 0), 0),
  );
  const blockWidth = Math.max(0, ...lineWidths);
  const blockHeight = Math.max(lineHeightPx, lines.length * lineHeightPx);
  const anchorY = canvasH * (preset.layout.positionY / 100);
  const blockY = anchorY - blockHeight / 2;

  const positionedTokens = lines.flatMap((line, lineIndex) => {
    const lineWidth = lineWidths[lineIndex] ?? 0;
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
        y: blockY + lineHeightPx * (lineIndex + 0.8),
        lineIndex,
      };
      cursorX += token.width + (tokenIndex < line.length - 1 ? spaceWidth : 0);
      return positioned;
    });
  });

  return {
    page,
    tokens: positionedTokens,
    blockX:
      preset.layout.alignment === "left"
        ? (canvasW - maxWidth) / 2
        : canvasW / 2 - blockWidth / 2,
    blockY,
    blockWidth,
    blockHeight,
    lineHeightPx,
  };
}
