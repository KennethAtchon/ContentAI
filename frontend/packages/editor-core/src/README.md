# Source Root

The `src` folder contains the public package barrel and all editor-core feature modules. Treat this level as the map of the package: `index.ts` is what downstream packages import, while each subfolder owns one domain area.

## Read Order

1. `index.ts`
2. `types`
3. `timeline`
4. `actions`
5. `media`, `video`, `audio`, `text`, `photo`, and `graphics`
6. `playback`, `storage`, `export`, and `device`
7. Optional feature folders such as `animation`, `effects`, `template`, `ai`, and `wasm`

## Files

- `index.ts` - package-level barrel that exposes the stable editor-core API.

## Subfolders

- [actions](actions) - Command validation, execution, serialization, undo, redo, and inverse-action generation for project edits.
- [ai](ai) - AI-assisted media transforms that can be layered into import, edit, or export workflows.
- [animation](animation) - Portable animation schema, easing utilities, import/export adapters, and GSAP-backed timeline playback helpers.
- [audio](audio) - Audio graph construction, effects, analysis, beat detection, synthesis, volume automation, and realtime worklet processing.
- [device](device) - Browser/device capability detection plus export-time estimation and benchmark caching.
- [effects](effects) - Reusable visual effect primitives including blend modes, expression evaluation, particles, and presets.
- [export](export) - Final render orchestration, export presets/settings, progress reporting, worker handoff, and downloadable output creation.
- [graphics](graphics) - SVG/graphic asset handling, sticker libraries, vector rendering helpers, and animation presets for graphic elements.
- [media](media) - Media import, metadata extraction, transcoding/proxy fallback, GIF decoding, and waveform generation/rendering.
- [photo](photo) - Still-image editing pipeline with adjustments, photo operations, retouching tools, and image-specific types.
- [playback](playback) - Timeline clocking and playback orchestration independent of a specific renderer.
- [storage](storage) - Project serialization, schema definitions, persistent storage, and cache management.
- [template](template) - Template application and variable substitution for reusable editor projects/compositions.
- [test](test) - Property-based testing helpers, fast-check configuration, and generators for editor-core domain objects.
- [text](text) - Title, subtitle, caption, transcription, speech-to-text, text animation, and audio/text synchronization features.
- [timeline](timeline) - Track/clip mutation logic, snapping/overlap rules, and nested sequence/compound clip support.
- [types](types) - Shared TypeScript contracts for projects, timelines, actions, effects, templates, Lottie, transitions, shapes, sounds, and results.
- [utils](utils) - Small shared utilities for IDs, clamping, cloning, serialization, and immutable updates.
- [video](video) - Video decode/playback/rendering, WebGPU/Canvas renderers, effects, transitions, masks, speed changes, multicam, tracking, caching, and frame buffering.
- [wasm](wasm) - Optional WebAssembly-backed acceleration for FFT, WAV encoding, and beat detection.

## Dependencies

This root should stay thin. It depends on folder-level barrels and selected export types/constants, but it should not contain feature implementation logic.

## Used By

Application packages and tests import editor-core APIs from this root barrel whenever they need package-level behavior.
