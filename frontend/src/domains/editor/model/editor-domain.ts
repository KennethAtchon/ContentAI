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
  locallyModified: boolean;
}

export interface NamedClip extends BaseClip {
  label: string;
  enabled: boolean;
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
  /**
   * Who placed this clip. "content" = AI-derived, "user" = manually added.
   * Clips without this field are treated as "content" by SyncService.mergeTrackSets.
   * TODO (Phase 2): Add "ai_edit" for clips placed by AI direct-edit tools.
   */
  source?: "content" | "user";
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
  textAutoChunk: boolean;
  textStyle?: TextStyle;
  source?: "content" | "user";
}

export interface CaptionStyleOverrides {
  positionY?: number;
  fontSize?: number;
  textTransform?: "none" | "uppercase" | "lowercase";
}

export interface CaptionClip extends BaseClip {
  type: "caption";
  originVoiceoverClipId: string | null;
  captionDocId: string;
  sourceStartMs: number;
  sourceEndMs: number;
  stylePresetId: string;
  styleOverrides: CaptionStyleOverrides;
  groupingMs: number;
  stale?: boolean;
  source?: "content" | "user";
}

export type Clip = VideoClip | AudioClip | MusicClip | TextClip | CaptionClip;
export type MediaClip = VideoClip | AudioClip | MusicClip;

export type VideoClipPatch = Partial<Omit<VideoClip, "id" | "type">>;
export type AudioClipPatch = Partial<Omit<AudioClip, "id" | "type">>;
export type MusicClipPatch = Partial<Omit<MusicClip, "id" | "type">>;
export type TextClipPatch = Partial<Omit<TextClip, "id" | "type">>;
export type CaptionClipPatch = Partial<Omit<CaptionClip, "id" | "type">>;
export type ClipPatch =
  | VideoClipPatch
  | AudioClipPatch
  | MusicClipPatch
  | TextClipPatch
  | CaptionClipPatch;

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

export interface EditProject {
  id: string;
  userId: string;
  title: string | null;
  generatedContentId: number | null;
  tracks: Track[];
  durationMs: number;
  fps: number;
  resolution: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "published";
  publishedAt: string | null;
  parentProjectId: string | null;
  thumbnailUrl?: string | null;
  generatedHook?: string | null;
  postCaption?: string | null;
  autoTitle?: boolean;
}

export interface ExportJobStatus {
  status: "idle" | "queued" | "rendering" | "done" | "failed";
  progress: number;
  r2Url?: string;
  error?: string;
}

export type EditorHistorySnapshot = {
  tracks: Track[];
  resolution: string;
  fps: number;
  title: string;
  playbackRate: number;
};

export const TRACK_COLORS: Record<TrackType, string> = {
  video: "#a78bfa",
  audio: "#34d399",
  music: "#60a5fa",
  text: "#f59e0b",
};
