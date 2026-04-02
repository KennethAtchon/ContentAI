import { evaluate } from "./easing";
import type { CaptionLayout, PositionedToken, TextPreset } from "./types";

function tokenState(token: PositionedToken, relativeMs: number): "upcoming" | "active" | "past" {
  if (relativeMs < token.startMs) return "upcoming";
  if (relativeMs >= token.endMs) return "past";
  return "active";
}

function resolveFillColor(preset: TextPreset, state: "upcoming" | "active" | "past") {
  const fill = preset.layers.find((layer) => layer.type === "fill");
  if (!fill || fill.type !== "fill") return "#FFFFFF";
  return fill.stateColors?.[state] ?? fill.color;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  layout: CaptionLayout,
  relativeMs: number,
  preset: TextPreset,
): void {
  const fontPx = layout.lineHeightPx / preset.typography.lineHeight;
  ctx.save();
  ctx.font = `${preset.typography.fontWeight} ${fontPx}px ${preset.typography.fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  for (const token of layout.tokens) {
    const state = tokenState(token, relativeMs);
    const scalePulse = preset.wordActivation?.scalePulse;
    const pulse =
      state === "active" && scalePulse
        ? scalePulse.from + (1 - scalePulse.from) *
          evaluate(
            scalePulse.easing,
            Math.min(
              1,
              Math.max(0, (relativeMs - token.startMs) / scalePulse.durationMs),
            ),
          )
        : 1;

    ctx.save();
    ctx.translate(token.x + token.width / 2, token.y);
    ctx.scale(pulse, pulse);
    ctx.translate(-(token.width / 2), 0);
    ctx.fillStyle = resolveFillColor(preset, state);
    ctx.fillText(token.text, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}
