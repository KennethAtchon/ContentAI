# Effects

Reusable visual effect primitives including blend modes, expression evaluation, particles, and presets.

## Read Order

1. `index.ts`
2. `blend-modes.ts`
3. `expression-engine.ts`
4. `particle-types.ts`
5. `particle-engine.ts`
6. `particle-presets.ts`

## Files

- `blend-modes.ts` - defines blend-mode math and helpers for compositing.
- `expression-engine.ts` - evaluates expressions that drive dynamic effect or animation values.
- `index.ts` - barrel file that defines the public exports for this folder.
- `particle-engine.ts` - simulates particle emitters and particle lifecycles.
- `particle-presets.ts` - contains reusable particle effect presets.
- `particle-types.ts` - declares particle engine configuration and runtime types.

## Dependencies

Layer/effect types and renderer-specific processors.

## Used By

Video compositing, template animation, generated effects, and timeline effect panels.
