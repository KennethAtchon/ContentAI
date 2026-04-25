# Export

Final render orchestration, export presets/settings, progress reporting, worker handoff, and downloadable output creation.

## Read Order

1. `index.ts`
2. `types.ts`
3. `export-engine.ts`
4. `export-worker.ts`
5. `export-engine.test.ts`

## Files

- `export-engine.test.ts` - test coverage for the neighboring implementation module.
- `export-engine.ts` - orchestrates final media rendering and export result creation.
- `export-worker.ts` - runs export work off the main thread when worker execution is available.
- `index.ts` - barrel file that defines the public exports for this folder.
- `types.ts` - folder-local type definitions and constants.

## Dependencies

Video/audio/media engines, export settings, browser Blob APIs, workers, and optional upscaling settings.

## Used By

Export dialogs, batch export flows, render progress UI, and downloadable video/audio/image/sequence outputs.
