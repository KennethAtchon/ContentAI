import type { QueueItem } from "@/features/reels/types/reel.types";

/** A group of queue items that belong to the same version chain. */
export interface VersionGroup {
  rootContentId: number | null;
  items: QueueItem[];
}

export interface Project {
  id: string;
  name: string;
}

export type StatusFilter =
  | "all"
  | "draft"
  | "ready"
  | "scheduled"
  | "posted"
  | "failed";

export interface ContentVersion {
  id: number;
  version: number;
  generatedHook: string | null;
  postCaption: string | null;
  generatedScript: string | null;
  voiceoverScript: string | null;
  sceneDescription: string | null;
  createdAt: string;
}

export interface QueueDetail {
  queueItem: QueueItem;
  content: {
    id: number;
    generatedHook: string | null;
    postCaption: string | null;
    generatedScript: string | null;
    voiceoverScript: string | null;
    sceneDescription: string | null;
    generatedMetadata: Record<string, unknown> | null;
    voiceoverUrl: string | null;
    backgroundAudioUrl: string | null;
    videoR2Url: string | null;
    status: string;
    version: number;
    outputType: string;
  } | null;
  assets: Array<{
    id: string;
    type: string;
    r2Url: string | null;
    durationMs: number | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  sessionId: string | null;
  projectId: string | null;
  /** Full version chain, oldest first (v1 … vN). Empty for single-version content. */
  versions: ContentVersion[];
  /** Signed URL from latest completed editor export (preferred final video). */
  latestExportUrl: string | null;
  latestExportStatus: string | null;
}

export const STATUS_STYLES: Record<string, string> = {
  draft: "bg-overlay-sm text-dim-2",
  ready: "bg-violet-400/15 text-violet-400",
  queued: "bg-warning/15 text-warning",
  scheduled: "bg-blue-400/15 text-blue-400",
  posted: "bg-green-400/15 text-green-400",
  failed: "bg-error/15 text-error",
};

export const STAGE_DOT: Record<string, string> = {
  ok: "bg-green-400",
  running: "bg-warning animate-pulse",
  failed: "bg-error",
  pending: "bg-overlay-lg",
};

export const STAGE_LINE: Record<string, string> = {
  ok: "bg-green-400/35",
  running: "bg-warning/35",
  failed: "bg-error/35",
  pending: "bg-overlay-md",
};

export const STAGE_LABEL: Record<string, string> = {
  ok: "text-green-400/70",
  running: "text-warning",
  failed: "text-error",
  pending: "text-dim-3",
};
