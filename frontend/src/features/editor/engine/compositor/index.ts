import { Canvas2dCompositorRenderer } from "./Canvas2dCompositorRenderer";
import { Webgl2CompositorRenderer } from "./Webgl2CompositorRenderer";
import type { CompositorRenderer, CompositorRendererOptions } from "./types";

export type {
  CompositorClipDescriptor,
  CompositorClipEffects,
  CompositorClipPath,
  CompositorClipTransform,
  CompositorPreviewQuality,
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
    const webgl = Webgl2CompositorRenderer.create(
      options.canvas,
      options.width,
      options.height,
      options.quality
    );
    if (webgl) return webgl;
  }

  return new Canvas2dCompositorRenderer(
    options.canvas,
    options.width,
    options.height,
    options.quality
  );
}
