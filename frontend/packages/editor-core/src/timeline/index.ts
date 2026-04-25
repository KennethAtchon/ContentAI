/**
 * @fileoverview barrel file that defines the public exports for this folder.
 *
 * Folder role: Track/clip mutation logic, snapping/overlap rules, and nested sequence/compound clip support.
 * Read this file with ../types and the folder README nearby; most exports here are wired through the local index.ts barrel.
 */

export {
  TrackManager,
  createTrack,
  cloneTrack,
  getTrackClips,
  canAcceptMediaType,
  type TrackManagerOptions,
  type CreateTrackParams,
  type TrackOperationResult,
} from "./track-manager";

export {
  ClipManager,
  createClip,
  cloneClip,
  getClipEndTime,
  clipsOverlap,
  getGapBetweenClips,
  type ClipManagerOptions,
  type AddClipParams,
  type MoveClipParams,
  type ClipOperationResult,
  type SnapResult,
} from "./clip-manager";

export {
  NestedSequenceEngine,
  getNestedSequenceEngine,
  resetNestedSequenceEngine,
  type CompoundClip,
  type CompoundClipContent,
  type CompoundClipInstance,
  type CreateCompoundClipOptions,
  type FlattenResult,
} from "./nested-sequence-engine";
