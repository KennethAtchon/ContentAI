## Reel Generation System

This document explains how videos are actually made — the two-phase pipeline (AI clip generation, then FFmpeg assembly), why it's async, and how audio mixing and captions work.

---

## The High-Level Idea

Making a video involves two completely separate phases that run at different times:

**Phase 1 — Video Clip Generation:** The AI generates individual video clips, one per "shot" in the script. Each clip is a short video file that gets stored in R2. This is done by external AI video providers (Kling via Fal.ai, or Runway). Each clip takes 30–90 seconds to generate.

**Phase 2 — Assembly:** FFmpeg takes all the generated clips, concatenates them into one video, mixes in a voiceover (if any) and background music (if any), burns in captions (if requested), and uploads the final MP4 to R2.

These phases are separate because they have different inputs and can run independently. You can regenerate individual shots without reassembling the whole video. You can reassemble with different audio settings without regenerating any clips.

---

## Why Everything Runs as Async Jobs

Video generation takes too long to do in a synchronous HTTP request. A clip that's 5 seconds long can take a minute to generate from an AI video provider. A script with 5 shots means ~5 minutes total. You can't hold an HTTP connection open that long.

Instead, the API creates a job record and returns immediately with a job ID. The actual work runs in a background worker. The frontend polls the job status endpoint until the job completes or fails.

Jobs are stored in PostgreSQL and processed by an in-memory queue with a single worker. The single worker prevents hammering the AI video providers with concurrent requests, which would cause rate limit errors.

---

## Phase 1: How Clips Get Generated

The script gets parsed into individual shots — each shot has a text description and a target duration. For example, "person walking confidently into a modern office building, 5 seconds."

Each shot becomes one API call to the video provider. The provider returns a video file (or a URL to one). The backend downloads it, uploads it to R2, and creates a `reel_asset` row of type `video_clip` with the shot index stored in its metadata.

The shot index is critical — it's what lets the assembly phase put clips in the right order.

If the configured video provider isn't available (no API key), the system falls back through a priority list: Kling (via Fal) → image-based Ken Burns effect → Runway. The Ken Burns fallback generates a video from a static image with a slow pan/zoom, which isn't great but produces something rather than nothing.

---

## Phase 2: How Assembly Works

Assembly is triggered separately after clips are ready. When the user (or the pipeline automatically) requests assembly:

1. **Clip retrieval:** All `reel_asset` rows of type `video_clip` are fetched, ordered by `shotIndex`. Their R2 keys are used to generate signed download URLs.

2. **Concatenation:** FFmpeg downloads each clip and concatenates them using the concat demuxer (`-f concat`). This is a lossless join — no re-encoding, so it's fast and doesn't degrade quality. If the lossless join fails (incompatible clip formats), it falls back to re-encoding with libx264.

3. **Audio mixing:** If a voiceover exists (from TTS), it's mixed in at 1.0x volume (full). If a music track is attached, it's mixed in at 0.22x (background). Clip audio is muted by default (set to 0) unless `useClipAudio` is enabled per-clip. FFmpeg's `amix` filter handles the combining.

4. **Caption burning:** If captions are requested, the script text is broken into 3-word chunks, timed evenly across the video duration, formatted as an ASS subtitle file, then burned directly into the video frames using FFmpeg's `ass` filter. Burned-in captions are permanent — they're part of the video pixels, not a separate track. They'll show on any player anywhere.

5. **Output:** The assembled MP4 is uploaded to R2 under `assembled/{userId}/{contentId}/{jobId}.mp4`. The `generatedContent` row is updated with the video URL. A `reel_asset` of type `assembled_video` is created.

---

## Audio Mixing Details

The audio levels are fixed at:
- **Voiceover:** 1.0x (primary voice, full volume)
- **Music:** 0.22x (background texture, not competing with voice)
- **Original clip audio:** 0.35–0.45x if enabled (supplemental)

The mix duration is set to `longest` — audio continues as long as any input stream is playing. The voiceover usually dictates the effective duration.

---

## Re-Assembly

Users can re-assemble existing clips with different settings without regenerating the clips. This is useful for:
- Trying captions on/off
- Adjusting audio mix levels (voiceover vs music volume)
- Adding or changing the music track

Re-assembly uses the same endpoint (`POST /api/video/assemble`) but picks up whatever clips, voiceover, and music assets currently exist for that content. It's fast relative to clip generation because FFmpeg assembly takes seconds, not minutes.

---

## Temporary Files

Assembly runs in a temp directory on the server. Clips are downloaded there, concatenated there, audio-mixed there, and the final file is read and uploaded to R2 from there. After upload completes, the temp files are cleaned up. Nothing persists on the server disk after a successful assembly.

FFmpeg must be installed and in the server's PATH. Assembly fails immediately with a clear error if FFmpeg isn't found — it doesn't try to proceed.

---

## What Can Go Wrong

**Clip generation fails:** The job fails. Individual shots can be regenerated via a "retry" endpoint that creates a new job with the same parameters.

**Audio mix fails:** Assembly continues without audio mixing — the video is saved without the voiceover/music overlay. This is a graceful degradation, not a hard failure.

**Caption burn fails:** Assembly continues without captions. Same graceful degradation approach.

**FFmpeg concat fails (lossless):** Falls back to re-encoding. Slower but produces a result.

**Provider unavailable:** Automatically tries the next provider in the fallback chain.
