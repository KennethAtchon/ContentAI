export interface CompositorClipDescriptor {
  clipId: string;
  /** Canvas z-index: 0 = bottom track, higher = on top. */
  zIndex: number;
  /** Source-media timestamp to display for this clip on the current tick. */
  sourceTimeUs: number;
  /** Computed opacity (0-1), already accounting for transitions and enabled state. */
  opacity: number;
  /** Typed clip region for wipe transitions, or null. Values are percentages. */
  clipPath: CompositorClipPath | null;
  /** Numeric effect values. Contrast/warmth match editor slider units. */
  effects: CompositorClipEffects;
  /** Numeric transform descriptor applied by the worker without string parsing. */
  transform: CompositorClipTransform;
  /** If false, skip this clip entirely. */
  enabled: boolean;
}

export interface CompositorClipTransform {
  scale: number;
  translateX: number;
  translateY: number;
  translateXPercent: number;
  translateYPercent: number;
  rotationDeg: number;
}

export interface CompositorClipEffects {
  contrast: number;
  warmth: number;
}

export type CompositorClipPath =
  | {
      type: "inset";
      top: number;
      right: number;
      bottom: number;
      left: number;
    }
  | {
      type: "polygon";
      points: Array<{ x: number; y: number }>;
    };

export interface SerializedTextObject {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: string;
  color: string;
  align: CanvasTextAlign;
  opacity: number;
  maxWidth: number;
  lineHeight: number;
}

export interface SerializedCaptionFrame {
  /** Pre-rendered caption pixels. The compositor owns and closes this bitmap. */
  bitmap: ImageBitmap;
}

export type CompositorRendererMode = "webgl2" | "canvas2d";
export type CompositorRendererPreference = CompositorRendererMode | "auto";
export type PreviewQualityLevel = "full" | "half" | "low";

export interface CompositorPreviewQuality {
  level: PreviewQualityLevel;
  scale: number;
}

export interface DrawRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export interface CompositorRenderRequest {
  clips: CompositorClipDescriptor[];
  textObjects: SerializedTextObject[];
  captionFrame: SerializedCaptionFrame | null;
  pickFrame(clipId: string, sourceTimeUs: number): VideoFrame | null;
}

export interface CompositorRenderStats {
  totalClipCount: number;
  drawableClipCount: number;
  drawableClipIds: string[];
  drawnVideoClipCount: number;
  drawnVideoClipIds: string[];
  missingFrameClipCount: number;
  missingFrameClipIds: string[];
  failedVideoClipCount: number;
  failedVideoClipIds: string[];
  textObjectCount: number;
  captionFramePresent: boolean;
  overlayDrawn: boolean;
  overlayOnly: boolean;
}

export interface CompositorRenderResult {
  ok: boolean;
  stats: CompositorRenderStats;
}

export interface CompositorRendererOptions {
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  preference: CompositorRendererPreference;
  quality: CompositorPreviewQuality;
}

export interface CompositorRenderer {
  readonly mode: CompositorRendererMode;
  resize(
    width: number,
    height: number,
    quality: CompositorPreviewQuality
  ): void;
  render(request: CompositorRenderRequest): CompositorRenderResult;
  releaseFrame(frame: VideoFrame): void;
  destroy(): void;
}

export function getDrawableClips(
  clips: CompositorClipDescriptor[]
): CompositorClipDescriptor[] {
  return [...clips]
    .filter((clip) => clip.enabled && clip.opacity > 0)
    .sort((a, b) => a.zIndex - b.zIndex);
}

export function getObjectContainRect(
  frame: VideoFrame,
  canvasWidth: number,
  canvasHeight: number
): DrawRect {
  const frameAspect = frame.displayWidth / frame.displayHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let dx = 0;
  let dy = 0;
  let dw = canvasWidth;
  let dh = canvasHeight;

  if (frameAspect > canvasAspect) {
    dh = canvasWidth / frameAspect;
    dy = (canvasHeight - dh) / 2;
  } else {
    dw = canvasHeight * frameAspect;
    dx = (canvasWidth - dw) / 2;
  }

  return { dx, dy, dw, dh };
}

export function drawTextObject(
  targetCtx: OffscreenCanvasRenderingContext2D,
  text: SerializedTextObject
): void {
  targetCtx.save();
  targetCtx.globalAlpha = text.opacity;
  targetCtx.font = `${text.fontWeight} ${text.fontSize}px sans-serif`;
  targetCtx.fillStyle = text.color;
  targetCtx.textAlign = text.align;
  targetCtx.textBaseline = "middle";
  targetCtx.shadowColor = "rgba(0,0,0,0.8)";
  targetCtx.shadowBlur = 8;

  const lines = text.text.split("\n");
  const blockHeight = Math.max(text.lineHeight, 1) * lines.length;
  const firstLineY = text.y - blockHeight / 2 + text.lineHeight / 2;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    targetCtx.fillText(
      lines[lineIndex] ?? "",
      text.x,
      firstLineY + lineIndex * text.lineHeight,
      text.maxWidth
    );
  }

  targetCtx.restore();
}
