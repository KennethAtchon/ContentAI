# Text

Title, subtitle, caption, transcription, speech-to-text, text animation, and audio/text synchronization features.

## Read Order

1. `index.ts`
2. `types.ts`
3. `title-engine.ts`
4. `subtitle-engine.ts`
5. `speech-to-text-engine.ts`
6. `transcription-service.ts`
7. `caption-animation-renderer.ts`
8. `text-animation.ts`
9. `text-animation-presets.ts`
10. `character-animator.ts`
11. `audio-text-sync-engine.ts`

## Files

- `audio-text-sync-engine.ts` - aligns text/caption timing with audio analysis cues.
- `caption-animation-renderer.ts` - renders animated captions for preview/export.
- `character-animator.ts` - animates text at character-level granularity.
- `index.ts` - barrel file that defines the public exports for this folder.
- `speech-to-text-engine.ts` - adapts speech recognition/transcription engines.
- `subtitle-engine.ts` - parses, edits, and serializes subtitle/caption data.
- `text-animation-presets.ts` - defines reusable text animation presets.
- `text-animation.ts` - evaluates text animation timing and properties.
- `title-engine.ts` - creates and renders title/text layer presets.
- `transcription-service.ts` - coordinates transcription jobs and transcript normalization.
- `types.ts` - folder-local type definitions and constants.

## Dependencies

Canvas text rendering, subtitle/transcription formats, timeline timing, and optional speech APIs.

## Used By

Text layers, subtitles/captions, transcript editing, karaoke-style highlighting, and title presets.
