# Actions

Command validation, execution, serialization, undo, redo, and inverse-action generation for project edits.

## Read Order

1. `index.ts`
2. `action-validator.ts`
3. `action-executor.ts`
4. `inverse-action-generator.ts`
5. `action-history.ts`
6. `action-serializer.ts`

## Files

- `action-executor.ts` - applies validated editor actions to project state.
- `action-history.ts` - tracks undo/redo stacks, grouped changes, and history snapshots.
- `action-serializer.ts` - converts actions to and from storable/transportable payloads.
- `action-validator.ts` - checks action payloads before they mutate project state.
- `index.ts` - barrel file that defines the public exports for this folder.
- `inverse-action-generator.ts` - builds inverse actions used for undo and rollback flows.

## Dependencies

Shared action/project/timeline types and immutable update helpers.

## Used By

Editor UI command handlers, collaboration layers, autosave, and any workflow that needs reversible project mutations.
