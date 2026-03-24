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
  assetId: string | null; // assets.id — null for text clips
  label: string;
  startMs: number; // position on timeline
  durationMs: number;
  trimStartMs: number;
  trimEndMs: number;
  speed: number;
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
  textStyle?: TextStyle;
  // Caption-only
  captionId?: string;
  captionWords?: CaptionWord[];
  captionPresetId?: string;
  captionGroupSize?: number;
  captionPositionY?: number;
  captionFontSizeOverride?: number;

  /** Placeholder slot until a real clip is generated */
  isPlaceholder?: true;
  placeholderShotIndex?: number;
  placeholderLabel?: string;
  placeholderStatus?: "pending" | "generating" | "failed";
  /** Set on user edits; stripped before PATCH save */
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
  // From linked generated_content (null for blank / list-view responses)
  generatedHook?: string | null;
  generatedCaption?: string | null;
  autoTitle?: boolean;
}

export interface ExportJobStatus {
  status: "idle" | "queued" | "rendering" | "done" | "failed";
  progress: number;
  r2Url?: string;
  error?: string;
}

// Editor state managed via useReducer
export interface EditorState {
  editProjectId: string | null;
  title: string;
  durationMs: number;
  fps: number;
  resolution: string;
  currentTimeMs: number;
  isPlaying: boolean;
  zoom: number; // pixels per second, default 40
  tracks: Track[];
  selectedClipId: string | null;
  // Undo/redo
  past: Track[][];
  future: Track[][];
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
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SELECT_CLIP"; clipId: string | null }
  | { type: "ADD_CLIP"; trackId: string; clip: Clip }
  | { type: "UPDATE_CLIP"; clipId: string; patch: Partial<Clip> }
  | { type: "REMOVE_CLIP"; clipId: string }
  | { type: "SPLIT_CLIP"; clipId: string; atMs: number }
  | { type: "DUPLICATE_CLIP"; clipId: string }
  | { type: "MOVE_CLIP"; clipId: string; startMs: number }
  | { type: "TOGGLE_TRACK_MUTE"; trackId: string }
  | { type: "TOGGLE_TRACK_LOCK"; trackId: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_EXPORT_JOB"; jobId: string | null }
  | { type: "SET_EXPORT_STATUS"; status: ExportJobStatus | null }
  | {
      type: "ADD_CAPTION_CLIP";
      captionId: string;
      captionWords: CaptionWord[];
      assetId: string;
      presetId: string;
      startMs: number;
      durationMs: number;
    }
  | {
      type: "SET_TRANSITION";
      trackId: string;
      clipAId: string;
      clipBId: string;
      transitionType: Transition["type"];
      durationMs: number;
    }
  | { type: "REMOVE_TRANSITION"; trackId: string; transitionId: string }
  | { type: "REORDER_SHOTS"; clipIds: string[] }
  | { type: "MERGE_TRACKS_FROM_SERVER"; tracks: Track[] };

export const TRACK_COLORS: Record<TrackType, string> = {
  video: "#a78bfa",
  audio: "#34d399",
  music: "#60a5fa",
  text: "#f59e0b",
};
