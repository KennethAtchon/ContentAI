# Playback

Timeline clocking and playback orchestration independent of a specific renderer.

## Read Order

1. `index.ts`
2. `types.ts`
3. `master-timeline-clock.ts`
4. `playback-controller.ts`

## Files

- `index.ts` - barrel file that defines the public exports for this folder.
- `master-timeline-clock.ts` - keeps authoritative playback time and frame progression.
- `playback-controller.ts` - coordinates play, pause, seek, rate, and timeline playback state.
- `types.ts` - folder-local type definitions and constants.

## Dependencies

Timeline state, playback ranges, frame/time conversion, and listener callbacks.

## Used By

Preview transport controls, synchronized audio/video playback, and scrub/seek workflows.
