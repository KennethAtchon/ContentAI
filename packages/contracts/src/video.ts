import { z } from "zod";

export const providerSchema = z.enum([
  "kling-fal",
  "runway",
  "image-ken-burns",
]);

export const aspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);

export const videoJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);

export const videoJobProgressPhaseSchema = z.enum([
  "queued",
  "decode",
  "graph-build",
  "encode",
  "finalize",
  "completed",
]);

export type VideoJobStatus = z.infer<typeof videoJobStatusSchema>;

export interface VideoJobProgress {
  phase: z.infer<typeof videoJobProgressPhaseSchema>;
  percent: number;
  message?: string;
  shotsCompleted?: number;
  totalShots?: number;
}

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
  kind: "reel_generate" | "shot_regenerate" | "assemble" | "composition_render";
  status: VideoJobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  request?: Record<string, unknown>;
  error?: string;
  result?: VideoJobResult;
  progress?: VideoJobProgress;
}

export interface VideoJobResponse {
  job: VideoRenderJob;
}

export interface CreateReelRequest {
  generatedContentId: number;
  prompt?: string;
  durationSeconds?: number;
  aspectRatio?: z.infer<typeof aspectRatioSchema>;
  provider?: z.infer<typeof providerSchema>;
}

export interface CreateReelResponse {
  jobId: string;
  status: VideoJobStatus;
  generatedContentId: number;
}
