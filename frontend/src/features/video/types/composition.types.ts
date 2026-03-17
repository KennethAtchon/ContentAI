export type CompositionMode = "quick" | "precision";

export type SaveState = "idle" | "saving" | "saved" | "error";

export type EditorSelection = {
  videoClipId: string | null;
  textOverlayId: string | null;
};

export type CompositionIssue = {
  code: string;
  track: string;
  itemIds: string[];
  severity: "error" | "warning";
  message: string;
};

export type TimelineItem = {
  id: string;
  assetId?: string;
  lane?: number;
  startMs: number;
  endMs: number;
  trimStartMs?: number;
  trimEndMs?: number;
  role?: string;
};

export type Timeline = {
  schemaVersion: number;
  fps: number;
  durationMs: number;
  tracks: {
    video: TimelineItem[];
    audio: TimelineItem[];
    text: Record<string, unknown>[];
    captions: Record<string, unknown>[];
  };
};

export type CompositionRecord = {
  compositionId: string;
  generatedContentId: number;
  version: number;
  mode?: CompositionMode;
  editMode?: CompositionMode;
  timeline: Timeline;
  createdFromPhase4?: boolean;
  updatedAt?: string;
};

export type CompositionVersionItem = {
  assetId: string;
  label: string;
  createdAt: string;
  durationMs: number;
  isLatest: boolean;
};

export type CompositionRenderJob = {
  jobId: string;
  status: "queued" | "rendering" | "completed" | "failed";
  result?: {
    assembledAssetId?: string;
    videoUrl?: string;
    shotCount?: number;
    compositionId?: string;
    compositionVersion?: number;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiOkEnvelope<T> = {
  ok: true;
  data: T;
};

export type ApiErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiEnvelope<T> = ApiOkEnvelope<T> | ApiErrorEnvelope;
