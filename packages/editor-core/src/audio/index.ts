/**
 * @fileoverview barrel file that defines the public exports for this folder.
 *
 * Folder role: Audio graph construction, effects, analysis, beat detection, synthesis, volume automation, and realtime worklet processing.
 * Read this file with ../types and the folder README nearby; most exports here are wired through the local index.ts barrel.
 */

export * from "./types";
export * from "./fft";
export * from "./audio-engine";
export * from "./realtime-processor";
export * from "./audio-effects-engine";
export * from "./noise-reduction";
export * from "./volume-automation";
export * from "./realtime-audio-graph";
export * from "./effects-worklet-processor";
export * from "./sound-library-engine";
export * from "./sound-generator";
export * from "./beat-detection-engine";
