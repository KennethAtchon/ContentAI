# Test

Property-based testing helpers, fast-check configuration, and generators for editor-core domain objects.

## Read Order

1. `index.ts`
2. `fc-config.ts`
3. `generators.ts`

## Files

- `fc-config.ts` - centralizes fast-check settings for deterministic property tests.
- `generators.ts` - creates generated domain objects for property and unit tests.
- `index.ts` - barrel file that defines the public exports for this folder.

## Dependencies

fast-check and shared editor-core domain types.

## Used By

Unit/property tests across actions, timeline, export, device, and media behavior.
