# Storage

Project serialization, schema definitions, persistent storage, and cache management.

## Read Order

1. `index.ts`
2. `types.ts`
3. `schema-types.ts`
4. `project-serializer.ts`
5. `storage-engine.ts`
6. `cache-manager.ts`

## Files

- `cache-manager.ts` - stores and evicts cached media/project artifacts.
- `index.ts` - barrel file that defines the public exports for this folder.
- `project-serializer.ts` - serializes and deserializes project documents across schema versions.
- `schema-types.ts` - declares persisted storage schema shapes.
- `storage-engine.ts` - implements project persistence against browser storage backends.
- `types.ts` - folder-local type definitions and constants.

## Dependencies

Project schema types, browser storage APIs, and cache metadata.

## Used By

Save/load, autosave, project migration, media caching, and offline-friendly editing.
