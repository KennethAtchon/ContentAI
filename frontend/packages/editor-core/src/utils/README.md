# Utils

Small shared utilities for IDs, clamping, cloning, serialization, and immutable updates.

## Read Order

1. `index.ts`
2. `serialization.ts`
3. `immutable-updates.ts`

## Files

- `immutable-updates.ts` - helpers for updating nested data without mutating originals.
- `index.ts` - barrel file that defines the public exports for this folder.
- `serialization.ts` - safe serialization helpers for project and editor data.

## Dependencies

Plain TypeScript/JavaScript primitives.

## Used By

Actions, storage, timeline, and any code path that needs safe object updates or project serialization.
