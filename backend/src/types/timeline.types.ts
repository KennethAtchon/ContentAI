/**
 * Strict TypeScript models for editor timeline JSONB (`edit_project.tracks`).
 * Aligned with `frontend/src/features/editor/types/editor.ts`.
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

export interface BaseClip {
  id: string;
  startMs: number;
  durationMs: number;
  locallyModified?: boolean;
}

export interface NamedClip extends BaseClip {
  label: string;
  enabled?: boolean;
  speed: number;
}

export interface VisualClip extends NamedClip {
  opacity: number;
  warmth: number;
  contrast: number;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
}

export interface MediaClipBase extends VisualClip {
  assetId: string | null;
  trimStartMs: number;
  trimEndMs: number;
  sourceMaxDurationMs?: number;
  volume: number;
  muted: boolean;
  isPlaceholder?: true;
  placeholderShotIndex?: number;
  placeholderLabel?: string;
  placeholderStatus?: "pending" | "generating" | "failed";
}

export interface VideoClip extends MediaClipBase {
  type: "video";
}

export interface AudioClip extends MediaClipBase {
  type: "audio";
}

export interface MusicClip extends MediaClipBase {
  type: "music";
}

export interface TextClip extends VisualClip {
  type: "text";
  textContent: string;
  textAutoChunk?: boolean;
  textStyle?: TextStyle;
}

export type Clip = VideoClip | AudioClip | MusicClip | TextClip;
export type MediaClip = VideoClip | AudioClip | MusicClip;

export interface CaptionStyleOverrides {
  positionY?: number;
  fontSize?: number;
  textTransform?: "none" | "uppercase" | "lowercase";
}

export interface CaptionClip extends BaseClip {
  type: "caption";
  originVoiceoverClipId?: string;
  captionDocId: string;
  sourceStartMs: number;
  sourceEndMs: number;
  stylePresetId: string;
  styleOverrides: CaptionStyleOverrides;
  groupingMs: number;
}

export type TimelineClip = Clip | CaptionClip;

export type TrackType = "video" | "audio" | "music" | "text";

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  muted: boolean;
  locked: boolean;
  clips: TimelineClip[];
  transitions: Transition[];
}

export type EditorTracks = Track[];
