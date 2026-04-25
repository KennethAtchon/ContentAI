# WASM

Optional WebAssembly-backed acceleration for FFT, WAV encoding, and beat detection.

## Read Order

1. `index.ts`
2. `fft/index.ts`
3. `wav/index.ts`
4. `beat-detection/index.ts`

## Files

- `index.ts` - barrel file that defines the public exports for this folder.

## Subfolders

- [beat-detection](beat-detection) - Beat-detection module loader and public wrapper for accelerated rhythm analysis.
- [fft](fft) - FFT module loader and public wrapper for spectral audio analysis acceleration.
- [wav](wav) - WAV encoder module loader and public wrapper for audio export acceleration.

## Dependencies

WebAssembly support and AssemblyScript-compiled modules where available.

## Used By

Audio analysis, WAV export, and performance-sensitive signal processing paths with JS fallbacks.
