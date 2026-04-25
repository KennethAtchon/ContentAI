# Video Shaders

WGSL shader modules used by WebGPU video rendering for transforms, compositing, effects, blur, and border radius handling.

## Read Order

1. `index.ts`
2. `transform.wgsl`
3. `composite.wgsl`
4. `effects.wgsl`
5. `blur.wgsl`
6. `border-radius.wgsl`

## Files

- `blur.wgsl` - WGSL blur shader used by GPU video effects..
- `border-radius.wgsl` - WGSL mask shader for rounded video or layer edges..
- `composite.wgsl` - WGSL compositor shader for combining source layers..
- `effects.wgsl` - WGSL effect shader collection for GPU visual processing..
- `index.ts` - barrel file that defines the public exports for this folder.
- `transform.wgsl` - WGSL transform shader for placing and sampling video layers..

## Dependencies

WebGPU renderer bind-group conventions and texture/sampler layouts.

## Used By

video/webgpu-renderer-impl.ts, video/webgpu-effects-processor.ts, and related GPU composition code.
