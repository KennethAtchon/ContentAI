/**
 * Strict TypeScript models for editor timeline JSONB (`edit_project.tracks`).
 * Aligned with `frontend/src/features/editor/types/editor.ts`.
 * Runtime validation (Zod) is deferred to a later phase.
 */
import type { Token } from "../infrastructure/database/drizzle/schema";

export type { Token };

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
  isPlaceholder?: true;
  placeholderShotIndex?: number;
  placeholderLabel?: string;
  placeholderStatus?: "pending" | "generating" | "failed";
  locallyModified?: boolean;
}

export interface CaptionStyleOverrides {
  positionY?: number;
  fontSize?: number;
  textTransform?: "none" | "uppercase" | "lowercase";
}

/**
 * Caption clips own their linked transcript via `captionDocId`.
 * This points to a clip-owned editable caption doc, not a shared asset-level doc.
 */
export interface CaptionClip {
  id: string;
  type: "caption";
  startMs: number;
  durationMs: number;
  originVoiceoverClipId?: string;
  captionDocId: string;
  sourceStartMs: number;
  sourceEndMs: number;
  stylePresetId: string;
  styleOverrides: CaptionStyleOverrides;
  groupingMs: number;
}

export type TrackType = "video" | "audio" | "music" | "text";

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  muted: boolean;
  locked: boolean;
  clips: Array<Clip | CaptionClip>;
  transitions: Transition[];
}

/** Payload stored in `edit_project.tracks` (JSONB array of tracks). */
export type EditorTracks = Track[];
