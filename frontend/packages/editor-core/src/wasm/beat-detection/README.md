# WASM Beat Detection

Beat-detection module loader and public wrapper for accelerated rhythm analysis.

## Read Order

1. `index.ts`
2. `assembly/index.ts`

## Files

- `index.ts` - barrel file that defines the public exports for this folder.

## Subfolders

- [assembly](assembly) - AssemblyScript implementation compiled into the beat detection WebAssembly module.

## Dependencies

WebAssembly availability and an AssemblyScript beat detection implementation.

## Used By

Audio beat analysis, music synchronization, and text/audio sync helpers.
