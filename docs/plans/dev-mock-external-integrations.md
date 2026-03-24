# Plan: `DEV_MOCK_EXTERNAL_INTEGRATIONS` (Hono → externals)

## Goal

In **development** (`APP_ENV=development`), optionally replace outbound calls to **expensive or slow** integrations with **bundled binary fixtures** uploaded to R2, while **keeping the same DB writes and linking** (assets, `content_assets`, job progress, editor timeline refresh). Final renders use the **Studio Editor** export path, not server-side assembly.

Scope for this iteration:

1. **Reel scrape** — already mocked via `dev-mock-reels.json`; gate moves under the umbrella flag (with backward-compatible env defaults).
2. **Video clip generation** (`generateVideoClip` → fal / Runway / etc.) — upload a fixed MP4 per “generated” clip.
3. **Text-to-speech** (`generateSpeech` → ElevenLabs) — return a fixed MP3 buffer; callers keep uploading to R2 and inserting `assets` / `content_assets` as today.
4. **`runReelGeneration`** — when the umbrella flag is on, **always build exactly four shots** (ignore parsed script shot list) so UI and assembly always exercise a multi-shot path.

Production and `APP_ENV=test` are unaffected: the umbrella is `false` unless `APP_ENV=development`.

## Environment variables

| Variable | Meaning |
|----------|---------|
| `DEV_MOCK_EXTERNAL_INTEGRATIONS` | Master switch. When `true` in development, enables fixture-based scrape + video + TTS. When unset, defaults to the same behavior as the legacy scrape flag (see below). |
| `DEV_USE_MOCK_REEL_SCRAPE` | **Legacy.** Still read for the default of `DEV_MOCK_EXTERNAL_INTEGRATIONS` when the new var is unset, so existing `.env` files behave the same. Prefer setting only `DEV_MOCK_EXTERNAL_INTEGRATIONS` going forward. |

Effective rule in code:

```text
DEV_MOCK_EXTERNAL_INTEGRATIONS =
  IS_DEVELOPMENT &&
  booleanEnv("DEV_MOCK_EXTERNAL_INTEGRATIONS", booleanEnv("DEV_USE_MOCK_REEL_SCRAPE", IS_DEVELOPMENT))
```

`DEV_USE_MOCK_REEL_SCRAPE` is re-exported as an **alias** of `DEV_MOCK_EXTERNAL_INTEGRATIONS` so `scraping.service.ts` can keep a single boolean without drift.

## Fixture files (repo-local)

All under `backend/fixtures/media/` (committed to git):

| File | Role | Source (royalty-free / sample) |
|------|------|--------------------------------|
| `dev-mock-clip-1.mp4` … `dev-mock-clip-4.mp4` | Four distinct stand-ins; chosen by `metadata.shotIndex % 4` | See `backend/fixtures/media/README.md` (GTV samples ×2, MDN CC0 flower, W3Schools BBB sample). |
| `dev-mock-voiceover.mp3` | Stand-in for ElevenLabs output | [FileSamples — sample MP3](https://filesamples.com/formats/mp3) (`sample3.mp3`) |

See `backend/fixtures/media/README.md` for paths and attribution. If a file is missing at runtime, the dev server should throw a clear error pointing at that README.

## What each service returns today vs mock

### 1) Video clip (`generateVideoClip`)

**Real path:** `VideoGenerationProvider.generate()` → external API → `storage.uploadFromUrl` → returns `VideoClipResult`:

- `r2Key`, `r2Url` — clip in R2  
- `durationSeconds` — clamped 3–10 from request  
- `provider` — `"kling-fal"` \| `"runway"` \| `"image-ken-burns"`  
- `costUsd`, `generationTimeMs`

**Mock path (early return in `generateVideoClip`, before provider resolution):**

- Await **`DEV_MOCK_VIDEO_CLIP_DELAY_MS`** (default **15000** in development; env `DEV_MOCK_VIDEO_CLIP_DELAY_MS`, use `0` to skip) to mimic real provider latency, then read one of `dev-mock-clip-{1..4}.mp4` from disk using `metadata.shotIndex` (mod 4; default 0), each file cached after first read.
- `storage.uploadFile(buffer, key, "video/mp4")` with a unique key: `video-clips/{userId|anon}/dev-mock-slot{N}-{timestamp}.mp4`.
- Return `VideoClipResult` with:
  - `durationSeconds`: same clamp as real (`Math.min(10, Math.max(3, requested))`) for DB/metadata consistency (actual file length may differ; assembly still works on the uploaded object).
  - `provider`: `"dev-fixture"` (new discriminant for ledger + asset metadata; not selectable in admin UI).
  - `costUsd`: `0`
  - `generationTimeMs`: wall time of upload only

Ledger row (`ai_cost_ledger`): still inserted with `provider` / `model` = `dev-fixture`, `totalCost` = 0.

### 2) Voiceover TTS (`generateSpeech`)

**Real path:** POST ElevenLabs → `audio/mpeg` buffer → `TTSResult` `{ audioBuffer, durationMs }` with duration estimated from buffer size (~128 kbps heuristic).

**Mock path (start of `generateSpeech`):**

- Read `dev-mock-voiceover.mp3` (cached).
- Return `{ audioBuffer, durationMs }` using the **same size-based heuristic** as production for consistency with downstream `assets.durationMs`.

Callers (`chat-tools` `generate_voiceover`, `routes/audio`) unchanged: they upload with `uploadFile`, insert `assets` (`type: "voiceover"`, `source: "tts"`), link `content_assets` with `role: "voiceover"`.

### 3) Reel scrape (`ScrapingService.scrapeNiche`)

**Unchanged behavior**, only the **flag** is unified:

- When mock: existing `scrapeViaMockData` + `dev-mock-reels.json` (no Apify).

### 4) Reel generation job (`runReelGeneration`)

**Real path:** `parseScriptShots(generatedScript)` → if non-empty, use those shots; else one fallback shot from prompt. For each shot, `generateVideoClip` → insert `assets` + `content_assets` → `refreshEditorTimeline` → job completes with `shotCount`. Final mix/export is **only** via the Studio Editor (no server-side assembly).

**Mock path:** When `DEV_MOCK_EXTERNAL_INTEGRATIONS`, **skip** `parseScriptShots` entirely (invalid scripts do not block dev). Build **exactly four** `ShotInput` entries (`buildMockDevReelShots`):

- `shotIndex`: `0..3`
- `description`: `[mock 1/4] …` through `[mock 4/4]` plus a snippet of the fallback prompt (for debugging in metadata).
- `durationSeconds`: `clamp(3, input.durationSeconds ?? 5, 10)`

Then the same per-shot loop, DB inserts, phase4 metadata, and `refreshEditorTimeline` calls as production — still **no** chat/server assembly step.

## Code touchpoints (implementation checklist)

- [x] `backend/src/utils/config/envUtil.ts` — define `DEV_MOCK_EXTERNAL_INTEGRATIONS`, alias `DEV_USE_MOCK_REEL_SCRAPE`.
- [x] `backend/src/services/media/dev-fixtures/load-fixtures.ts` — load/cache buffers, resolve paths relative to `backend/fixtures/media`.
- [x] `backend/src/services/media/video-generation/types.ts` — `VideoClipResult.provider` allows `"dev-fixture"`.
- [x] `backend/src/services/media/video-generation/index.ts` — mock branch in `generateVideoClip`; `recordMediaCost` typed with `VideoClipResultProvider`.
- [x] `backend/src/services/tts/elevenlabs.ts` — mock branch in `generateSpeech`.
- [x] `backend/src/routes/video/index.ts` — four-shot mock path + skip script parse.
- [x] `backend/src/services/scraping.service.ts` — use umbrella + log message.
- [x] `backend/.env.example` — document `DEV_MOCK_EXTERNAL_INTEGRATIONS` and legacy var.
- [x] `backend/fixtures/media/README.md` — attribution and filenames.

## Out of scope (follow-ups)

- Mocking OpenAI / chat completions or assembly ffmpeg (only clip + TTS + scrape here).
- Per-subsystem overrides (e.g. real video, mock TTS) — add `DEV_MOCK_*` fragments only if needed later.
- Probing real duration of fixture MP4/MP3 with ffprobe (optional hardening).

## Verification

- With `APP_ENV=development` and `DEV_MOCK_EXTERNAL_INTEGRATIONS=true`: trigger reel generation → job `progress.totalShots === 4`, four `video_clip` assets, editor timeline updates via `refreshEditorTimeline`, job status `completed` — **without** fal/Eleven keys on clip/TTS paths that hit these mocks. Open the Editor to export the final file.
- With `DEV_MOCK_EXTERNAL_INTEGRATIONS=false` and keys set: existing real providers behave as before.
