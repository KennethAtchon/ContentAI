import {
  drawTextObject,
  getDrawableClips,
  getObjectContainRect,
  type CompositorClipEffects,
  type CompositorClipPath,
  type CompositorClipTransform,
  type CompositorPreviewQuality,
  type CompositorRenderResult,
  type CompositorRenderRequest,
  type CompositorRenderer,
  type DrawRect,
} from "./types";
import { debugLog } from "@/shared/utils/debug";

const LOG_COMPONENT = "Canvas2dCompositorRenderer";

export class Canvas2dCompositorRenderer implements CompositorRenderer {
  readonly mode = "canvas2d" as const;

  private readonly renderCtx: OffscreenCanvasRenderingContext2D | null;
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(
    private readonly canvas: OffscreenCanvas,
    width: number,
    height: number,
    private quality: CompositorPreviewQuality
  ) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.applyCanvasSize();
    this.renderCtx = this.canvas.getContext("2d", {
      alpha: false,
    }) as OffscreenCanvasRenderingContext2D | null;
    this.logDebug("Initialized Canvas2D compositor renderer", {
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      previewQualityLevel: this.quality.level,
      previewQualityScale: this.quality.scale,
      hasContext: Boolean(this.renderCtx),
    });
  }

  private logDebug(
    message: string,
    context?: Record<string, unknown>,
    data?: unknown
  ): void {
    debugLog.debug(message, { component: LOG_COMPONENT, ...context }, data);
  }

  private logWarn(
    message: string,
    context?: Record<string, unknown>,
    data?: unknown
  ): void {
    debugLog.warn(message, { component: LOG_COMPONENT, ...context }, data);
  }

  resize(
    width: number,
    height: number,
    quality: CompositorPreviewQuality
  ): void {
    this.logDebug("Resizing Canvas2D compositor renderer", {
      previousWidth: this.canvasWidth,
      previousHeight: this.canvasHeight,
      width,
      height,
      previewQualityLevel: quality.level,
      previewQualityScale: quality.scale,
    });
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.quality = quality;
    this.applyCanvasSize();
  }

  render(request: CompositorRenderRequest): CompositorRenderResult {
    if (!this.renderCtx) {
      this.logDebug("Canvas2D render skipped because context is unavailable");
      return {
        ok: false,
        stats: {
          totalClipCount: request.clips.length,
          drawableClipCount: 0,
          drawableClipIds: [],
          drawnVideoClipCount: 0,
          drawnVideoClipIds: [],
          missingFrameClipCount: 0,
          missingFrameClipIds: [],
          failedVideoClipCount: 0,
          failedVideoClipIds: [],
          textObjectCount: request.textObjects.length,
          captionFramePresent: request.captionFrame !== null,
          overlayDrawn:
            request.textObjects.length > 0 || request.captionFrame !== null,
          overlayOnly:
            request.textObjects.length > 0 || request.captionFrame !== null,
        },
      };
    }

    const drawableClips = getDrawableClips(request.clips);
    const drawnVideoClipIds: string[] = [];
    const missingFrameClipIds: string[] = [];

    this.logDebug("Starting Canvas2D render", {
      clipCount: request.clips.length,
      drawableClipCount: drawableClips.length,
      drawableClipIds: drawableClips.map((clip) => clip.clipId),
      textObjectCount: request.textObjects.length,
      hasCaptionFrame: request.captionFrame !== null,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
    });

    this.clearCanvas();

    for (const clip of drawableClips) {
      const frame = request.pickFrame(clip.clipId, clip.sourceTimeUs);
      if (!frame) {
        missingFrameClipIds.push(clip.clipId);
        this.logDebug("Canvas2D render found no frame for clip", {
          clipId: clip.clipId,
          sourceTimeUs: clip.sourceTimeUs,
          opacity: clip.opacity,
        });
        continue;
      }
      drawnVideoClipIds.push(clip.clipId);
      this.drawClipFrame(
        clip.opacity,
        clip.effects,
        clip.clipPath,
        clip.transform,
        frame
      );
    }

    for (const text of request.textObjects) {
      drawTextObject(this.renderCtx, text);
    }

    if (request.captionFrame) {
      this.logDebug("Drawing caption frame in Canvas2D renderer", {
        canvasWidth: this.canvasWidth,
        canvasHeight: this.canvasHeight,
      });
      this.renderCtx.drawImage(
        request.captionFrame.bitmap,
        0,
        0,
        this.canvasWidth,
        this.canvasHeight
      );
    }

    const overlayDrawn =
      request.textObjects.length > 0 || request.captionFrame !== null;
    const overlayOnly = drawnVideoClipIds.length === 0 && overlayDrawn;

    if (drawnVideoClipIds.length === 0) {
      this.logWarn("Canvas2D render produced no video draw", {
        drawableClipCount: drawableClips.length,
        drawableClipIds: drawableClips.map((clip) => clip.clipId),
        missingFrameClipIds,
        overlayOnly,
        textObjectCount: request.textObjects.length,
        hasCaptionFrame: request.captionFrame !== null,
      });
    }

    this.logDebug("Completed Canvas2D render", {
      clipCount: request.clips.length,
      drawableClipCount: drawableClips.length,
      drawnVideoClipCount: drawnVideoClipIds.length,
      drawnVideoClipIds,
      missingFrameClipCount: missingFrameClipIds.length,
      missingFrameClipIds,
      textObjectCount: request.textObjects.length,
      hasCaptionFrame: request.captionFrame !== null,
      overlayOnly,
    });
    return {
      ok: true,
      stats: {
        totalClipCount: request.clips.length,
        drawableClipCount: drawableClips.length,
        drawableClipIds: drawableClips.map((clip) => clip.clipId),
        drawnVideoClipCount: drawnVideoClipIds.length,
        drawnVideoClipIds,
        missingFrameClipCount: missingFrameClipIds.length,
        missingFrameClipIds,
        failedVideoClipCount: 0,
        failedVideoClipIds: [],
        textObjectCount: request.textObjects.length,
        captionFramePresent: request.captionFrame !== null,
        overlayDrawn,
        overlayOnly,
      },
    };
  }

  releaseFrame(_frame: VideoFrame): void {}

  destroy(): void {}

  private clearCanvas(): void {
    if (!this.renderCtx) return;

    this.logDebug("Clearing Canvas2D surface to black", {
      scaledCanvasWidth: this.canvas.width,
      scaledCanvasHeight: this.canvas.height,
      previewQualityLevel: this.quality.level,
      previewQualityScale: this.quality.scale,
    });
    this.renderCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.renderCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderCtx.fillStyle = "#000";
    this.renderCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderCtx.setTransform(
      this.quality.scale,
      0,
      0,
      this.quality.scale,
      0,
      0
    );
  }

  private applyCanvasSize(): void {
    this.canvas.width = Math.max(
      1,
      Math.round(this.canvasWidth * this.quality.scale)
    );
    this.canvas.height = Math.max(
      1,
      Math.round(this.canvasHeight * this.quality.scale)
    );
  }

  private drawClipFrame(
    opacity: number,
    effects: CompositorClipEffects,
    clipPath: CompositorClipPath | null,
    transform: CompositorClipTransform,
    frame: VideoFrame
  ): void {
    if (!this.renderCtx) return;

    const drawRect = getObjectContainRect(
      frame,
      this.canvasWidth,
      this.canvasHeight
    );

    this.logDebug("Drawing clip frame in Canvas2D renderer", {
      frameTimestampUs: frame.timestamp,
      frameDisplayWidth: frame.displayWidth,
      frameDisplayHeight: frame.displayHeight,
      drawRect,
      opacity,
      hasClipPath: clipPath !== null,
      scale: transform.scale,
      translateX: transform.translateX,
      translateY: transform.translateY,
      rotationDeg: transform.rotationDeg,
    });

    this.renderCtx.save();
    this.renderCtx.globalAlpha = opacity;
    this.renderCtx.filter = this.buildCanvasFilter(effects);

    if (clipPath) {
      this.applyClipPath(clipPath);
    }

    this.applyTransform(transform);
    this.drawFrame(frame, drawRect);
    this.renderCtx.restore();
  }

  private drawFrame(frame: VideoFrame, drawRect: DrawRect): void {
    if (!this.renderCtx) return;

    this.logDebug("Issuing Canvas2D drawImage for frame", {
      frameTimestampUs: frame.timestamp,
      drawRect,
    });
    this.renderCtx.drawImage(
      frame,
      drawRect.dx,
      drawRect.dy,
      drawRect.dw,
      drawRect.dh
    );
  }

  private applyTransform(transform: CompositorClipTransform): void {
    if (!this.renderCtx) return;

    const scale =
      Number.isFinite(transform.scale) && transform.scale > 0
        ? transform.scale
        : 1;

    if (scale !== 1) {
      this.renderCtx.transform(
        scale,
        0,
        0,
        scale,
        (this.canvasWidth / 2) * (1 - scale),
        (this.canvasHeight / 2) * (1 - scale)
      );
    }

    const translateX =
      transform.translateX +
      (transform.translateXPercent / 100) * this.canvasWidth;
    const translateY =
      transform.translateY +
      (transform.translateYPercent / 100) * this.canvasHeight;

    if (translateX !== 0 || translateY !== 0) {
      this.renderCtx.translate(translateX, translateY);
    }

    if (transform.rotationDeg === 0) return;

    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;
    const radians = (transform.rotationDeg * Math.PI) / 180;
    this.renderCtx.translate(centerX, centerY);
    this.renderCtx.rotate(radians);
    this.renderCtx.translate(-centerX, -centerY);
  }

  private applyClipPath(clipPath: CompositorClipPath): void {
    if (!this.renderCtx) return;

    if (clipPath.type === "inset") {
      const top = (clipPath.top / 100) * this.canvasHeight;
      const right = (clipPath.right / 100) * this.canvasWidth;
      const bottom = (clipPath.bottom / 100) * this.canvasHeight;
      const left = (clipPath.left / 100) * this.canvasWidth;

      this.renderCtx.beginPath();
      this.renderCtx.rect(
        left,
        top,
        this.canvasWidth - left - right,
        this.canvasHeight - top - bottom
      );
      this.renderCtx.clip();
      return;
    }

    const points = clipPath.points.map((point) => ({
      x: (point.x / 100) * this.canvasWidth,
      y: (point.y / 100) * this.canvasHeight,
    }));

    if (points.length < 3) return;

    this.renderCtx.beginPath();
    this.renderCtx.moveTo(points[0]!.x, points[0]!.y);
    for (let index = 1; index < points.length; index += 1) {
      this.renderCtx.lineTo(points[index]!.x, points[index]!.y);
    }
    this.renderCtx.closePath();
    this.renderCtx.clip();
  }

  private buildCanvasFilter(effects: CompositorClipEffects): string {
    const filterParts: string[] = [];

    if (effects.contrast !== 0) {
      filterParts.push(`contrast(${1 + effects.contrast / 100})`);
    }

    if (effects.warmth !== 0) {
      filterParts.push(
        `hue-rotate(${-effects.warmth * 0.3}deg)`,
        `saturate(${1 + effects.warmth * 0.005})`
      );
    }

    return filterParts.join(" ") || "none";
  }
}
