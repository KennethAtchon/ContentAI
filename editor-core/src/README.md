# Editor Core Rust Guide

`editor-core` is the Rust/WASM timeline core for the ReelStudio editor. React still owns UI state; `PreviewEngine` is the only frontend runtime that should call this module.

## What Lives Here

- `compute_duration(tracks)` returns the max clip end time in milliseconds.
- `resolve_frame(tracks, playhead_ms)` returns the top visible video frame request for a playhead position.
- `build_compositor_descriptors(tracks, playhead_ms, effect_preview)` mirrors the TypeScript compositor descriptor protocol used by `CompositorWorker`.
- `sanitize_no_overlap(tracks)` returns tracks with clip starts shifted to avoid overlap and media trim invariants preserved.

The Rust input and output shapes intentionally use the existing TypeScript editor JSON names, such as `startMs`, `durationMs`, `clipId`, `sourceTimeUs`, and `clipPath`. Keep those names stable unless the TypeScript protocol changes too.

## Local Checks

From `editor-core/`:

```bash
cargo fmt --check
cargo test
```

To build the browser artifact, install `wasm-pack` and the `wasm32-unknown-unknown` Rust target, then run:

```bash
wasm-pack build --target web --out-dir ../frontend/src/features/editor/wasm
```

The generated `frontend/src/features/editor/wasm/` directory is ignored by git. The frontend loader will use it when present and fall back to the TypeScript descriptor builder when absent.

## Frontend Usage

Do not import generated WASM files from React components. The integration point is:

```ts
frontend/src/features/editor/engine/editor-core-wasm.ts
```

`PreviewEngine` calls:

```ts
buildCompositorDescriptorsWithRustFallback(...)
```

That wrapper attempts Rust first and falls back to `buildCompositorClips()` if the generated WASM module is missing or throws. The debug runtime exposes `editorCoreWasm` so a developer can confirm whether Rust or fallback is active:

```js
window.__REEL_EDITOR_DEBUG__.snapshot().debug.editorCoreWasm
```

## Adding Timeline Behavior

When changing timeline math:

1. Update the Rust implementation in `lib.rs`.
2. Add or update a Rust golden test in `#[cfg(test)]`.
3. Keep the TypeScript fallback behavior equivalent until Rust is proven active in browser fixtures.
4. Run `cargo test`, `bunx tsc --noEmit`, and the editor unit tests.

Avoid adding browser APIs here. This crate should stay deterministic timeline math plus serde/wasm-bindgen boundaries; decode, WebCodecs, and rendering stay in TypeScript workers for now.
