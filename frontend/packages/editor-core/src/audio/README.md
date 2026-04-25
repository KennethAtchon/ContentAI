# Audio

Audio graph construction, effects, analysis, beat detection, synthesis, volume automation, and realtime worklet processing.

## Read Order

1. `index.ts`
2. `types.ts`
3. `audio-engine.ts`
4. `realtime-audio-graph.ts`
5. `effects-worklet-processor.ts`
6. `audio-effects-engine.ts`
7. `beat-detection-engine.ts`

## Files

- `audio-effects-engine.ts` - applies audio effects and effect-chain processing.
- `audio-engine.ts` - coordinates core audio loading, playback, decoding, and graph setup.
- `beat-detection-engine.ts` - finds beats and rhythmic markers in decoded audio buffers.
- `effects-worklet-processor.ts` - runs realtime audio effects inside an AudioWorklet processor.
- `fft.ts` - performs frequency-domain analysis for audio features.
- `index.ts` - barrel file that defines the public exports for this folder.
- `noise-reduction.ts` - reduces background noise from audio buffers or streams.
- `realtime-audio-graph.ts` - builds and controls the realtime Web Audio node graph.
- `realtime-processor.ts` - processes realtime audio samples for preview and analysis.
- `sound-generator.ts` - synthesizes generated tones, sweeps, or utility audio.
- `sound-library-engine.ts` - manages reusable sound assets and sound-library lookup.
- `types.ts` - folder-local type definitions and constants.
- `volume-automation.ts` - evaluates volume keyframes and automation envelopes over time.

## Dependencies

Web Audio, AudioWorklet processors, FFT helpers, and waveform/time-domain primitives.

## Used By

Timeline playback, audio clip editing, waveform display, music/sound libraries, and export mixing.
