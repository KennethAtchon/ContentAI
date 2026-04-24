import { Canvas2dCompositorRenderer } from "./Canvas2dCompositorRenderer";
import { Webgl2CompositorRenderer } from "./Webgl2CompositorRenderer";
import type { CompositorRenderer, CompositorRendererOptions } from "./types";
import { debugLog } from "@/shared/utils/debug";

const LOG_COMPONENT = "CompositorRendererFactory";

export type {
  CompositorClipDescriptor,
  CompositorClipEffects,
  CompositorClipPath,
  CompositorClipTransform,
  CompositorPreviewQuality,
  CompositorRenderResult,
  CompositorRenderStats,
  CompositorRenderer,
  CompositorRendererMode,
  CompositorRendererPreference,
  SerializedCaptionFrame,
  SerializedTextObject,
} from "./types";

export function createCompositorRenderer(
  options: CompositorRendererOptions
): CompositorRenderer {
  if (options.preference !== "canvas2d") {
    debugLog.debug("Attempting WebGL2 compositor renderer", {
      component: LOG_COMPONENT,
      width: options.width,
      height: options.height,
      previewQualityLevel: options.quality.level,
      previewQualityScale: options.quality.scale,
      requestedPreference: options.preference,
    });
    const webgl = Webgl2CompositorRenderer.create(
      options.canvas,
      options.width,
      options.height,
      options.quality
    );
    if (webgl) {
      debugLog.debug("Selected WebGL2 compositor renderer", {
        component: LOG_COMPONENT,
        requestedPreference: options.preference,
      });
      return webgl;
    }
  }

  debugLog.debug("Selected Canvas2D compositor renderer", {
    component: LOG_COMPONENT,
    width: options.width,
    height: options.height,
    previewQualityLevel: options.quality.level,
    previewQualityScale: options.quality.scale,
    requestedPreference: options.preference,
  });
  return new Canvas2dCompositorRenderer(
    options.canvas,
    options.width,
    options.height,
    options.quality
  );
}
