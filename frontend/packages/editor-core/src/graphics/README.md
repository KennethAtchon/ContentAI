# Graphics

SVG/graphic asset handling, sticker libraries, vector rendering helpers, and animation presets for graphic elements.

## Read Order

1. `index.ts`
2. `types.ts`
3. `graphics-engine.ts`
4. `sticker-library.ts`
5. `svg-animation-presets.ts`
6. `graphics-engine.test.ts`

## Files

- `graphics-engine.test.ts` - test coverage for the neighboring implementation module.
- `graphics-engine.ts` - renders and manipulates graphic/SVG/sticker assets.
- `index.ts` - barrel file that defines the public exports for this folder.
- `sticker-library.ts` - catalogs reusable sticker assets and metadata.
- `svg-animation-presets.ts` - provides animation presets for SVG or vector graphics.
- `types.ts` - folder-local type definitions and constants.

## Dependencies

Canvas/SVG APIs and shared project/effect types.

## Used By

Sticker panels, shape/graphic layers, SVG imports, and animated overlay workflows.
