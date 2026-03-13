import { debugLog } from "../utils/debug/debug";
import getRedisConnection from "./db/redis";
import type { ScrapeConfig } from "./scraping.service";

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface ScrapeJob {
  id: string;
  nicheId: number;
  nicheName: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  result?: ScrapeResult;
  error?: string;
  config?: Partial<ScrapeConfig>; // Store configuration used for this job
}

export interface ScrapeResult {
  saved: number;
  skipped: number;
  durationMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const JOB_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const JOB_KEY = (jobId: string) => `scrape_job:${jobId}`;
const NICHE_JOBS_KEY = (nicheId: number) => `scrape_jobs_by_niche:${nicheId}`;

// ─── QueueService ─────────────────────────────────────────────────────────────

class QueueService {
  private running = false;
  private queue: ScrapeJob[] = [];

  /** Enqueue a new scrape job for the given niche. Returns the job immediately. */
  async enqueue(
    nicheId: number, 
    nicheName: string, 
    config: Partial<ScrapeConfig> = {}
  ): Promise<ScrapeJob> {
    const job: ScrapeJob = {
      id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      nicheId,
      nicheName,
      status: "queued",
      createdAt: new Date().toISOString(),
      config, // Store the configuration for this job
    };

    await this.persistJob(job);
    this.queue.push(job);

    debugLog.info("Scrape job enqueued", {
      service: "queue-service",
      jobId: job.id,
      nicheId,
      nicheName,
    });

    // Kick off processing without blocking the HTTP response
    setTimeout(() => void this.drain(), 0);

    return job;
  }

  /** Retrieve a job by ID from Redis. */
  async getJob(jobId: string): Promise<ScrapeJob | null> {
    try {
      const redis = getRedisConnection();
      const raw = await redis.get(JOB_KEY(jobId));
      if (!raw) return null;
      return JSON.parse(raw) as ScrapeJob;
    } catch (err) {
      debugLog.error("Failed to get job from Redis", {
        service: "queue-service",
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /** List recent job IDs for a niche (most recent first, max 50). */
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
        service: "queue-service",
        nicheId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async drain(): Promise<void> {
    if (this.running) return; // One worker at a time
    this.running = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      await this.processJob(job);
    }

    this.running = false;
  }

  private async processJob(job: ScrapeJob): Promise<void> {
    // Lazy import to avoid circular deps and allow tree-shaking in tests
    const { scrapingService } = await import("./scraping.service");

    job.status = "running";
    job.startedAt = new Date().toISOString();
    await this.persistJob(job);

    debugLog.info("Scrape job started", {
      service: "queue-service",
      jobId: job.id,
      nicheId: job.nicheId,
    });

    const t0 = Date.now();

    try {
      const { saved, skipped } = await scrapingService.scrapeNiche(
        job.nicheId,
        job.nicheName,
        job.config || {}, // Pass the job configuration
      );

      job.status = "completed";
      job.completedAt = new Date().toISOString();
      job.result = { saved, skipped, durationMs: Date.now() - t0 };

      debugLog.info("Scrape job completed", {
        service: "queue-service",
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
        service: "queue-service",
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

      // Track job ID under niche index (prepend for recency order)
      const nicheKey = NICHE_JOBS_KEY(job.nicheId);
      await redis
        .pipeline()
        .lrem(nicheKey, 0, job.id) // remove stale duplicates
        .lpush(nicheKey, job.id) // prepend (most recent first)
        .ltrim(nicheKey, 0, 99) // keep at most 100 entries
        .expire(nicheKey, JOB_TTL_SECONDS)
        .exec();
    } catch (err) {
      // Non-fatal: job is still in-memory, just won't survive restarts
      debugLog.error("Failed to persist job to Redis", {
        service: "queue-service",
        jobId: job.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export const queueService = new QueueService();
