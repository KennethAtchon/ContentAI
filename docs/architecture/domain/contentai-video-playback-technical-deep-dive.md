## Video Playback

This document explains how reel videos actually get served to the browser — why we copy videos to our own storage, why URLs expire, and how fallback works.

---

## The Problem With Instagram URLs

When Apify scrapes a reel, it returns the video's Instagram CDN URL. These URLs have two problems: they can expire (Instagram doesn't intend for third parties to hotlink their CDN), and they can become rate-limited if too many people hit them. Relying on Instagram CDN URLs directly is fragile.

The solution is to copy the video to our own storage (Cloudflare R2) immediately after scraping. R2 is an S3-compatible object store — we control it, the files don't expire, and we control access.

---

## The R2 Mirror Happens Asynchronously

After a reel is inserted into the database, the video and audio are uploaded to R2 in a fire-and-forget fashion. The database insert doesn't wait for the upload to finish. This means:

- A reel can appear in the Discover UI before its R2 copy is ready.
- The first user to load a newly scraped reel might get the Instagram URL instead of the R2 URL.
- Once the upload finishes, subsequent loads get the R2 URL.

This is acceptable because the Instagram URL usually works initially — R2 is for reliability, not immediate access.

The upload uses `Promise.allSettled` for video and audio in parallel. If one fails, the other still completes. Each successful upload stores the R2 URL back in the reel's database row.

---

## Why Not Just Use the R2 URL Directly?

R2 objects can be configured as private (no public access). We use private buckets and generate short-lived signed URLs for playback. This means:

- The files in R2 aren't publicly accessible URLs you could share or hotlink
- Every playback request goes through our API, which verifies the user is authenticated before generating a signed URL
- The signed URL is good for 1 hour, after which it expires

This is the standard pattern for authenticated media access. The browser never gets a permanent URL to the file — it gets a time-limited proof that it's allowed to download it right now.

---

## How Playback Works

When the user activates a reel card in the Discover UI:

1. The frontend calls `GET /api/reels/:id/media-url`.
2. The backend looks up the reel's `videoR2Url` column.
3. If the R2 URL exists, it extracts the object key from the URL, calls the R2 SDK to generate a presigned GET URL (1-hour TTL), and returns that URL.
4. If signing fails, or if there's no R2 URL, it falls back to the original `videoUrl` from the scrape.
5. The frontend plugs that URL into a native HTML5 `<video>` tag. That's it — the browser fetches the video directly from R2 (or the fallback CDN), not from our server.

Our server is only involved in generating the signed URL. The actual video bytes never pass through our backend.

The frontend caches this URL for 30 minutes (shorter than the 1-hour expiry, to avoid ever handing the browser a URL that's about to expire).

---

## What the Player Actually Is

There's no custom video player, no HLS manifest, no adaptive bitrate. It's a native `<video>` element with a single MP4 source URL. No transcoding, no quality ladder. The video plays at whatever resolution Apify scraped.

The player handles:
- Loop playback
- Click to pause/resume
- Mute sync
- Buffering indicators (shows a spinner while the browser is fetching)
- Fallback to thumbnail if no video source is available

---

## Failure Modes

If R2 signing fails (e.g., R2 credentials are misconfigured), the backend falls back to the original scraped URL and returns 200 — not an error. The preference is for availability over technical purity.

If there's no video URL at all (neither R2 nor original scrape URL), the API returns 404. The player falls back to the thumbnail image or an emoji placeholder.

The R2 environment variables (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`) must all be set for the upload and signing paths to work. If any are missing, those operations fail silently and the fallback URL is used.
