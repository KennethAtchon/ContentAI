# Types

Shared TypeScript contracts for projects, timelines, actions, effects, templates, Lottie, transitions, shapes, sounds, and results.

## Read Order

1. `index.ts`
2. `project.ts`
3. `timeline.ts`
4. `actions.ts`
5. `effects.ts`
6. `composition.ts`
7. `template.ts`
8. `scriptable-template.ts`
9. `lottie.ts`
10. `transitions.ts`
11. `shape-tools.ts`
12. `sound-library.ts`
13. `transform-3d.ts`
14. `result.ts`

## Files

- `actions.ts` - shared action type definitions for editor mutations.
- `composition.ts` - shared composition and layer-related domain types.
- `effects.ts` - shared effect configuration and preset types.
- `index.ts` - barrel file that defines the public exports for this folder.
- `lottie.ts` - Lottie schema compatibility, layer, asset, and export types.
- `project.ts` - root project document and metadata types.
- `result.ts` - standard success/error result type helpers.
- `scriptable-template.ts` - scriptable template configuration and variable types.
- `shape-tools.ts` - shape drawing tool state and default shape config helpers.
- `sound-library.ts` - sound-library asset and category types.
- `template.ts` - template metadata, variables, and category types.
- `timeline.ts` - timeline, track, clip, and time-range types.
- `transform-3d.ts` - 3D transform and perspective types.
- `transitions.ts` - transition types, presets, and creation helpers.

## Dependencies

No runtime dependencies; this folder should remain the stable vocabulary for the package.

## Used By

Nearly every other folder in editor-core and downstream app packages.
