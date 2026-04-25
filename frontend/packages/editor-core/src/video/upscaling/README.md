# Video Upscaling

GPU-assisted frame upscaling pipeline, quality presets, and type definitions.

## Read Order

1. `index.ts`
2. `upscaling-types.ts`
3. `upscaling-engine.ts`
4. `shaders/index.ts`

## Files

- `index.ts` - barrel file that defines the public exports for this folder.
- `upscaling-engine.ts` - executes the WebGPU upscaling pipeline.
- `upscaling-types.ts` - declares upscaling settings, methods, and result types.

## Subfolders

- [shaders](shaders) - WGSL shader modules for Lanczos scaling, edge detection, edge-directed interpolation, and sharpening.

## Dependencies

WebGPU device/texture primitives and upscaling WGSL shader modules.

## Used By

Export and preview paths that need higher-resolution output or sharper scaled frames.
