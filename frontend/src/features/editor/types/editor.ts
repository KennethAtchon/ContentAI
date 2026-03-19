export interface TextStyle {
  fontSize: number;
  fontWeight: "normal" | "bold";
  color: string;
  align: "left" | "center" | "right";
}

export interface Clip {
  id: string;
  assetId: string | null; // reelAssets.id — null for text clips
  r2Url: string;
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
}

export type TrackType = "video" | "audio" | "music" | "text";

export interface Track {
  id: string;
  type: TrackType;
  name: string;
  muted: boolean;
  locked: boolean;
  clips: Clip[];
}

export interface EditProject {
  id: string;
  userId: string;
  title: string;
  generatedContentId: number | null;
  tracks: Track[];
  durationMs: number;
  fps: number;
  resolution: string;
  createdAt: string;
  updatedAt: string;
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
}

export type EditorAction =
  | { type: "LOAD_PROJECT"; project: EditProject }
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_CURRENT_TIME"; ms: number }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SELECT_CLIP"; clipId: string | null }
  | { type: "ADD_CLIP"; trackId: string; clip: Clip }
  | { type: "UPDATE_CLIP"; clipId: string; patch: Partial<Clip> }
  | { type: "REMOVE_CLIP"; clipId: string }
  | { type: "TOGGLE_TRACK_MUTE"; trackId: string }
  | { type: "TOGGLE_TRACK_LOCK"; trackId: string }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "SET_EXPORT_JOB"; jobId: string | null }
  | { type: "SET_EXPORT_STATUS"; status: ExportJobStatus | null };

export const TRACK_COLORS: Record<TrackType, string> = {
  video: "#a78bfa",
  audio: "#34d399",
  music: "#60a5fa",
  text: "#f59e0b",
};
