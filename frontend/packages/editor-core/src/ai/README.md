# AI

AI-assisted media transforms that can be layered into import, edit, or export workflows.

## Read Order

1. `index.ts`
2. `background-removal-engine.ts`
3. `auto-reframe-engine.ts`

## Files

- `auto-reframe-engine.ts` - analyzes frames and computes subject-aware crop/reframe data.
- `background-removal-engine.ts` - removes or masks image/video backgrounds for smart edit tools.
- `index.ts` - barrel file that defines the public exports for this folder.

## Dependencies

Canvas/image primitives, video frame metadata, and browser media APIs.

## Used By

Smart edit tools such as background removal, subject-aware reframing, and assisted composition fitting.
