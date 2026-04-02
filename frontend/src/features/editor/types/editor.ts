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
  assetId: string | null; // assets.id — null for text clips
  label: string;
  startMs: number; // position on timeline
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  speed: number;
  // Enabled — disabled clips are skipped in preview/export
  enabled?: boolean;
  // Look
  opacity: number;
  warmth: number;
  contrast: number;
  // Transform
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  // Sound
  volume: number;
  muted: boolean;
  // Text-only
  textContent?: string;
  /** When false, preview shows full text for the whole clip; when true/undefined, text is split into timed on-screen chunks. */
  textAutoChunk?: boolean;
  textStyle?: TextStyle;
  /** Reading-time ceiling for media-backed clips. */
  sourceMaxDurationMs?: number;

  /** Placeholder slot until a real clip is generated */
  isPlaceholder?: true;
  placeholderShotIndex?: number;
  placeholderLabel?: string;
  placeholderStatus?: "pending" | "generating" | "failed";
  /** Set on user edits; stripped before PATCH save */
  locallyModified?: boolean;
}

export interface CaptionStyleOverrides {
  positionY?: number;
  fontSize?: number;
  textTransform?: "none" | "uppercase" | "lowercase";
}

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
  locallyModified?: boolean;
}

export type TimelineClip = Clip | CaptionClip;
export type ClipPatch = Partial<Clip> & Partial<CaptionClip>;

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
  mergedAssetIds?: string[];
  thumbnailUrl?: string | null;
  // From linked generated_content (null for blank / list-view responses)
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

/** Single undo/redo snapshot (tracks + settings restored on undo). */
export type EditorHistorySnapshot = {
  tracks: Track[];
  resolution: string;
  title: string;
  playbackRate: number;
};

// Editor state managed via useReducer
export interface EditorState {
  editProjectId: string | null;
  title: string;
  durationMs: number;
  fps: number;
  resolution: string;
  currentTimeMs: number;
  isPlaying: boolean;
  playbackRate: number; // 1 normally; negative = reverse (JKL); >1 = fast forward
  zoom: number; // pixels per second, default 40
  tracks: Track[];
  selectedClipId: string | null;
  clipboardClip: TimelineClip | null; // copy/paste
  /** Track id the copied clip came from (paste target when source clip was deleted). */
  clipboardSourceTrackId: string | null;
  // Undo/redo — each snapshot stores tracks + editor settings that can be undone
  past: EditorHistorySnapshot[];
  future: EditorHistorySnapshot[];
  // Export
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
  | { type: "ADD_CLIP"; trackId: string; clip: TimelineClip }
  | {
      type: "ADD_CLIP_AUTO_PROMOTE";
      preferredTrackId: string;
      clip: TimelineClip;
    }
  | {
      type: "ADD_CAPTION_CLIP";
      trackId: string;
      captionDocId: string;
      originVoiceoverClipId?: string;
      startMs: number;
      durationMs: number;
      sourceStartMs: number;
      sourceEndMs: number;
      presetId?: string;
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
  | { type: "MERGE_TRACKS_FROM_SERVER"; tracks: Track[] };

export const TRACK_COLORS: Record<TrackType, string> = {
  video: "#a78bfa",
  audio: "#34d399",
  music: "#60a5fa",
  text: "#f59e0b",
};
