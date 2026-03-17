import getRedisConnection from "../db/redis";
import { debugLog } from "../../utils/debug/debug";

export type VideoJobStatus = "queued" | "running" | "completed" | "failed";
export type VideoJobKind = "reel_generate" | "shot_regenerate" | "assemble";

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
  kind: VideoJobKind;
  status: VideoJobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  request?: Record<string, unknown>;
  error?: string;
  result?: VideoJobResult;
}

const JOB_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const JOB_KEY = (jobId: string) => `video_job:${jobId}`;

class VideoJobService {
  async createJob(params: {
    userId: string;
    generatedContentId: number;
    kind: VideoJobKind;
    request?: Record<string, unknown>;
  }): Promise<VideoRenderJob> {
    const job: VideoRenderJob = {
      id: `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId: params.userId,
      generatedContentId: params.generatedContentId,
      kind: params.kind,
      request: params.request,
      status: "queued",
      createdAt: new Date().toISOString(),
    };

    await this.persistJob(job);
    return job;
  }

  async getJob(jobId: string): Promise<VideoRenderJob | null> {
    try {
      const redis = getRedisConnection();
      const raw = await redis.get(JOB_KEY(jobId));
      if (!raw) return null;
      return JSON.parse(raw) as VideoRenderJob;
    } catch (err) {
      debugLog.error("Failed to fetch video job", {
        service: "video-job-service",
        operation: "getJob",
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async updateJob(
    jobId: string,
    patch: Partial<VideoRenderJob>,
  ): Promise<VideoRenderJob | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;

    const next: VideoRenderJob = {
      ...job,
      ...patch,
      id: job.id,
      userId: job.userId,
      generatedContentId: job.generatedContentId,
      kind: job.kind,
      createdAt: job.createdAt,
    };

    await this.persistJob(next);
    return next;
  }

  private async persistJob(job: VideoRenderJob): Promise<void> {
    try {
      const redis = getRedisConnection();
      await redis.set(
        JOB_KEY(job.id),
        JSON.stringify(job),
        "EX",
        JOB_TTL_SECONDS,
      );
    } catch (err) {
      debugLog.error("Failed to persist video job", {
        service: "video-job-service",
        operation: "persistJob",
        jobId: job.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const videoJobService = new VideoJobService();
