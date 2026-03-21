## Audio & TTS System

This document explains how voiceovers are generated, why scripts need sanitization before going to TTS, and how trending audio actually works.

---

## Two Unrelated Features in One Doc

The audio system covers two things that share routing but are otherwise independent:

**Text-to-Speech** — converts an AI-generated script into an MP3 voiceover using ElevenLabs. The output is stored in R2 and linked to the content's production pipeline.

**Trending Audio** — surfaces which background audio tracks are currently popular across the scraped reels. This has nothing to do with TTS — it's analytics over scrape data.

---

## Why Scripts Need Sanitization Before TTS

AI-generated scripts contain metadata that looks like text but isn't meant to be spoken. Things like:

- `[0-3s]` — timing markers for video editing
- `(cut to: close-up shot)` — stage directions
- `[HOOK]`, `[Scene 1]` — structural labels
- `Hook:`, `CTA:` — section headers

If you feed this to ElevenLabs, it will literally say "hook colon" and "zero to three seconds" out loud. The sanitization step strips all of these before the text goes to the API. What remains is only the words the AI intended for the viewer to hear.

---

## How TTS Generation Works

The user picks a voice and submits a script. The backend:

1. Sanitizes the script (removes markers, directions, labels as described above)
2. Calls ElevenLabs with the cleaned text, the selected voice ID, and a speed setting
3. Receives an MP3 binary back from ElevenLabs
4. Uploads the MP3 to R2 under `audio/voiceovers/{userId}/{assetId}.mp3`
5. Creates a `reel_asset` row of type `"voiceover"` with the R2 key and duration
6. Records the cost (estimated from character count and ElevenLabs' pricing)
7. Returns a signed R2 URL so the frontend can immediately play back the result

The `reel_asset` row is what the video assembly pipeline looks for when building the final video. The voiceover doesn't get embedded into anything at this stage — it just exists in R2, attached to the content via the asset record.

---

## The Voice Catalog

Five voices are available, mapped to ElevenLabs voice IDs in a static config file. The mapping is internal — the frontend sends IDs like `jessica-v1`, the backend translates to the actual ElevenLabs voice ID. This decouples the UI from ElevenLabs' ID scheme, so voices can be swapped out without frontend changes.

Voice preview URLs are signed R2 URLs generated on request when the voice list is fetched. The preview MP3 files live in R2 and are served the same way as voiceover files.

---

## How Trending Audio Works

When Apify scrapes reels, it captures the audio used in each reel (audio ID and name from Instagram's music data). The trending audio endpoint aggregates this data from the `reel` table.

It counts how many scraped reels used each audio track within a given time window (default: last 7 days), then compares that to the previous window of the same length:
- If use count went up → `rising`
- If it went down → `declining`
- If unchanged → `stable`

This tells users which sounds are gaining momentum. "Aesthetic" by Tollan Kim appearing in 14 reels this week vs 8 last week signals rising popularity.

Trending audio is a browse feature only — users can see what's trending but can't directly attach a trending audio track to their content (trending tracks are Instagram-licensed audio, not files we own). The intent is to inform creative choices and suggest sounds to find/license elsewhere.

---

## What Happens If ElevenLabs Is Down or the Key Is Missing

If `ELEVENLABS_API_KEY` isn't set, TTS endpoints return 503. The error is distinguishable from a runtime failure — 503 means "service not configured," not "something crashed."

Trending audio is unaffected — it doesn't call ElevenLabs at all. It queries the local database.
