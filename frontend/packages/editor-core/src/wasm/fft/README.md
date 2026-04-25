# WASM FFT

FFT module loader and public wrapper for spectral audio analysis acceleration.

## Read Order

1. `index.ts`
2. `assembly/index.ts`

## Files

- `index.ts` - barrel file that defines the public exports for this folder.

## Subfolders

- [assembly](assembly) - AssemblyScript implementation compiled into the FFT WebAssembly module.

## Dependencies

WebAssembly availability and an AssemblyScript FFT implementation.

## Used By

Audio analysis and beat detection workflows.
