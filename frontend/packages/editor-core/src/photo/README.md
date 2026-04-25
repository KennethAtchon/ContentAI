# Photo

Still-image editing pipeline with adjustments, photo operations, retouching tools, and image-specific types.

## Read Order

1. `index.ts`
2. `types.ts`
3. `photo-engine.ts`
4. `photo-adjustments.ts`
5. `retouching-engine.ts`

## Files

- `index.ts` - barrel file that defines the public exports for this folder.
- `photo-adjustments.ts` - implements still-image adjustment operations.
- `photo-engine.ts` - coordinates photo editing operations and image processing.
- `retouching-engine.ts` - implements localized photo retouching operations.
- `types.ts` - folder-local type definitions and constants.

## Dependencies

Canvas/ImageData primitives and adjustment definitions.

## Used By

Photo layers, still-image tools, retouch panels, and export paths that process image frames.
