# Media

Media import, metadata extraction, transcoding/proxy fallback, GIF decoding, and waveform generation/rendering.

## Read Order

1. `index.ts`
2. `types.ts`
3. `mediabunny-engine.ts`
4. `media-import-service.ts`
5. `ffmpeg-fallback.ts`
6. `waveform-generator.ts`
7. `waveform-renderer.ts`
8. `gif-decoder.ts`

## Files

- `ffmpeg-fallback.ts` - provides proxy/transcode fallback logic for unsupported media paths.
- `gif-decoder.ts` - decodes animated GIFs and exposes frame lookup helpers.
- `index.ts` - barrel file that defines the public exports for this folder.
- `media-import-service.ts` - coordinates media import, metadata extraction, thumbnails, and proxies.
- `mediabunny-engine.ts` - wraps the primary media decoding/inspection engine.
- `types.ts` - folder-local type definitions and constants.
- `waveform-generator.ts` - generates waveform data at one or more resolutions.
- `waveform-renderer.ts` - draws waveform data into canvas/image thumbnails.

## Dependencies

Mediabunny/FFmpeg-style media helpers, browser file APIs, canvas, audio decoding, and cacheable metadata types.

## Used By

Asset import, clip creation, preview thumbnails, proxy generation, waveform UI, and GIF support.
