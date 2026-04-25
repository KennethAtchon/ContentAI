# Animation

Portable animation schema, easing utilities, import/export adapters, and GSAP-backed timeline playback helpers.

## Read Order

1. `index.ts`
2. `animation-schema.ts`
3. `easing-functions.ts`
4. `animation-importer.ts`
5. `animation-exporter.ts`
6. `gsap-engine.ts`
7. `composition-renderer.ts`

## Files

- `animation-exporter.ts` - serializes animation schema objects into portable output formats.
- `animation-importer.ts` - normalizes imported animation JSON into the local schema.
- `animation-schema.ts` - declares the portable animation data model and validation helpers.
- `composition-renderer.ts` - renders animation compositions from schema layers and timing data.
- `easing-functions.ts` - implements easing curves, presets, interpolation, and lookup helpers.
- `gsap-engine.ts` - bridges editor animation data into GSAP timelines and motion paths.
- `index.ts` - barrel file that defines the public exports for this folder.

## Dependencies

Core composition types, easing names, and asset/layer definitions.

## Used By

Template playback, motion graphics, schema import/export, and animated layer rendering.
