import { db } from "./db/db";
import { reels } from "../infrastructure/database/drizzle/schema";
import type { NewReel } from "../infrastructure/database/drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { debugLog } from "../utils/debug/debug";
import { SOCIAL_API_KEY, VIRAL_VIEWS_THRESHOLD } from "../utils/config/envUtil";
import { storage } from "./storage/index";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScrapeResult {
  saved: number;
  skipped: number;
}

export interface ScrapeConfig {
  limit: number;
  minViews: number;
  maxDaysOld: number;
  viralOnly: boolean;
}

interface ApifyReelItem {
  // Common identity fields
  id?: string;
  shortCode?: string;
  // URLs
  url?: string;
  videoUrl?: string;
  videoPlaybackUrl?: string; // hashtag scraper variant
  audioUrl?: string;
  displayUrl?: string;
  thumbnailUrl?: string;
  // Content
  caption?: string;
  // Engagement
  likesCount?: number;
  commentsCount?: number;
  videoPlayCount?: number;
  videoViewCount?: number;
  // Owner — field name varies by actor
  ownerUsername?: string;
  ownerFullName?: string;
  // Music
  musicInfo?: {
    song_name?: string;
    artist_name?: string;
    audio_id?: string;
  };
  // Post type — "Video" | "GraphVideo" | "Image" | "Sidecar" etc.
  type?: string;
  // Product type from hashtag scraper — "clips" = reel, "carousel_container" = album, "feed" = photo
  productType?: string;
  isVideo?: boolean;
  // Video metadata
  videoDuration?: number;
  // Timestamps
  timestamp?: string;
  takenAt?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const APIFY_BASE_URL = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-hashtag-scraper";
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 40; // 40 * 3s = 2 minutes
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 4000, 8000];
const VIRAL_THRESHOLD = VIRAL_VIEWS_THRESHOLD || 100000;

// ─── ScrapingService ──────────────────────────────────────────────────────────

class ScrapingService {
  /**
   * Scrape reels for the given niche and persist them.
   * Falls back gracefully to a stub if SOCIAL_API_KEY is not configured.
   */
  async scrapeNiche(
    nicheId: number,
    nicheName: string,
    config: Partial<ScrapeConfig> = {}
  ): Promise<ScrapeResult> {
    const apiKey = SOCIAL_API_KEY;

    if (!apiKey) {
      debugLog.warn(
        "SOCIAL_API_KEY not set — skipping real scrape (stub mode)",
        {
          service: "scraping-service",
          nicheId,
          nicheName,
        },
      );
      return { saved: 0, skipped: 0 };
    }

    // Default configuration
    const defaultConfig: ScrapeConfig = {
      limit: 100,
      minViews: 1000,
      maxDaysOld: 30,
      viralOnly: false,
    };

    const finalConfig = { ...defaultConfig, ...config };

    let lastError: Error = new Error("Unknown error");

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.scrapeViaApify(nicheId, nicheName, apiKey, finalConfig);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const delay = RETRY_DELAYS_MS[attempt] ?? 8000;

        debugLog.warn(
          `Scrape attempt ${attempt + 1} failed — retrying in ${delay}ms`,
          {
            service: "scraping-service",
            nicheId,
            error: lastError.message,
          },
        );

        if (attempt < MAX_RETRIES - 1) {
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }

  // ─── Retry wrapper ─────────────────────────────────────────────────────────

  private async scrapeWithRetry(
    nicheId: number,
    nicheName: string,
    apiKey: string,
    config: ScrapeConfig,
  ): Promise<ScrapeResult> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await this.scrapeViaApify(nicheId, nicheName, apiKey, config);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const delay = RETRY_DELAYS_MS[attempt] ?? 8000;

        debugLog.warn(
          `Scrape attempt ${attempt + 1} failed — retrying in ${delay}ms`,
          {
            service: "scraping-service",
            nicheId,
            error: lastError.message,
          },
        );

        if (attempt < MAX_RETRIES - 1) {
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }

  // ─── Apify integration ─────────────────────────────────────────────────────

  private async scrapeViaApify(
    nicheId: number,
    nicheName: string,
    apiKey: string,
    config: ScrapeConfig,
  ): Promise<ScrapeResult> {
    // 1. Start the actor run
    const runId = await this.startApifyRun(nicheName, apiKey, config);

    debugLog.info("Apify run started", {
      service: "scraping-service",
      runId,
      nicheId,
      nicheName,
    });

    // 2. Poll until completed
    const datasetId = await this.pollUntilComplete(runId, apiKey);

    // 3. Fetch dataset items
    const items = await this.fetchDatasetItems(datasetId, apiKey);

    debugLog.info("Apify dataset fetched", {
      service: "scraping-service",
      runId,
      itemCount: items.length,
      rawItems: items,
    });

    // 4. Persist to database
    return this.saveReels(items, nicheId, config);
  }

  private async startApifyRun(
    nicheName: string,
    apiKey: string,
    config: ScrapeConfig,
  ): Promise<string> {
    const res = await fetch(
      `${APIFY_BASE_URL}/acts/${ACTOR_ID}/runs?token=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ContentAI-Scraper/1.0",
        },
        body: JSON.stringify({
          hashtags: [nicheName.toLowerCase().replace(/\s+/g, "")],
          resultsType: "reels",
          resultsLimit: config.limit,
          // Add additional filtering based on config
          // Note: Apify may not support all these filters directly, 
          // so we'll filter them in saveReels method
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Apify actor start failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { data: { id: string } };
    return data.data.id;
  }

  private async pollUntilComplete(
    runId: string,
    apiKey: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await sleep(POLL_INTERVAL_MS);

      const res = await fetch(
        `${APIFY_BASE_URL}/actor-runs/${runId}?token=${apiKey}`,
        { headers: { "User-Agent": "ContentAI-Scraper/1.0" } },
      );

      if (!res.ok) {
        throw new Error(`Apify status poll failed (${res.status})`);
      }

      const data = (await res.json()) as {
        data: { status: string; defaultDatasetId: string };
      };
      const { status, defaultDatasetId } = data.data;

      if (status === "SUCCEEDED") return defaultDatasetId;
      if (
        status === "FAILED" ||
        status === "ABORTED" ||
        status === "TIMED-OUT"
      ) {
        throw new Error(`Apify run ${runId} ended with status: ${status}`);
      }

      debugLog.info(`Apify run polling (${status})`, {
        service: "scraping-service",
        runId,
        attempt: attempt + 1,
      });
    }

    throw new Error(
      `Apify run ${runId} timed out after ${MAX_POLL_ATTEMPTS} polls`,
    );
  }

  private async fetchDatasetItems(
    datasetId: string,
    apiKey: string,
  ): Promise<ApifyReelItem[]> {
    const res = await fetch(
      `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${apiKey}&format=json&clean=true`,
      { headers: { "User-Agent": "ContentAI-Scraper/1.0" } },
    );

    if (!res.ok) {
      throw new Error(`Apify dataset fetch failed (${res.status})`);
    }

    return (await res.json()) as ApifyReelItem[];
  }

  // ─── Data persistence ──────────────────────────────────────────────────────

  private async saveReels(
    items: ApifyReelItem[],
    nicheId: number,
    config: ScrapeConfig,
  ): Promise<ScrapeResult> {
    if (items.length === 0) return { saved: 0, skipped: 0 };

    let saved = 0;
    let skipped = 0;
    let notVideo = 0;
    let duplicate = 0;

    for (const item of items) {
      // Skip non-video posts (images, carousels) — only store reels/videos
      // productType "clips" = Instagram Reel; type "Video"/"GraphVideo" = older field names
      const isVideo =
        item.isVideo === true ||
        item.type === "Video" ||
        item.type === "GraphVideo" ||
        item.productType === "clips" ||
        item.videoUrl != null ||
        item.videoPlaybackUrl != null ||
        (item.videoViewCount != null && item.videoViewCount > 0) ||
        (item.videoPlayCount != null && item.videoPlayCount > 0);

      if (!isVideo) {
        notVideo++;
        skipped++;
        continue;
      }

      const externalId = item.id ?? item.shortCode ?? null;
      const views = item.videoViewCount ?? item.videoPlayCount ?? 0;
      const likes = item.likesCount ?? 0;
      const comments = item.commentsCount ?? 0;
      const engagement =
        views > 0 ? (((likes + comments) / views) * 100).toFixed(2) : null;
      const videoUrl = item.videoUrl ?? item.videoPlaybackUrl ?? item.url ?? null;
      const audioUrl = item.audioUrl ?? null;
      const username = item.ownerUsername ?? item.ownerFullName ?? "unknown";

      // Apply configuration-based filtering
      const postedAt = item.timestamp ? new Date(item.timestamp) : null;
      const daysAgo = postedAt
        ? Math.floor(
            (Date.now() - postedAt.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;

      // Skip if below minimum views
      if (views < config.minViews) {
        skipped++;
        continue;
      }

      // Skip if too old
      if (daysAgo !== null && daysAgo > config.maxDaysOld) {
        skipped++;
        continue;
      }

      // Skip if viral-only and not viral
      if (config.viralOnly && views < VIRAL_THRESHOLD) {
        skipped++;
        continue;
      }

      const newReel: NewReel = {
        externalId,
        username,
        nicheId,
        views,
        likes,
        comments,
        engagementRate: engagement,
        hook: extractHook(item.caption),
        caption: item.caption ?? null,
        audioName: item.musicInfo?.song_name ?? null,
        audioId: item.musicInfo?.audio_id ?? null,
        thumbnailUrl: item.thumbnailUrl ?? item.displayUrl ?? null,
        videoUrl,
        videoLengthSeconds: item.videoDuration != null ? Math.round(item.videoDuration) : null,
        postedAt,
        daysAgo,
        isViral: views >= VIRAL_THRESHOLD,
        scrapedAt: new Date(),
      };

      try {
        // Use INSERT ... ON CONFLICT DO NOTHING to skip existing externalIds.
        // .returning() returns an empty array when the row was skipped.
        const result = await db
          .insert(reels)
          .values(newReel)
          .onConflictDoNothing({ target: reels.externalId })
          .returning({ id: reels.id });

        if (result.length === 0) {
          duplicate++;
          skipped++;
        } else {
          saved++;
          // Fire-and-forget: upload media to R2 and persist keys back to the row
          const reelId = result[0]!.id;
          this.uploadAndStoreMedia(reelId, externalId, videoUrl, audioUrl).catch(
            (err) =>
              debugLog.error("Media upload failed", {
                service: "scraping-service",
                externalId,
                error: err instanceof Error ? err.message : String(err),
              }),
          );
        }
      } catch (err) {
        // externalId conflict or other DB error — count as skipped
        skipped++;
        debugLog.error("Failed to insert reel", {
          service: "scraping-service",
          externalId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Recount in case of partial skips due to race conditions
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(reels)
      .where(eq(reels.nicheId, nicheId));

    debugLog.info("Reels saved", {
      service: "scraping-service",
      nicheId,
      fetched: items.length,
      saved,
      skipped,
      skippedBreakdown: { notVideo, duplicate },
      totalInNiche: total,
    });

    return { saved, skipped };
  }

  // ─── Media upload ──────────────────────────────────────────────────────────

  private async uploadAndStoreMedia(
    reelId: number,
    externalId: string | null,
    videoUrl: string | null,
    audioUrl: string | null,
  ): Promise<void> {
    const keyBase = externalId ?? `reel-${reelId}`;

    const [videoResult, audioResult] = await Promise.allSettled([
      videoUrl
        ? storage.uploadFromUrl(videoUrl, `video/${keyBase}.mp4`, "video/mp4")
        : Promise.resolve(null),
      audioUrl
        ? storage.uploadFromUrl(audioUrl, `audio/${keyBase}.m4a`, "audio/mp4")
        : Promise.resolve(null),
    ]);

    const updates: { videoR2Url?: string; audioR2Url?: string } = {};

    // Storing full URLs is correct design - they include environment prefixes and can be used directly
    
    if (videoResult.status === "fulfilled" && videoResult.value) {
      updates.videoR2Url = videoResult.value;
    } else if (videoResult.status === "rejected") {
      debugLog.warn("Video R2 upload failed", {
        service: "scraping-service",
        externalId,
        error: (videoResult.reason as Error)?.message,
      });
    }

    if (audioResult.status === "fulfilled" && audioResult.value) {
      updates.audioR2Url = audioResult.value;
    } else if (audioResult.status === "rejected") {
      debugLog.warn("Audio R2 upload failed", {
        service: "scraping-service",
        externalId,
        error: (audioResult.reason as Error)?.message,
      });
    }

    if (Object.keys(updates).length > 0) {
      await db.update(reels).set(updates).where(eq(reels.id, reelId));
    }
  }

}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract a best-guess "hook" from the first line of a caption. */
function extractHook(caption?: string | null): string | null {
  if (!caption) return null;
  const firstLine = caption.split("\n")[0]?.trim();
  return firstLine ? firstLine.slice(0, 280) : null;
}

export const scrapingService = new ScrapingService();
