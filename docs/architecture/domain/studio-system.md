## Studio System

This document explains what the Studio workspace actually is — how reels get into the system, how the discover/analyze/generate flow works, and what the queue actually does.

---

## Where the Reels Come From

Users don't submit reel URLs. The reels in the Studio are scraped by admins from Instagram using Apify, a web scraping service. Admins configure "niches" (topic categories like "personalfinance" or "fitness"), then trigger a scan. Apify runs an Instagram scraper for that hashtag and returns up to 50 reels.

The scraping is async — it can take up to 2 minutes. It runs as a background job that the admin can poll. Once it completes, the reel metadata (username, views, likes, hook text, caption, audio info) is stored in the database. Users then browse this pre-loaded library in the Discover tab.

Reels are deduplicated by their Instagram-internal ID. Scraping the same niche twice doesn't create duplicates.

---

## The Discover → Analyze → Generate Flow

**Discover:** Users browse reels filtered by niche. They're sorted by view count by default. Selecting a reel shows it in a phone mockup with stats — this is just the reel's stored metadata, no extra API call per selection.

**Analyze:** Clicking "Analyze" sends the reel's stored metadata (hook, caption, view count) to Claude Haiku. The AI classifies the reel — what hook pattern it uses, what emotional trigger, what format. The result is stored in the database. Analysis is idempotent — analyzing the same reel twice returns the same stored result.

**Generate:** With analysis in hand, the user writes a prompt ("make this for the crypto niche, focus on FOMO") and picks an output type. The backend sends the reel's metadata, its analysis, and the user's prompt to Claude Sonnet. The AI generates hooks, captions, and script notes tailored to the user's direction. The output is saved as a draft.

The three steps build on each other: you can't generate without an analysis, and the analysis is only useful because it distills what made the source reel work.

---

## The Queue: Not What It Sounds Like

The queue is not a manual staging area — it's an automatic content pipeline dashboard.

Every time a new piece of content is created (from the chat, from generation), a queue item is automatically created for it. You don't add things to the queue; the queue just shows you everything you've created and where it is in the production pipeline.

The pipeline stages it tracks:
- **Copy** — does the draft have a hook and script yet?
- **Voiceover** — has a TTS audio file been generated?
- **Video clips** — have AI video clips been generated?
- **Assembly** — has FFmpeg assembled the final video?
- **Manual edit** — has the user opened the timeline editor?

The queue auto-refreshes every 6 seconds when any item is still in progress, so you can watch clips and assembly complete in near-real-time.

The **Edit** action opens a detail sheet showing everything attached to that piece of content — the copy, audio links, video links, which pipeline stages are done, and deep links to the editor or the chat session that created it.

**Duplicate** copies a piece of content and starts a fresh production run — same copy, but all the audio and video assets are cleared so new ones get generated.

---

## How the Scrape Pipeline Works Internally

When an admin triggers a scan:

1. The backend creates a job record and kicks off an async worker (via `setTimeout` to avoid blocking the HTTP response).
2. The worker calls the Apify API to start the Instagram scraper actor for the niche's hashtag.
3. Apify starts the actor and returns a run ID. The worker polls every 3 seconds until the run succeeds or times out (~2 minutes).
4. When Apify reports success, the worker fetches all scraped items from the dataset.
5. Each item is inserted into the `reel` table using `ON CONFLICT DO NOTHING` — existing reels are skipped.
6. The job status is updated to "completed" with counts of how many were saved vs skipped.

The admin polls a job status endpoint to see progress. Jobs are stored in Redis for 24 hours.

If the Apify key isn't configured (local dev), the scraper returns 0/0 immediately without erroring. The rest of the platform still works.

---

## Scheduled daily scrape (automation)

In addition to admin-triggered scans, the API server schedules a **daily job** (`startDailyScan` in `backend/src/jobs/daily-scan.ts`). At **3:00 AM** (server local time), it loads every niche with `isActive: true` and enqueues a scrape for each via `queueService.enqueue`, spacing niches by about **30 seconds** to avoid thundering the worker.

This reuses the same queue/worker path as manual admin scans — it is not a separate ingestion pipeline. If the process restarts, the interval is rescheduled from the new boot time.

---

## Video Storage for Reels

After a reel is scraped, the system asynchronously copies its video and audio files to Cloudflare R2 (our own storage). This happens fire-and-forget after the database insert — a reel can appear in Discover before its R2 copy is ready.

When a user plays a reel, the backend generates a short-lived signed URL to the R2 file. If the R2 file isn't ready yet, it falls back to the original Instagram CDN URL. See the [Video Playback](./contentai-video-playback-technical-deep-dive.md) doc for details.

---

## Security

All Studio routes require a valid Firebase user token. Every piece of data a user can see is scoped to their `userId` in the database — the API never returns another user's content. Niche and reel management is admin-only.
