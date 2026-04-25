# Upscaling Shaders

WGSL shader modules for Lanczos scaling, edge detection, edge-directed interpolation, and sharpening.

## Read Order

1. `index.ts`
2. `lanczos.wgsl`
3. `edge-detect.wgsl`
4. `edge-directed.wgsl`
5. `sharpen.wgsl`

## Files

- `edge-detect.wgsl` - WGSL edge detection pass used by advanced upscaling..
- `edge-directed.wgsl` - WGSL edge-directed interpolation pass for preserving detail while upscaling..
- `index.ts` - barrel file that defines the public exports for this folder.
- `lanczos.wgsl` - WGSL Lanczos upscaling shader..
- `sharpen.wgsl` - WGSL sharpening pass used after scaling..

## Dependencies

The upscaling engine pipeline layout and texture binding conventions.

## Used By

video/upscaling/upscaling-engine.ts.
