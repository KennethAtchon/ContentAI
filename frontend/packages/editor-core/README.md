# @contentai/editor-core

editor-core is the domain and media-processing core for ContentAI's editor. It keeps the reusable editor logic outside UI packages: project types, timeline operations, action execution, media import, playback clocks, video/audio/photo/text processing, storage, export, templates, and optional GPU/WASM acceleration.

## Entry Point

Start at [src/index.ts](src/index.ts). That file is the package barrel: it re-exports the stable public API from the major feature folders and exposes the export engine/settings that downstream packages are expected to import. When you are tracing a feature, jump from src/index.ts into the folder-level index.ts first, then into the concrete engine or type file.

## How To Read This Package

1. Read [src/types](src/types) first. These files define the vocabulary used everywhere else: projects, timelines, clips, actions, effects, templates, transitions, Lottie, shapes, and result objects.
2. Read [src/timeline](src/timeline) and [src/actions](src/actions) next. Timeline managers describe legal edit operations; action classes validate, execute, serialize, and invert those operations.
3. Read [src/storage](src/storage) to understand how projects are serialized, persisted, cached, and migrated.
4. Read media-specific folders by workflow: [src/media](src/media) for import/metadata/waveforms, [src/video](src/video) for rendering and effects, [src/audio](src/audio) for mixing/analysis, [src/text](src/text) for subtitles/transcription/titles, [src/photo](src/photo) for still-image tools, and [src/graphics](src/graphics) for SVG/stickers.
5. Read [src/playback](src/playback), [src/export](src/export), and [src/device](src/device) when you need end-to-end preview/export behavior and performance adaptation.
6. Read [src/animation](src/animation), [src/effects](src/effects), [src/template](src/template), [src/ai](src/ai), and [src/wasm](src/wasm) for optional higher-level features and acceleration paths.
7. Use [src/test](src/test) for reusable generators and property-test configuration before adding new tests.

## Folder Map

- [src/actions](src/actions) - Command validation, execution, serialization, undo, redo, and inverse-action generation for project edits.
- [src/ai](src/ai) - AI-assisted media transforms that can be layered into import, edit, or export workflows.
- [src/animation](src/animation) - Portable animation schema, easing utilities, import/export adapters, and GSAP-backed timeline playback helpers.
- [src/audio](src/audio) - Audio graph construction, effects, analysis, beat detection, synthesis, volume automation, and realtime worklet processing.
- [src/device](src/device) - Browser/device capability detection plus export-time estimation and benchmark caching.
- [src/effects](src/effects) - Reusable visual effect primitives including blend modes, expression evaluation, particles, and presets.
- [src/export](src/export) - Final render orchestration, export presets/settings, progress reporting, worker handoff, and downloadable output creation.
- [src/graphics](src/graphics) - SVG/graphic asset handling, sticker libraries, vector rendering helpers, and animation presets for graphic elements.
- [src/media](src/media) - Media import, metadata extraction, transcoding/proxy fallback, GIF decoding, and waveform generation/rendering.
- [src/photo](src/photo) - Still-image editing pipeline with adjustments, photo operations, retouching tools, and image-specific types.
- [src/playback](src/playback) - Timeline clocking and playback orchestration independent of a specific renderer.
- [src/storage](src/storage) - Project serialization, schema definitions, persistent storage, and cache management.
- [src/template](src/template) - Template application and variable substitution for reusable editor projects/compositions.
- [src/test](src/test) - Property-based testing helpers, fast-check configuration, and generators for editor-core domain objects.
- [src/text](src/text) - Title, subtitle, caption, transcription, speech-to-text, text animation, and audio/text synchronization features.
- [src/timeline](src/timeline) - Track/clip mutation logic, snapping/overlap rules, and nested sequence/compound clip support.
- [src/types](src/types) - Shared TypeScript contracts for projects, timelines, actions, effects, templates, Lottie, transitions, shapes, sounds, and results.
- [src/utils](src/utils) - Small shared utilities for IDs, clamping, cloning, serialization, and immutable updates.
- [src/video](src/video) - Video decode/playback/rendering, WebGPU/Canvas renderers, effects, transitions, masks, speed changes, multicam, tracking, caching, and frame buffering.
- [src/wasm](src/wasm) - Optional WebAssembly-backed acceleration for FFT, WAV encoding, and beat detection.
- [src/video/shaders](src/video/shaders) - WGSL shader modules used by WebGPU video rendering for transforms, compositing, effects, blur, and border radius handling.
- [src/video/upscaling](src/video/upscaling) - GPU-assisted frame upscaling pipeline, quality presets, and type definitions.
- [src/wasm/fft](src/wasm/fft), [src/wasm/wav](src/wasm/wav), and [src/wasm/beat-detection](src/wasm/beat-detection) - WebAssembly module wrappers and their AssemblyScript sources.

## Core Data Flow

A typical edit starts as a UI command that creates an action. The action is validated in actions, applied to project/timeline state, and recorded in history for undo/redo. Media imports flow through media into project assets and timeline clips. Preview playback combines playback clocks with video/audio/text/graphics engines. Save/load flows through storage. Export uses the same project vocabulary plus media/video/audio renderers, optional device recommendations, and worker/GPU/WASM acceleration when available.

## Public API Shape

Most consumers should import from the package root instead of deep paths. Folder-level index.ts files intentionally group exports by feature area, while implementation files keep the operational logic. Types under src/types are the shared contracts; types.ts files inside feature folders are local contracts for that feature.

## Testing Notes

Tests live beside the folders they cover, with shared generators in src/test. Prefer adding focused tests near the manager/engine being changed, and use property generators when validating timeline/action invariants or serialization round trips.
