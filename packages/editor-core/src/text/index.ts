/**
 * @fileoverview barrel file that defines the public exports for this folder.
 *
 * Folder role: Title, subtitle, caption, transcription, speech-to-text, text animation, and audio/text synchronization features.
 * Read this file with ../types and the folder README nearby; most exports here are wired through the local index.ts barrel.
 */

export * from "./types";
export * from "./title-engine";
export * from "./text-animation";
export * from "./subtitle-engine";
export * from "./speech-to-text-engine";
export * from "./transcription-service";
export * from "./caption-animation-renderer";
export * from "./text-animation-presets";
export * from "./character-animator";
export * from "./audio-text-sync-engine";
