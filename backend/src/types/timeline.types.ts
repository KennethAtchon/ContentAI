/**
 * Strict TypeScript models for editor timeline JSONB (`edit_project.tracks`).
 * Aligned with `frontend/src/features/editor/types/editor.ts`.
 * Runtime validation (Zod) is deferred to a later phase.
 */

export interface CaptionWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TextStyle {
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
  align: "left" | "center" | "right";
}

export interface Transition {
  id: string;
  type: "fade" | "slide-left" | "slide-up" | "dissolve" | "wipe-right" | "none";
  durationMs: number;
  clipAId: string;
  clipBId: string;
}

export interface Clip {
  id: string;
  assetId: string | null;
  label: string;
  startMs: number;
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  speed: number;
  enabled?: boolean;
  opacity: number;
  warmth: number;
  contrast: number;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  volume: number;
  muted: boolean;
  textContent?: string;
  textAutoChunk?: boolean;
  textStyle?: TextStyle;
  sourceMaxDurationMs?: number;
  captionId?: string;
  captionWords?: CaptionWord[];
  captionPresetId?: string;
  captionGroupSize?: number;
  captionPositionY?: number;
  captionFontSizeOverride?: number;
  isPlaceholder?: true;
  placeholderShotIndex?: number;
  placeholderLabel?: string;
  placeholderStatus?: "pending" | "generating" | "failed";
  locallyModified?: boolean;
}

export type TrackType = "video" | "audio" | "music" | "text";

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  muted: boolean;
  locked: boolean;
  clips: Clip[];
  transitions: Transition[];
}

/** Payload stored in `edit_project.tracks` (JSONB array of tracks). */
export type EditorTracks = Track[];
