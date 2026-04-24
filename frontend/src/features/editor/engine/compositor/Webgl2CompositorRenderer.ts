/* global WebGLTexture, WebGLUniformLocation, WebGL2RenderingContext, WebGLProgram, WebGLBuffer, GLenum, WebGLShader */

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

interface TextureRecord {
  texture: WebGLTexture;
}

interface ShaderLocations {
  position: number;
  texCoord: number;
  positionResolution: WebGLUniformLocation;
  canvasSize: WebGLUniformLocation;
  opacity: WebGLUniformLocation;
  contrast: WebGLUniformLocation;
  warmth: WebGLUniformLocation;
  renderScale: WebGLUniformLocation;
  clipMode: WebGLUniformLocation;
  clipInset: WebGLUniformLocation;
  polygonPointCount: WebGLUniformLocation;
  polygonPoints: WebGLUniformLocation;
  sampler: WebGLUniformLocation;
}

interface WebglRendererState {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vertexBuffer: WebGLBuffer;
  locations: ShaderLocations;
  frameTextures: WeakMap<VideoFrame, TextureRecord>;
  overlayTexture: WebGLTexture;
}

const MAX_POLYGON_POINTS = 8;
const IDENTITY_EFFECTS: CompositorClipEffects = { contrast: 0, warmth: 0 };
const LOG_COMPONENT = "Webgl2CompositorRenderer";

export class Webgl2CompositorRenderer implements CompositorRenderer {
  readonly mode = "webgl2" as const;

  private webgl: WebglRendererState | null = null;
  private overlayCanvas: OffscreenCanvas | null = null;
  private overlayCtx: OffscreenCanvasRenderingContext2D | null = null;
  private contextLost = false;

  private constructor(
    private readonly canvas: OffscreenCanvas,
    private canvasWidth: number,
    private canvasHeight: number,
    private quality: CompositorPreviewQuality
  ) {}

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

  static create(
    canvas: OffscreenCanvas,
    width: number,
    height: number,
    quality: CompositorPreviewQuality
  ): Webgl2CompositorRenderer | null {
    const renderer = new Webgl2CompositorRenderer(
      canvas,
      width,
      height,
      quality
    );
    if (!renderer.initializeWebgl()) {
      renderer.logWarn("Failed to initialize WebGL2 compositor renderer", {
        width,
        height,
        previewQualityLevel: quality.level,
        previewQualityScale: quality.scale,
      });
      return null;
    }
    renderer.installContextLossHandlers();
    renderer.logDebug("Initialized WebGL2 compositor renderer", {
      width,
      height,
      previewQualityLevel: quality.level,
      previewQualityScale: quality.scale,
    });
    return renderer;
  }

  resize(
    width: number,
    height: number,
    quality: CompositorPreviewQuality
  ): void {
    this.logDebug("Resizing WebGL2 compositor renderer", {
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
    this.applyOverlayCanvasSize();

    if (this.webgl) {
      this.webgl.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  render(request: CompositorRenderRequest): CompositorRenderResult {
    if (!this.webgl || this.contextLost) {
      this.logWarn("Skipping WebGL2 render because context is unavailable", {
        hasWebglState: Boolean(this.webgl),
        contextLost: this.contextLost,
      });
      return this.buildRenderFailureResult(request);
    }

    const { gl } = this.webgl;
    if (gl.isContextLost()) {
      this.logWarn("Detected lost WebGL2 context during render");
      this.contextLost = true;
      this.webgl = null;
      return this.buildRenderFailureResult(request);
    }

    const drawableClips = getDrawableClips(request.clips);
    const drawnVideoClipIds: string[] = [];
    const missingFrameClipIds: string[] = [];
    const failedVideoClipIds: string[] = [];

    this.logDebug("Starting WebGL2 render", {
      clipCount: request.clips.length,
      drawableClipCount: drawableClips.length,
      drawableClipIds: drawableClips.map((clip) => clip.clipId),
      textObjectCount: request.textObjects.length,
      hasCaptionFrame: request.captionFrame !== null,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      scaledCanvasWidth: this.canvas.width,
      scaledCanvasHeight: this.canvas.height,
      previewQualityLevel: this.quality.level,
      previewQualityScale: this.quality.scale,
    });

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.logDebug("Cleared WebGL2 color buffer to black", {
      scaledCanvasWidth: this.canvas.width,
      scaledCanvasHeight: this.canvas.height,
    });
    this.drainGlErrors("after-clear");

    let didFailFrameUpload = false;
    for (const clip of drawableClips) {
      const frame = request.pickFrame(clip.clipId, clip.sourceTimeUs);
      if (!frame) {
        missingFrameClipIds.push(clip.clipId);
        this.logDebug("WebGL2 render found no frame for clip", {
          clipId: clip.clipId,
          sourceTimeUs: clip.sourceTimeUs,
          opacity: clip.opacity,
        });
        continue;
      }
      const didDrawFrame = this.drawClipFrame(
        clip.clipId,
        clip.sourceTimeUs,
        clip.opacity,
        clip.effects,
        clip.clipPath,
        clip.transform,
        frame
      );
      if (!didDrawFrame) {
        didFailFrameUpload = true;
        failedVideoClipIds.push(clip.clipId);
        this.logWarn("WebGL2 render failed to draw clip frame", {
          clipId: clip.clipId,
          sourceTimeUs: clip.sourceTimeUs,
          frameTimestampUs: frame.timestamp,
        });
      } else {
        drawnVideoClipIds.push(clip.clipId);
      }
    }

    const overlayDrawn = this.drawOverlay(request);
    const overlayOnly = drawnVideoClipIds.length === 0 && overlayDrawn;
    gl.flush();
    this.logDebug("Flushed WebGL2 command buffer", {
      drawnVideoClipCount: drawnVideoClipIds.length,
      overlayDrawn,
    });
    this.drainGlErrors("after-flush");

    if (drawnVideoClipIds.length === 0) {
      this.logWarn("WebGL2 render produced no video draw", {
        drawableClipCount: drawableClips.length,
        drawableClipIds: drawableClips.map((clip) => clip.clipId),
        missingFrameClipIds,
        failedVideoClipIds,
        overlayOnly,
        textObjectCount: request.textObjects.length,
        hasCaptionFrame: request.captionFrame !== null,
      });
    }

    this.logDebug("Completed WebGL2 render", {
      clipCount: request.clips.length,
      drawableClipCount: drawableClips.length,
      drawnVideoClipCount: drawnVideoClipIds.length,
      drawnVideoClipIds,
      missingFrameClipCount: missingFrameClipIds.length,
      missingFrameClipIds,
      failedVideoClipCount: failedVideoClipIds.length,
      failedVideoClipIds,
      textObjectCount: request.textObjects.length,
      hasCaptionFrame: request.captionFrame !== null,
      didFailFrameUpload,
      overlayDrawn,
      overlayOnly,
    });
    return {
      ok: !didFailFrameUpload,
      stats: {
        totalClipCount: request.clips.length,
        drawableClipCount: drawableClips.length,
        drawableClipIds: drawableClips.map((clip) => clip.clipId),
        drawnVideoClipCount: drawnVideoClipIds.length,
        drawnVideoClipIds,
        missingFrameClipCount: missingFrameClipIds.length,
        missingFrameClipIds,
        failedVideoClipCount: failedVideoClipIds.length,
        failedVideoClipIds,
        textObjectCount: request.textObjects.length,
        captionFramePresent: request.captionFrame !== null,
        overlayDrawn,
        overlayOnly,
      },
    };
  }

  releaseFrame(frame: VideoFrame): void {
    if (!this.webgl) return;

    const record = this.webgl.frameTextures.get(frame);
    if (!record) return;

    this.webgl.gl.deleteTexture(record.texture);
    this.webgl.frameTextures.delete(frame);
  }

  destroy(): void {
    if (!this.webgl) return;

    this.logDebug("Destroying WebGL2 compositor renderer");
    const { gl, program, vertexBuffer, overlayTexture } = this.webgl;
    gl.deleteProgram(program);
    gl.deleteBuffer(vertexBuffer);
    gl.deleteTexture(overlayTexture);
    this.webgl = null;
    this.overlayCanvas = null;
    this.overlayCtx = null;
  }

  private initializeWebgl(): boolean {
    this.applyCanvasSize();
    const gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: true,
    }) as WebGL2RenderingContext | null;

    if (!gl) {
      this.logWarn("Browser did not provide a WebGL2 context");
      return false;
    }

    const program = this.createProgram(gl);
    const vertexBuffer = gl.createBuffer();
    const overlayTexture = gl.createTexture();
    if (!program || !vertexBuffer || !overlayTexture) {
      if (program) gl.deleteProgram(program);
      if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
      if (overlayTexture) gl.deleteTexture(overlayTexture);
      return false;
    }

    const locations = this.getShaderLocations(gl, program);
    if (!locations) {
      gl.deleteProgram(program);
      gl.deleteBuffer(vertexBuffer);
      gl.deleteTexture(overlayTexture);
      return false;
    }

    this.webgl = {
      gl,
      program,
      vertexBuffer,
      locations,
      frameTextures: new WeakMap(),
      overlayTexture,
    };
    this.ensureOverlayCanvas();
    this.configureWebgl(gl, program, overlayTexture);
    this.logDebug("WebGL2 context initialized", {
      scaledCanvasWidth: this.canvas.width,
      scaledCanvasHeight: this.canvas.height,
    });
    return true;
  }

  private installContextLossHandlers(): void {
    this.canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.logWarn("WebGL2 context lost");
      this.contextLost = true;
      this.webgl = null;
    });
    this.canvas.addEventListener("webglcontextrestored", () => {
      this.logDebug("WebGL2 context restored");
      this.contextLost = false;
      if (!this.initializeWebgl()) {
        this.logWarn("Failed to reinitialize WebGL2 after context restore");
        this.contextLost = true;
      }
    });
  }

  private configureWebgl(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    overlayTexture: WebGLTexture
  ): void {
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(program);
    this.configureTexture(gl, overlayTexture);
    gl.clearColor(0, 0, 0, 1);
  }

  private createProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
    const vertexShader = this.compileShader(
      gl,
      gl.VERTEX_SHADER,
      `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      uniform vec2 u_positionResolution;
      out vec2 v_texCoord;

      void main() {
        vec2 zeroToOne = a_position / u_positionResolution;
        vec2 clipSpace = zeroToOne * 2.0 - 1.0;
        gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
        v_texCoord = a_texCoord;
      }`
    );
    const fragmentShader = this.compileShader(
      gl,
      gl.FRAGMENT_SHADER,
      `#version 300 es
      precision mediump float;

      uniform sampler2D u_sampler;
      uniform vec2 u_canvasSize;
      uniform float u_opacity;
      uniform float u_contrast;
      uniform float u_warmth;
      uniform float u_renderScale;
      uniform int u_clipMode;
      uniform vec4 u_clipInset;
      uniform int u_polygonPointCount;
      uniform vec2 u_polygonPoints[${MAX_POLYGON_POINTS}];

      in vec2 v_texCoord;
      out vec4 outColor;

      bool pointInPolygon(vec2 point) {
        bool inside = false;
        for (int i = 0, j = ${MAX_POLYGON_POINTS - 1}; i < ${MAX_POLYGON_POINTS}; j = i++) {
          if (i >= u_polygonPointCount) {
            break;
          }
          int actualJ = j;
          if (j >= u_polygonPointCount) {
            actualJ = u_polygonPointCount - 1;
          }
          vec2 pi = u_polygonPoints[i];
          vec2 pj = u_polygonPoints[actualJ];
          float denominator = pj.y - pi.y;
          if (abs(denominator) < 0.0001) {
            denominator = 0.0001;
          }
          bool intersects = ((pi.y > point.y) != (pj.y > point.y)) &&
            (point.x < (pj.x - pi.x) * (point.y - pi.y) / denominator + pi.x);
          if (intersects) {
            inside = !inside;
          }
        }
        return inside;
      }

      void main() {
        vec2 canvasPoint = vec2(
          gl_FragCoord.x / u_renderScale,
          u_canvasSize.y - (gl_FragCoord.y / u_renderScale)
        );
        if (u_clipMode == 1) {
          if (
            canvasPoint.x < u_clipInset.w ||
            canvasPoint.x > u_canvasSize.x - u_clipInset.y ||
            canvasPoint.y < u_clipInset.x ||
            canvasPoint.y > u_canvasSize.y - u_clipInset.z
          ) {
            discard;
          }
        } else if (u_clipMode == 2 && !pointInPolygon(canvasPoint)) {
          discard;
        }

        vec4 color = texture(u_sampler, v_texCoord);
        color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
        color.r += u_warmth * 0.08;
        color.b -= u_warmth * 0.08;
        color.a *= u_opacity;
        outColor = clamp(color, 0.0, 1.0);
      }`
    );

    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    if (!program) return null;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  private compileShader(
    gl: WebGL2RenderingContext,
    type: GLenum,
    source: string
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private getShaderLocations(
    gl: WebGL2RenderingContext,
    program: WebGLProgram
  ): ShaderLocations | null {
    const position = gl.getAttribLocation(program, "a_position");
    const texCoord = gl.getAttribLocation(program, "a_texCoord");
    const positionResolution = gl.getUniformLocation(
      program,
      "u_positionResolution"
    );
    const canvasSize = gl.getUniformLocation(program, "u_canvasSize");
    const opacity = gl.getUniformLocation(program, "u_opacity");
    const contrast = gl.getUniformLocation(program, "u_contrast");
    const warmth = gl.getUniformLocation(program, "u_warmth");
    const renderScale = gl.getUniformLocation(program, "u_renderScale");
    const clipMode = gl.getUniformLocation(program, "u_clipMode");
    const clipInset = gl.getUniformLocation(program, "u_clipInset");
    const polygonPointCount = gl.getUniformLocation(
      program,
      "u_polygonPointCount"
    );
    const polygonPoints = gl.getUniformLocation(program, "u_polygonPoints");
    const sampler = gl.getUniformLocation(program, "u_sampler");

    if (
      position < 0 ||
      texCoord < 0 ||
      !positionResolution ||
      !canvasSize ||
      !opacity ||
      !contrast ||
      !warmth ||
      !renderScale ||
      !clipMode ||
      !clipInset ||
      !polygonPointCount ||
      !polygonPoints ||
      !sampler
    ) {
      return null;
    }

    return {
      position,
      texCoord,
      positionResolution,
      canvasSize,
      opacity,
      contrast,
      warmth,
      renderScale,
      clipMode,
      clipInset,
      polygonPointCount,
      polygonPoints,
      sampler,
    };
  }

  private drawClipFrame(
    clipId: string,
    sourceTimeUs: number,
    opacity: number,
    effects: CompositorClipEffects,
    clipPath: CompositorClipPath | null,
    transform: CompositorClipTransform,
    frame: VideoFrame
  ): boolean {
    if (!this.webgl) return false;

    const texture = this.getOrUploadFrameTexture(frame);
    if (!texture) {
      this.logWarn("WebGL2 could not upload frame texture", {
        frameTimestampUs: frame.timestamp,
        frameDisplayWidth: frame.displayWidth,
        frameDisplayHeight: frame.displayHeight,
      });
      return false;
    }

    const drawRect = getObjectContainRect(
      frame,
      this.canvasWidth,
      this.canvasHeight
    );
    this.logDebug("Drawing clip frame in WebGL2 renderer", {
      clipId,
      sourceTimeUs,
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
    this.drawTextureQuad(
      texture.texture,
      this.buildTransformedQuad(drawRect, transform),
      opacity,
      effects,
      clipPath
    );
    this.drainGlErrors("after-video-draw", {
      clipId,
      sourceTimeUs,
      frameTimestampUs: frame.timestamp,
    });
    return true;
  }

  private getOrUploadFrameTexture(frame: VideoFrame): TextureRecord | null {
    if (!this.webgl) return null;

    const cached = this.webgl.frameTextures.get(frame);
    if (cached) return cached;

    const { gl } = this.webgl;
    const texture = gl.createTexture();
    if (!texture) {
      this.logWarn("Failed to allocate WebGL2 texture for frame", {
        frameTimestampUs: frame.timestamp,
      });
      return null;
    }

    this.configureTexture(gl, texture);
    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        frame
      );
      this.logDebug("Uploaded VideoFrame into WebGL2 texture", {
        frameTimestampUs: frame.timestamp,
        frameDisplayWidth: frame.displayWidth,
        frameDisplayHeight: frame.displayHeight,
      });
    } catch {
      this.logWarn("WebGL2 texImage2D failed for VideoFrame upload", {
        frameTimestampUs: frame.timestamp,
        frameDisplayWidth: frame.displayWidth,
        frameDisplayHeight: frame.displayHeight,
      });
      gl.deleteTexture(texture);
      return null;
    }

    const record = { texture };
    this.webgl.frameTextures.set(frame, record);
    return record;
  }

  private drawOverlay(request: CompositorRenderRequest): boolean {
    if (!this.webgl) return false;

    const hasOverlayContent =
      request.textObjects.length > 0 || request.captionFrame !== null;
    if (!hasOverlayContent) {
      this.logDebug("Skipping WebGL2 overlay draw because overlay is empty");
      return false;
    }

    const overlayCtx = this.renderOverlayCanvas(request);
    if (!overlayCtx) {
      this.logWarn(
        "Skipped WebGL2 overlay draw because overlay context is unavailable"
      );
      return false;
    }

    const { gl, overlayTexture } = this.webgl;
    this.configureTexture(gl, overlayTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      overlayCtx.canvas
    );

    this.logDebug("Uploading overlay canvas for WebGL2 draw", {
      textObjectCount: request.textObjects.length,
      hasCaptionFrame: request.captionFrame !== null,
      overlayWidth: overlayCtx.canvas.width,
      overlayHeight: overlayCtx.canvas.height,
    });

    this.drawTextureQuad(
      overlayTexture,
      this.buildFullscreenQuad(),
      1,
      IDENTITY_EFFECTS,
      null
    );
    this.drainGlErrors("after-overlay-draw");
    return true;
  }

  private renderOverlayCanvas(
    request: CompositorRenderRequest
  ): OffscreenCanvasRenderingContext2D | null {
    this.ensureOverlayCanvas();
    if (!this.overlayCtx) {
      this.logWarn("Overlay canvas context is unavailable for WebGL2 renderer");
      return null;
    }

    this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.overlayCtx.clearRect(
      0,
      0,
      this.overlayCtx.canvas.width,
      this.overlayCtx.canvas.height
    );
    this.overlayCtx.setTransform(
      this.quality.scale,
      0,
      0,
      this.quality.scale,
      0,
      0
    );
    for (const text of request.textObjects) {
      drawTextObject(this.overlayCtx, text);
    }
    if (request.captionFrame) {
      this.overlayCtx.drawImage(
        request.captionFrame.bitmap,
        0,
        0,
        this.canvasWidth,
        this.canvasHeight
      );
    }

    this.logDebug("Rendered overlay canvas for WebGL2", {
      textObjectCount: request.textObjects.length,
      hasCaptionFrame: request.captionFrame !== null,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
    });

    return this.overlayCtx;
  }

  private drawTextureQuad(
    texture: WebGLTexture,
    vertices: Float32Array,
    opacity: number,
    effects: CompositorClipEffects,
    clipPath: CompositorClipPath | null
  ): void {
    if (!this.webgl) return;

    const { gl, program, vertexBuffer, locations } = this.webgl;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(locations.texCoord);
    gl.vertexAttribPointer(
      locations.texCoord,
      2,
      gl.FLOAT,
      false,
      stride,
      2 * Float32Array.BYTES_PER_ELEMENT
    );

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(locations.sampler, 0);
    gl.uniform2f(
      locations.positionResolution,
      this.canvasWidth,
      this.canvasHeight
    );
    gl.uniform2f(locations.canvasSize, this.canvasWidth, this.canvasHeight);
    gl.uniform1f(locations.opacity, this.clamp(opacity, 0, 1));
    gl.uniform1f(locations.contrast, Math.max(0, 1 + effects.contrast / 100));
    gl.uniform1f(locations.warmth, this.clamp(effects.warmth / 100, -1, 1));
    gl.uniform1f(locations.renderScale, this.quality.scale);
    this.applyClipUniforms(clipPath);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private buildRenderFailureResult(
    request: CompositorRenderRequest
  ): CompositorRenderResult {
    const drawableClips = getDrawableClips(request.clips);
    const overlayDrawn =
      request.textObjects.length > 0 || request.captionFrame !== null;
    return {
      ok: false,
      stats: {
        totalClipCount: request.clips.length,
        drawableClipCount: drawableClips.length,
        drawableClipIds: drawableClips.map((clip) => clip.clipId),
        drawnVideoClipCount: 0,
        drawnVideoClipIds: [],
        missingFrameClipCount: 0,
        missingFrameClipIds: [],
        failedVideoClipCount: 0,
        failedVideoClipIds: [],
        textObjectCount: request.textObjects.length,
        captionFramePresent: request.captionFrame !== null,
        overlayDrawn,
        overlayOnly: overlayDrawn,
      },
    };
  }

  private drainGlErrors(
    stage: string,
    context?: Record<string, unknown>
  ): void {
    if (!this.webgl) return;

    const { gl } = this.webgl;
    const errors: number[] = [];
    let error = gl.getError();
    while (error !== gl.NO_ERROR) {
      errors.push(error);
      error = gl.getError();
    }

    if (errors.length === 0) return;

    this.logWarn("Observed WebGL2 errors", {
      stage,
      errorCodes: errors.join(","),
      ...context,
    });
  }

  private applyClipUniforms(clipPath: CompositorClipPath | null): void {
    if (!this.webgl) return;

    const { gl, locations } = this.webgl;
    if (!clipPath) {
      gl.uniform1i(locations.clipMode, 0);
      gl.uniform4f(locations.clipInset, 0, 0, 0, 0);
      gl.uniform1i(locations.polygonPointCount, 0);
      gl.uniform2fv(
        locations.polygonPoints,
        new Float32Array(MAX_POLYGON_POINTS * 2)
      );
      return;
    }

    if (clipPath.type === "inset") {
      gl.uniform1i(locations.clipMode, 1);
      gl.uniform4f(
        locations.clipInset,
        (clipPath.top / 100) * this.canvasHeight,
        (clipPath.right / 100) * this.canvasWidth,
        (clipPath.bottom / 100) * this.canvasHeight,
        (clipPath.left / 100) * this.canvasWidth
      );
      gl.uniform1i(locations.polygonPointCount, 0);
      return;
    }

    const points = new Float32Array(MAX_POLYGON_POINTS * 2);
    const pointCount = Math.min(clipPath.points.length, MAX_POLYGON_POINTS);
    for (let index = 0; index < pointCount; index += 1) {
      const point = clipPath.points[index]!;
      points[index * 2] = (point.x / 100) * this.canvasWidth;
      points[index * 2 + 1] = (point.y / 100) * this.canvasHeight;
    }

    gl.uniform1i(locations.clipMode, pointCount >= 3 ? 2 : 0);
    gl.uniform4f(locations.clipInset, 0, 0, 0, 0);
    gl.uniform1i(locations.polygonPointCount, pointCount);
    gl.uniform2fv(locations.polygonPoints, points);
  }

  private buildTransformedQuad(
    rect: DrawRect,
    transform: CompositorClipTransform
  ): Float32Array {
    const topLeft = this.applyTransform(rect.dx, rect.dy, transform);
    const topRight = this.applyTransform(rect.dx + rect.dw, rect.dy, transform);
    const bottomLeft = this.applyTransform(
      rect.dx,
      rect.dy + rect.dh,
      transform
    );
    const bottomRight = this.applyTransform(
      rect.dx + rect.dw,
      rect.dy + rect.dh,
      transform
    );

    return new Float32Array([
      topLeft.x,
      topLeft.y,
      0,
      0,
      topRight.x,
      topRight.y,
      1,
      0,
      bottomLeft.x,
      bottomLeft.y,
      0,
      1,
      bottomRight.x,
      bottomRight.y,
      1,
      1,
    ]);
  }

  private buildFullscreenQuad(): Float32Array {
    return new Float32Array([
      0,
      0,
      0,
      0,
      this.canvasWidth,
      0,
      1,
      0,
      0,
      this.canvasHeight,
      0,
      1,
      this.canvasWidth,
      this.canvasHeight,
      1,
      1,
    ]);
  }

  private applyTransform(
    x: number,
    y: number,
    transform: CompositorClipTransform
  ): { x: number; y: number } {
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;
    const scale =
      Number.isFinite(transform.scale) && transform.scale > 0
        ? transform.scale
        : 1;

    let transformedX = centerX + (x - centerX) * scale;
    let transformedY = centerY + (y - centerY) * scale;

    transformedX +=
      transform.translateX +
      (transform.translateXPercent / 100) * this.canvasWidth;
    transformedY +=
      transform.translateY +
      (transform.translateYPercent / 100) * this.canvasHeight;

    if (transform.rotationDeg === 0) {
      return { x: transformedX, y: transformedY };
    }

    const radians = (transform.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const relativeX = transformedX - centerX;
    const relativeY = transformedY - centerY;

    return {
      x: centerX + relativeX * cos - relativeY * sin,
      y: centerY + relativeX * sin + relativeY * cos,
    };
  }

  private configureTexture(
    gl: WebGL2RenderingContext,
    texture: WebGLTexture
  ): void {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  private ensureOverlayCanvas(): void {
    if (!this.overlayCanvas) {
      this.overlayCanvas = new OffscreenCanvas(
        Math.max(1, Math.round(this.canvasWidth * this.quality.scale)),
        Math.max(1, Math.round(this.canvasHeight * this.quality.scale))
      );
      this.overlayCtx = this.overlayCanvas.getContext(
        "2d"
      ) as OffscreenCanvasRenderingContext2D | null;
      return;
    }

    this.applyOverlayCanvasSize();
  }

  private applyOverlayCanvasSize(): void {
    if (!this.overlayCanvas) return;

    this.overlayCanvas.width = Math.max(
      1,
      Math.round(this.canvasWidth * this.quality.scale)
    );
    this.overlayCanvas.height = Math.max(
      1,
      Math.round(this.canvasHeight * this.quality.scale)
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

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }
}
