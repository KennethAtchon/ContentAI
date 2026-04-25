# Timeline

Track/clip mutation logic, snapping/overlap rules, and nested sequence/compound clip support.

## Read Order

1. `index.ts`
2. `track-manager.ts`
3. `clip-manager.ts`
4. `nested-sequence-engine.ts`
5. `clip-manager.test.ts`

## Files

- `clip-manager.test.ts` - test coverage for the neighboring implementation module.
- `clip-manager.ts` - adds, moves, trims, snaps, and validates timeline clips.
- `index.ts` - barrel file that defines the public exports for this folder.
- `nested-sequence-engine.ts` - creates and flattens compound clips/nested sequences.
- `track-manager.ts` - creates, orders, and validates timeline tracks.

## Dependencies

Timeline/project types and immutable update helpers.

## Used By

Timeline UI operations, action execution, playback ranges, export composition, and sequence editing.
