export type VideoJobStatus = "queued" | "running" | "completed" | "failed";

export interface VideoJobResult {
  clipAssetId?: string;
  assembledAssetId?: string;
  videoUrl?: string;
  provider?: string;
  durationSeconds?: number;
  shotCount?: number;
}

export interface VideoRenderJob {
  id: string;
  userId: string;
  generatedContentId: number;
  kind: "reel_generate" | "shot_regenerate" | "assemble";
  status: VideoJobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  request?: Record<string, unknown>;
  error?: string;
  result?: VideoJobResult;
}

export interface CreateReelRequest {
  generatedContentId: number;
  prompt?: string;
  durationSeconds?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  provider?: "kling-fal" | "runway" | "image-ken-burns";
}

export interface CreateReelResponse {
  jobId: string;
  status: VideoJobStatus;
  generatedContentId: number;
}

export interface VideoJobResponse {
  job: VideoRenderJob;
}
