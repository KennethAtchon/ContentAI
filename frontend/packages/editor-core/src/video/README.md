# Video

Video decode/playback/rendering, WebGPU/Canvas renderers, effects, transitions, masks, speed changes, multicam, tracking, caching, and frame buffering.

## Read Order

1. `index.ts`
2. `types.ts`
3. `video-engine.ts`
4. `renderer-factory.ts`
5. `webgpu-renderer-impl.ts`
6. `canvas2d-fallback-renderer.ts`
7. `video-effects-engine.ts`
8. `playback-engine.ts`
9. `transition-engine.ts`
10. `speed-engine.ts`
11. `frame-cache.ts`

## Files

- `adjustment-layer-engine.ts` - applies adjustment layers across underlying video content.
- `animation-engine.ts` - evaluates video layer animation properties over time.
- `canvas2d-fallback-renderer.ts` - renders video compositions with Canvas2D when WebGPU is unavailable.
- `chroma-key-engine.ts` - keys green-screen or color-screen footage into alpha masks.
- `color-grading-engine.ts` - applies color correction and grading operations.
- `composite-engine.ts` - combines layers into final frame composites.
- `decode-worker.ts` - decodes frames in worker context for parallel pipelines.
- `filter-presets.ts` - defines reusable visual filter presets.
- `frame-cache.ts` - caches decoded/rendered frames for preview performance.
- `frame-ring-buffer.ts` - buffers frames in a ring for smooth realtime playback.
- `gpu-compositor.ts` - composites layers with GPU-backed rendering paths.
- `index.ts` - barrel file that defines the public exports for this folder.
- `keyframe-engine.ts` - evaluates keyframed properties for video effects and transforms.
- `mask-engine.ts` - creates and applies masks to video layers.
- `motion-tracking-engine.ts` - tracks motion points/regions across video frames.
- `multicam-engine.ts` - coordinates multi-camera clip angles and switching.
- `parallel-frame-decoder.ts` - manages concurrent frame decode workers.
- `playback-engine.ts` - drives video playback preview and frame scheduling.
- `renderer-factory.ts` - selects the best available renderer implementation.
- `speed-engine.test.ts` - test coverage for the neighboring implementation module.
- `speed-engine.ts` - applies speed ramps, reverse playback, and time remapping.
- `texture-cache.ts` - caches GPU textures and handles their lifecycle.
- `transform-animator.ts` - evaluates animated transform properties for video layers.
- `transition-engine.ts` - renders transitions between timeline clips.
- `types.ts` - folder-local type definitions and constants.
- `unified-effects-processor.ts` - routes effects through GPU or CPU processors behind one API.
- `video-effects-engine.ts` - implements video effect processing and parameter evaluation.
- `video-engine.ts` - coordinates the main video editing/rendering engine.
- `webgpu-effects-processor.ts` - runs visual effects through WebGPU shaders.
- `webgpu-renderer-impl.ts` - implements the WebGPU renderer for timeline composition.
- `webgpu-types.d.ts` - declares WebGPU browser types used by TypeScript.

## Subfolders

- [shaders](shaders) - WGSL shader modules used by WebGPU video rendering for transforms, compositing, effects, blur, and border radius handling.
- [upscaling](upscaling) - GPU-assisted frame upscaling pipeline, quality presets, and type definitions.

## Dependencies

WebCodecs, Canvas2D, WebGPU, WGSL shaders, media types, and timeline/effect definitions.

## Used By

Preview rendering, export rendering, effect previews, thumbnail/frame extraction, and high-performance composition.
