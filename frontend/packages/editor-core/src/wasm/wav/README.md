# WASM WAV

WAV encoder module loader and public wrapper for audio export acceleration.

## Read Order

1. `index.ts`
2. `assembly/index.ts`

## Files

- `index.ts` - barrel file that defines the public exports for this folder.

## Subfolders

- [assembly](assembly) - AssemblyScript implementation compiled into the WAV encoder WebAssembly module.

## Dependencies

WebAssembly availability and an AssemblyScript WAV encoder implementation.

## Used By

Audio and export workflows that need WAV output.
