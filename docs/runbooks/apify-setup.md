# Apify Setup Guide

**Last updated:** March 11, 2026
**Purpose:** Configure Apify for Instagram reel scraping via the `scraping.service.ts` integration.
**Related:** [Admin Niches Orchestration](../Admin_Niches_Orchestration.md)

---

## Overview

ContentAI uses Apify's `apify~instagram-reel-scraper` actor to scrape Instagram reels by hashtag. The scraping service starts an actor run, polls until completion, fetches the dataset, and persists results to the `reels` table.

```
Niche trigger → Apify actor run → poll for SUCCEEDED → fetch dataset → INSERT reels
```

---

## 1. Create an Apify Account

1. Go to [apify.com](https://apify.com) and sign up.
2. Navigate to **Settings → Integrations → API tokens**.
3. Create a new token (name it e.g. `contentai-production`).
4. Copy the token — you will not be able to view it again.

---

## 2. Environment Variables

Add the following to your backend `.env` (and Railway environment):

| Variable | Required | Default | Description |
|---|---|---|---|
| `SOCIAL_API_KEY` | No | — | Apify API token. If unset, scraping runs in stub mode (no-op). |
| `VIRAL_VIEWS_THRESHOLD` | No | `100000` | Minimum view count for a reel to be marked `is_viral = true`. |

```env
SOCIAL_API_KEY=apify_api_xxxxxxxxxxxxxxxxxxxx
VIRAL_VIEWS_THRESHOLD=100000
```

> **Stub mode:** If `SOCIAL_API_KEY` is not set, `scrapeNiche()` returns `{ saved: 0, skipped: 0 }` immediately and logs a warning. Safe for local development without an Apify account.

---

## 3. Actor Configuration

The service uses the following hardcoded actor settings (`scraping.service.ts`):

| Setting | Value |
|---|---|
| Actor ID | `apify~instagram-hashtag-scraper` |
| Results per run | `50` |
| Hashtag | Derived from niche name — lowercased, spaces removed |
| Poll interval | 3 seconds |
| Max poll attempts | 40 (2-minute timeout) |
| Retry attempts | 3 (delays: 2s, 4s, 8s) |

The hashtag is built as:
```ts
nicheName.toLowerCase().replace(/\s+/g, "")
// "Fitness Tips" → "fitnesstips"
```

---

## 4. Reel Schema → Apify Field Mapping

The `reel` table columns and where each value comes from:

| Column | Source | Notes |
|---|---|---|
| `external_id` | `id` → `shortCode` | First non-null wins |
| `username` | `ownerUsername` | Defaults to `"unknown"` if absent |
| `views` | `videoViewCount` → `videoPlayCount` | First non-null wins |
| `likes` | `likesCount` | |
| `comments` | `commentsCount` | |
| `engagement_rate` | _(computed)_ | `(likes + comments) / views * 100` |
| `hook` | `caption` (first line) | Truncated to 280 chars |
| `caption` | `caption` | Full caption text |
| `audio_name` | `musicInfo.song_name` | |
| `audio_id` | `musicInfo.audio_id` | |
| `thumbnail_url` | `thumbnailUrl` → `displayUrl` | First non-null wins |
| `video_url` | `videoUrl` → `url` | First non-null wins |
| `video_length_seconds` | `videoDuration` | Apify returns seconds |
| `posted_at` | `timestamp` | ISO 8601 string → Date |
| `days_ago` | _(computed from `timestamp`)_ | `floor((now - postedAt) / 86400000)` |
| `is_viral` | _(computed)_ | `views >= VIRAL_VIEWS_THRESHOLD` (default 100 000) |
| `video_r2_key` | _(uploaded)_ | Set async after insert: `video/<externalId>.mp4` |
| `audio_r2_key` | _(uploaded)_ | Set async after insert: `audio/<externalId>.m4a` — only if Apify returns `audioUrl` |
| `thumbnail_emoji` | — | Not from Apify — set by AI analysis pipeline |
| `cut_frequency_seconds` | — | Not from Apify — set by AI analysis pipeline |
| `scraped_at` | _(server time)_ | Set at insert time |

> `audioUrl` is included in `ApifyReelItem` but the standard Instagram reel scraper does not return a separate audio track URL — audio is embedded in the MP4. `audio_r2_key` will only be populated if a future actor or scraper variant provides it.

---

## 5. Apify Plan Considerations

| Plan | Monthly runs | Notes |
|---|---|---|
| Free | ~100 actor runs | Suitable for initial testing |
| Starter ($49/mo) | ~1 000 runs | Recommended for production |
| Scale+ | Unlimited | High-volume niches |

Each niche scrape = 1 actor run. Plan accordingly based on how many niches you schedule.

---

## 6. Verifying the Integration

### Check logs

A successful scrape produces these log entries (via `debugLog`):

```
[INFO] Apify run started       { runId, nicheId, nicheName }
[INFO] Apify run polling (RUNNING) { runId, attempt }
[INFO] Apify dataset fetched   { runId, itemCount }
[INFO] Reels saved             { nicheId, saved, skipped, totalInNiche }
```

### Manual trigger (admin API)

```bash
curl -X POST https://your-api.com/api/admin/niches/<nicheId>/scrape \
  -H "Authorization: Bearer <admin-token>"
```

### Check the database

```sql
SELECT niche_id, COUNT(*), MAX(scraped_at)
FROM reels
GROUP BY niche_id
ORDER BY niche_id;
```

---

## 7. Troubleshooting

### `SOCIAL_API_KEY not set — skipping real scrape (stub mode)`

The env var is missing. Add it to Railway and redeploy.

### `Apify actor start failed (401)`

The API token is invalid or expired. Rotate it in Apify Dashboard → Settings → Integrations → API tokens, then update `SOCIAL_API_KEY`.

### `Apify actor start failed (429)`

Rate limited. The free tier limits concurrent runs. Reduce scrape frequency or upgrade the Apify plan.

### `Apify run <id> ended with status: FAILED`

The actor encountered an error (Instagram rate limiting is common). The scraping service will retry up to 3 times with exponential backoff. If all retries fail, the error is thrown to the caller.

Check the run details directly:
```
https://console.apify.com/actors/runs/<runId>
```

### `Apify run <id> timed out after 40 polls`

The run took longer than 2 minutes. This can happen with large result sets or slow Instagram responses. Consider reducing `resultsLimit` in the service, or increase `MAX_POLL_ATTEMPTS`.

### High `skipped` count

Skipped reels already exist in the database (duplicate `external_id`). This is expected on repeated scrapes of the same niche and is handled with `ON CONFLICT DO NOTHING`.

---

## 8. Security Notes

- The Apify token is passed as a URL query parameter (`?token=...`) per Apify's API spec. Do not log full request URLs in production.
- The `SOCIAL_API_KEY` env var is accessed via `envUtil.ts` — never read `process.env` directly.
- Rotate the token immediately if it appears in logs, error messages, or version control.
