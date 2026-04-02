import { evaluate } from "./easing";
import type {
  AnimationDef,
  CaptionLayout,
  LayerOverridePatch,
  PositionedToken,
  StyleLayer,
  TextPreset,
} from "./types";

type TokenVisualState = "upcoming" | "active" | "past";

interface ResolvedTransform {
  opacity: number;
  scale: number;
  translateY: number;
}

interface LineBox {
  firstTokenIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  state: TokenVisualState;
}

function tokenState(token: PositionedToken, relativeMs: number): TokenVisualState {
  if (relativeMs < token.startMs) return "upcoming";
  if (relativeMs >= token.endMs) return "past";
  return "active";
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function resolveLayerColor(layer: StyleLayer, state: TokenVisualState): string {
  if ("stateColors" in layer) {
    return layer.stateColors?.[state] ?? layer.color;
  }
  return layer.color;
}

function mergeLayerPatch(layer: StyleLayer, patch: LayerOverridePatch | undefined): StyleLayer {
  if (!patch) return layer;

  return {
    ...layer,
    ...patch,
    ...("stateColors" in layer || patch.stateColors
      ? {
          stateColors:
            "stateColors" in layer || patch.stateColors
              ? {
                  ...("stateColors" in layer ? layer.stateColors : undefined),
                  ...patch.stateColors,
                }
              : undefined,
        }
      : {}),
  } as StyleLayer;
}

function resolveLayers(preset: TextPreset, state: TokenVisualState): StyleLayer[] {
  if (state !== "active" || !preset.wordActivation?.layerOverrides?.length) {
    return preset.layers;
  }

  return preset.layers.map((layer) =>
    mergeLayerPatch(
      layer,
      preset.wordActivation?.layerOverrides?.find((patch) => patch.layerId === layer.id),
    ),
  );
}

function applyAnimation(transform: ResolvedTransform, animation: AnimationDef, progress: number) {
  const eased = evaluate(animation.easing, progress);
  const value = lerp(animation.from, animation.to, eased);

  switch (animation.property) {
    case "opacity":
      transform.opacity *= value;
      break;
    case "scale":
      transform.scale *= value;
      break;
    case "translateY":
      transform.translateY += value;
      break;
  }
}

function resolveTransform(
  animations: AnimationDef[] | null,
  phase: "entry" | "exit",
  scope: AnimationDef["scope"],
  pageElapsedMs: number,
  pageRemainingMs: number,
  index = 0,
): ResolvedTransform {
  const transform: ResolvedTransform = {
    opacity: 1,
    scale: 1,
    translateY: 0,
  };

  for (const animation of animations ?? []) {
    if (animation.scope !== scope) continue;

    const staggerOffset = (animation.staggerMs ?? 0) * index;
    const progress =
      phase === "entry"
        ? Math.max(0, Math.min(1, (pageElapsedMs - staggerOffset) / animation.durationMs))
        : Math.max(
            0,
            Math.min(
              1,
              (animation.durationMs - pageRemainingMs - staggerOffset) / animation.durationMs,
            ),
          );

    applyAnimation(transform, animation, progress);
  }

  return transform;
}

function resolvePulseScale(
  preset: TextPreset,
  token: PositionedToken,
  state: TokenVisualState,
  relativeMs: number,
): number {
  const scalePulse = preset.wordActivation?.scalePulse;
  if (state !== "active" || !scalePulse) return 1;

  return lerp(
    scalePulse.from,
    1,
    evaluate(
      scalePulse.easing,
      Math.min(1, Math.max(0, (relativeMs - token.startMs) / scalePulse.durationMs)),
    ),
  );
}

function buildLineBoxes(
  layout: CaptionLayout,
  relativeMs: number,
): Map<number, LineBox> {
  const byLine = new Map<number, PositionedToken[]>();

  for (const token of layout.tokens) {
    const line = byLine.get(token.lineIndex) ?? [];
    line.push(token);
    byLine.set(token.lineIndex, line);
  }

  return new Map(
    [...byLine.entries()].map(([lineIndex, tokens]) => {
      const first = tokens[0]!;
      const x = Math.min(...tokens.map((token) => token.x));
      const right = Math.max(...tokens.map((token) => token.x + token.width));
      const states = tokens.map((token) => tokenState(token, relativeMs));
      const top = first.y - layout.lineHeightPx * 0.8;
      const state =
        states.includes("active")
          ? "active"
          : states.every((value) => value === "past")
            ? "past"
            : states.some((value) => value === "past")
              ? "past"
              : "upcoming";

      return [
        lineIndex,
        {
          firstTokenIndex: first.index,
          x,
          y: top,
          width: right - x,
          height: layout.lineHeightPx,
          state,
        },
      ];
    }),
  );
}

function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  if (radius > 0 && typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    return;
  }

  ctx.fillRect(x, y, width, height);
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  layout: CaptionLayout,
  token: PositionedToken,
  state: TokenVisualState,
  layer: StyleLayer,
  lineBoxes: Map<number, LineBox>,
) {
  if (layer.type === "background") {
    const padding = layer.padding ?? 0;
    const radius = layer.radius ?? 0;

    ctx.fillStyle = resolveLayerColor(layer, state);

    if (layer.mode === "line") {
      const lineBox = lineBoxes.get(token.lineIndex);
      if (!lineBox || lineBox.firstTokenIndex !== token.index) return;

      ctx.fillStyle = resolveLayerColor(layer, lineBox.state);
      drawRect(
        ctx,
        lineBox.x - padding,
        lineBox.y - padding,
        lineBox.width + padding * 2,
        lineBox.height + padding * 2,
        radius,
      );
      return;
    }

    const top = token.y - layout.lineHeightPx * 0.8;
    drawRect(
      ctx,
      token.x - padding,
      top - padding,
      token.width + padding * 2,
      layout.lineHeightPx + padding * 2,
      radius,
    );
    return;
  }

  if (layer.type === "shadow") {
    ctx.fillStyle = layer.color;
    ctx.shadowColor = layer.color;
    ctx.shadowOffsetX = layer.offsetX ?? 0;
    ctx.shadowOffsetY = layer.offsetY ?? 0;
    ctx.shadowBlur = layer.blur ?? 0;
    ctx.fillText(token.text, token.x, token.y);
    ctx.shadowColor = "transparent";
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
    return;
  }

  if (layer.type === "stroke") {
    ctx.strokeStyle = resolveLayerColor(layer, state);
    ctx.lineWidth = layer.width;
    ctx.lineJoin = layer.join ?? "round";
    ctx.strokeText(token.text, token.x, token.y);
    return;
  }

  ctx.fillStyle = resolveLayerColor(layer, state);
  ctx.fillText(token.text, token.x, token.y);
}

function applyTransform(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  transform: ResolvedTransform,
) {
  ctx.globalAlpha *= transform.opacity;
  ctx.translate(anchorX, anchorY + transform.translateY);
  ctx.scale(transform.scale, transform.scale);
  ctx.translate(-anchorX, -anchorY);
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  layout: CaptionLayout,
  relativeMs: number,
  preset: TextPreset,
): void {
  const fontPx = layout.lineHeightPx / preset.typography.lineHeight;
  const pageElapsedMs = relativeMs - layout.page.startMs;
  const pageRemainingMs = layout.page.endMs - relativeMs;
  const pageTransform = resolveTransform(
    preset.entryAnimation,
    "entry",
    "page",
    pageElapsedMs,
    pageRemainingMs,
  );
  const exitPageTransform = resolveTransform(
    preset.exitAnimation,
    "exit",
    "page",
    pageElapsedMs,
    pageRemainingMs,
  );
  const lineBoxes = buildLineBoxes(layout, relativeMs);

  ctx.save();
  ctx.font = `${preset.typography.fontWeight} ${fontPx}px ${preset.typography.fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  applyTransform(
    ctx,
    layout.blockX + layout.blockWidth / 2,
    layout.blockY + layout.blockHeight / 2,
    {
      opacity: pageTransform.opacity * exitPageTransform.opacity,
      scale: pageTransform.scale * exitPageTransform.scale,
      translateY: pageTransform.translateY + exitPageTransform.translateY,
    },
  );

  for (const token of layout.tokens) {
    const state = tokenState(token, relativeMs);
    const layers = resolveLayers(preset, state);
    const wordEntryTransform = resolveTransform(
      preset.entryAnimation,
      "entry",
      "word",
      pageElapsedMs,
      pageRemainingMs,
      token.index,
    );
    const wordExitTransform = resolveTransform(
      preset.exitAnimation,
      "exit",
      "word",
      pageElapsedMs,
      pageRemainingMs,
      token.index,
    );
    const pulse = resolvePulseScale(preset, token, state, relativeMs);
    const tokenTop = token.y - layout.lineHeightPx * 0.8;
    const tokenCenterX = token.x + token.width / 2;
    const tokenCenterY = tokenTop + layout.lineHeightPx / 2;

    ctx.save();
    applyTransform(ctx, tokenCenterX, tokenCenterY, {
      opacity: wordEntryTransform.opacity * wordExitTransform.opacity,
      scale: wordEntryTransform.scale * wordExitTransform.scale * pulse,
      translateY: wordEntryTransform.translateY + wordExitTransform.translateY,
    });
    for (const layer of layers) {
      drawLayer(ctx, layout, token, state, layer, lineBoxes);
    }
    ctx.restore();
  }

  ctx.restore();
}
