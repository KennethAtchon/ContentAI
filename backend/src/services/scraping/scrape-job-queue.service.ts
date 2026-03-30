import { debugLog } from "../../utils/debug/debug";
import getRedisConnection from "../db/redis";
import type { ScrapeConfig } from "./scraping.service";

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface ScrapeJob {
  id: string;
  nicheId: number;
  nicheName: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: ScrapeJobResult;
  error?: string;
  config?: Partial<ScrapeConfig>;
}

export interface ScrapeJobResult {
  saved: number;
  skipped: number;
  durationMs: number;
}

const JOB_TTL_SECONDS = 60 * 60 * 24;
const JOB_KEY = (jobId: string) => `scrape_job:${jobId}`;
const NICHE_JOBS_KEY = (nicheId: number) => `scrape_jobs_by_niche:${nicheId}`;

class ScrapeJobQueueService {
  private running = false;
  private queue: ScrapeJob[] = [];

  async enqueue(
    nicheId: number,
    nicheName: string,
    config: Partial<ScrapeConfig> = {},
  ): Promise<ScrapeJob> {
    const job: ScrapeJob = {
      id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      nicheId,
      nicheName,
      status: "queued",
      createdAt: new Date().toISOString(),
      config,
    };

    await this.persistJob(job);
    this.queue.push(job);

    debugLog.info("Scrape job enqueued", {
      service: "scrape-job-queue",
      jobId: job.id,
      nicheId,
      nicheName,
    });

    setTimeout(() => void this.drain(), 0);

    return job;
  }

  async getJob(jobId: string): Promise<ScrapeJob | null> {
    try {
      const redis = getRedisConnection();
      const raw = await redis.get(JOB_KEY(jobId));
      if (!raw) return null;
      return JSON.parse(raw) as ScrapeJob;
    } catch (err) {
      debugLog.error("Failed to get job from Redis", {
        service: "scrape-job-queue",
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async listJobs(nicheId: number): Promise<ScrapeJob[]> {
    try {
      const redis = getRedisConnection();
      const jobIds = await redis.lrange(NICHE_JOBS_KEY(nicheId), 0, 49);
      const jobs = await Promise.all(
        jobIds.map((id: string) => this.getJob(id)),
      );
      return jobs.filter((j: ScrapeJob | null): j is ScrapeJob => j !== null);
    } catch (err) {
      debugLog.error("Failed to list jobs from Redis", {
        service: "scrape-job-queue",
        nicheId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      await this.processJob(job);
    }

    this.running = false;
  }

  private async processJob(job: ScrapeJob): Promise<void> {
    const { scrapingService } = await import("./scraping.service");

    job.status = "running";
    job.startedAt = new Date().toISOString();
    await this.persistJob(job);

    debugLog.info("Scrape job started", {
      service: "scrape-job-queue",
      jobId: job.id,
      nicheId: job.nicheId,
    });

    const t0 = Date.now();

    try {
      const { saved, skipped } = await scrapingService.scrapeNiche(
        job.nicheId,
        job.nicheName,
        job.config || {},
      );

      job.status = "completed";
      job.completedAt = new Date().toISOString();
      job.result = { saved, skipped, durationMs: Date.now() - t0 };

      debugLog.info("Scrape job completed", {
        service: "scrape-job-queue",
        jobId: job.id,
        saved,
        skipped,
        durationMs: job.result.durationMs,
      });
    } catch (err) {
      job.status = "failed";
      job.completedAt = new Date().toISOString();
      job.error = err instanceof Error ? err.message : String(err);

      debugLog.error("Scrape job failed", {
        service: "scrape-job-queue",
        jobId: job.id,
        error: job.error,
      });
    }

    await this.persistJob(job);
  }

  private async persistJob(job: ScrapeJob): Promise<void> {
    try {
      const redis = getRedisConnection();
      const key = JOB_KEY(job.id);
      await redis.set(key, JSON.stringify(job), "EX", JOB_TTL_SECONDS);

      const nicheKey = NICHE_JOBS_KEY(job.nicheId);
      await redis
        .pipeline()
        .lrem(nicheKey, 0, job.id)
        .lpush(nicheKey, job.id)
        .ltrim(nicheKey, 0, 99)
        .expire(nicheKey, JOB_TTL_SECONDS)
        .exec();
    } catch (err) {
      debugLog.error("Failed to persist job to Redis", {
        service: "scrape-job-queue",
        jobId: job.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const scrapeJobQueueService = new ScrapeJobQueueService();
