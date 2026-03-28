import type { Clip } from "../types/editor";
import { getCaptionPreset } from "../constants/caption-presets";

/**
 * Draw caption text for the current frame onto a canvas context.
 *
 * Performance: Linear scan of all words to find the active index.
 * For a 60s voiceover (~150 words) at 60fps, this is O(150) per frame
 * = ~9,000 comparisons/sec. No optimization needed.
 */
export function drawCaptionsOnCanvas(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  currentTimeMs: number,
  canvasW: number,
  canvasH: number
): void {
  if (!clip.captionWords?.length || !clip.captionPresetId) return;

  const preset = getCaptionPreset(clip.captionPresetId);
  const relativeMs = currentTimeMs - clip.startMs;
  const groupSize = clip.captionGroupSize ?? preset.groupSize;
  const words = clip.captionWords;

  // Find the word whose time range contains the current playhead
  const activeIdx = words.findIndex(
    (w) => relativeMs >= w.startMs && relativeMs < w.endMs
  );
  if (activeIdx === -1) return;

  // Determine which group the active word belongs to
  const groupStart = Math.floor(activeIdx / groupSize) * groupSize;
  const group = words.slice(groupStart, groupStart + groupSize);

  // Apply display-only textTransform — never mutates stored captionWords data.
  // This mirrors CSS text-transform: the DOM retains original casing; the
  // browser (here: canvas) applies the transform only at paint time.
  const displayGroup =
    preset.textTransform === "uppercase"
      ? group.map((w) => ({ ...w, word: w.word.toUpperCase() }))
      : group;

  const fontSize = clip.captionFontSizeOverride ?? preset.fontSize;
  const y = canvasH * ((clip.captionPositionY ?? preset.positionY) / 100);

  ctx.font = `${preset.fontWeight} ${fontSize}px ${preset.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // fullText derived from displayGroup so background box sizing is correct
  // for uppercase text (uppercase letters are wider than lowercase)
  const fullText = displayGroup.map((w) => w.word).join(" ");

  // Draw background box if preset has one
  if (preset.backgroundColor) {
    const metrics = ctx.measureText(fullText);
    const pad = preset.backgroundPadding ?? 12;
    const radius = preset.backgroundRadius ?? 8;
    const boxW = metrics.width + pad * 2;
    const boxH = fontSize + pad * 2;
    const boxX = canvasW / 2 - boxW / 2;
    const boxY = y - boxH / 2;

    ctx.fillStyle = preset.backgroundColor;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, radius);
    ctx.fill();
  }

  if (preset.animation === "highlight" || preset.animation === "karaoke") {
    drawWordByWord(ctx, displayGroup, relativeMs, preset, canvasW, y, fontSize);
  } else {
    drawSimpleText(ctx, fullText, preset, canvasW, y);
  }
}

function drawWordByWord(
  ctx: CanvasRenderingContext2D,
  group: Array<{ word: string; startMs: number; endMs: number }>,
  relativeMs: number,
  preset: ReturnType<typeof getCaptionPreset>,
  canvasW: number,
  y: number,
  _fontSize: number
): void {
  const spaceWidth = ctx.measureText(" ").width;
  const wordMeasurements = group.map((w) => ({
    ...w,
    width: ctx.measureText(w.word).width,
  }));

  let totalWidth = 0;
  for (let i = 0; i < wordMeasurements.length; i++) {
    totalWidth += wordMeasurements[i].width;
    if (i < wordMeasurements.length - 1) totalWidth += spaceWidth;
  }

  let xOffset = canvasW / 2 - totalWidth / 2;

  for (let i = 0; i < wordMeasurements.length; i++) {
    const wm = wordMeasurements[i];
    const isActive = relativeMs >= wm.startMs && relativeMs < wm.endMs;
    const wordCenterX = xOffset + wm.width / 2;

    const fillColor = isActive
      ? (preset.activeColor ?? preset.color)
      : preset.color;

    if (preset.outlineWidth > 0) {
      ctx.strokeStyle = preset.outlineColor ?? "#000000";
      ctx.lineWidth = preset.outlineWidth * 2;
      ctx.lineJoin = "round";
      ctx.strokeText(wm.word, wordCenterX, y);
    }

    ctx.fillStyle = fillColor;
    ctx.fillText(wm.word, wordCenterX, y);

    xOffset += wm.width + spaceWidth;
  }
}

function drawSimpleText(
  ctx: CanvasRenderingContext2D,
  text: string,
  preset: ReturnType<typeof getCaptionPreset>,
  canvasW: number,
  y: number
): void {
  if (preset.outlineWidth > 0) {
    ctx.strokeStyle = preset.outlineColor ?? "#000000";
    ctx.lineWidth = preset.outlineWidth * 2;
    ctx.lineJoin = "round";
    ctx.strokeText(text, canvasW / 2, y);
  }
  ctx.fillStyle = preset.color;
  ctx.fillText(text, canvasW / 2, y);
}
