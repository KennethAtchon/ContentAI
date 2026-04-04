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

export type Clip = VideoClip | AudioClip | MusicClip | TextClip | CaptionClip;
export type MediaClip = VideoClip | AudioClip | MusicClip;

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
  title: string;
  playbackRate: number;
};

export interface EditorState {
  editProjectId: string | null;
  title: string;
  durationMs: number;
  fps: number;
  resolution: string;
  currentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number;
  zoom: number;
  tracks: Track[];
  selectedClipId: string | null;
  clipboardClip: Clip | null;
  clipboardSourceTrackId: string | null;
  past: EditorHistorySnapshot[];
  future: EditorHistorySnapshot[];
  exportJobId: string | null;
  exportStatus: ExportJobStatus | null;
  isReadOnly: boolean;
}

export type EditorAction =
  | { type: "LOAD_PROJECT"; project: EditProject }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_RESOLUTION"; resolution: string }
  | { type: "SET_CURRENT_TIME"; ms: number }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "SET_PLAYBACK_RATE"; rate: number }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SELECT_CLIP"; clipId: string | null }
  | { type: "ADD_CLIP"; trackId: string; clip: Clip }
  | {
      type: "ADD_CLIP_AUTO_PROMOTE";
      preferredTrackId: string;
      clip: Clip;
    }
  | {
      type: "ADD_CAPTION_CLIP";
      trackId: string;
      captionDocId: string;
      originVoiceoverClipId: string | null;
      startMs: number;
      durationMs: number;
      sourceStartMs: number;
      sourceEndMs: number;
      presetId: string;
      groupingMs?: number;
    }
  | { type: "UPDATE_CLIP"; clipId: string; patch: ClipPatch }
  | {
      type: "UPDATE_CAPTION_STYLE";
      clipId: string;
      presetId?: string;
      overrides?: CaptionStyleOverrides;
      groupingMs?: number;
    }
  | { type: "REMOVE_CLIP"; clipId: string }
  | { type: "RIPPLE_DELETE_CLIP"; clipId: string }
  | { type: "SPLIT_CLIP"; clipId: string; atMs: number }
  | { type: "DUPLICATE_CLIP"; clipId: string }
  | { type: "COPY_CLIP"; clipId: string }
  | { type: "PASTE_CLIP"; trackId: string; startMs: number }
  | { type: "TOGGLE_CLIP_ENABLED"; clipId: string }
  | { type: "MOVE_CLIP"; clipId: string; startMs: number }
  | { type: "TOGGLE_TRACK_MUTE"; trackId: string }
  | { type: "TOGGLE_TRACK_LOCK"; trackId: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_EXPORT_JOB"; jobId: string | null }
  | { type: "SET_EXPORT_STATUS"; status: ExportJobStatus | null }
  | {
      type: "SET_TRANSITION";
      trackId: string;
      clipAId: string;
      clipBId: string;
      transitionType: Transition["type"];
      durationMs: number;
    }
  | { type: "REMOVE_TRANSITION"; trackId: string; transitionId: string }
  | { type: "REORDER_SHOTS"; trackId: string; clipIds: string[] }
  | { type: "ADD_TRACK"; track: Track; afterTrackId?: string }
  | { type: "ADD_VIDEO_TRACK"; afterTrackId: string }
  | { type: "REMOVE_TRACK"; trackId: string }
  | { type: "RENAME_TRACK"; trackId: string; name: string }
  | { type: "REORDER_TRACKS"; trackIds: string[] }
  | { type: "MERGE_TRACKS_FROM_SERVER"; tracks: Track[] }
  | {
      type: "MARK_CAPTION_STALE";
      clipId: string;
      reason: "voiceover-trim-changed" | "voiceover-asset-replaced" | "voiceover-deleted";
    };

export const TRACK_COLORS: Record<TrackType, string> = {
  video: "#a78bfa",
  audio: "#34d399",
  music: "#60a5fa",
  text: "#f59e0b",
};
