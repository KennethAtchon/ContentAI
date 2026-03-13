# Reel Creation Pipeline

End-to-end process for creating a reel within the Generate tab: from reel analysis → script generation → audio → video → editing → metadata.

**Date:** 2026-03-12
**Status:** Research
**Related:** `generate-tab-ai-chat-interface.md` (chat UI that drives this pipeline)

---

## Pipeline Overview

```
User references reel(s) in chat
  → Phase 1: AI Analysis (what makes this reel work?)
  → Phase 2: Script Generation (hook, caption, shot list)
  → Phase 3: Audio Production (voiceover + music track)
  → Phase 4: Video Production (AI-generated or user-provided + assembly)
  → Phase 5: Editing Suite (in-browser timeline editing)
  → Phase 6: Metadata & Export (hashtags, description, thumbnail)
  → Queue tab (schedule, review, publish)
```

Each phase is a discrete step in the chat conversation. The AI guides the user through them, but users can skip/reorder as needed.

---

## Phase 1: AI Reel Analysis

### What It Does

When a user references a reel, a specialized analysis AI scans it and explains what makes it special:

- **Hook analysis:** Why the first 1-3 seconds grab attention (pattern, emotional trigger, curiosity gap)
- **Structure breakdown:** Shot-by-shot timeline (intro hook → context → value → CTA)
- **Engagement drivers:** What correlates with high views (audio trend, visual pacing, text overlays, controversy)
- **Audio analysis:** Is the audio trending? Is it original speech, music, or both? Tempo and energy
- **Visual pacing:** Cut frequency, transitions, text timing
- **Audience psychology:** What emotional response drives shares/saves vs. just views

### Implementation

This extends the existing `POST /api/reels/:id/analyze` endpoint and `reel-analysis.txt` prompt.

**Current analysis fields** (already in `reelAnalyses` table):
- `hookPattern`, `hookCategory`, `emotionalTrigger`, `viralScore`, `remixSuggestion`
- `contentStructure`, `targetAudience`, `keyThemes`

**New fields to add to `reelAnalyses`:**
```
shotBreakdown       jsonb    -- [{timestamp: "0:00-0:03", description: "Close-up hook", technique: "pattern interrupt"}]
audioPacing         text     -- "fast/medium/slow" + BPM if music
cutFrequencyAnalysis text    -- "2.1s avg between cuts, accelerating toward end"
engagementDrivers   jsonb    -- ["trending_audio", "text_overlay_hook", "controversy"]
replicabilityScore  integer  -- 1-10, how easy is this to recreate
replicabilityNotes  text     -- "Requires: talking head, trending audio, text overlay capability"
```

**Dedicated analysis model:** Use a cheaper model for analysis (Claude Haiku or GPT-4o-mini) since it's high-volume and doesn't need creative quality. The existing `aiClient.ts` already supports model tiers — add an `"analysis-deep"` tier.

### Cost

Analysis is ~1,000 input tokens (reel metadata) + ~500 output tokens. At GPT-4o-mini pricing: ~$0.0005/analysis. At 1,000 users × 10 analyses/day = $5/month.

---

## Phase 2: Script Generation

### What It Does

The AI generates a complete reel script based on the analysis + user's creative direction:

- **Hook** (first 1-3 seconds — the most critical part)
- **Script/shot list** (scene-by-scene breakdown with timing)
- **Caption** (post copy with CTA)
- **On-screen text** (text overlays with timing cues)
- **Call to action** (comment prompt, follow CTA, link in bio reference)

### Implementation

This is handled by the chat interface (see `generate-tab-ai-chat-interface.md`). The AI responds with structured output:

```json
{
  "hook": "Stop scrolling if you...",
  "script": [
    { "timestamp": "0:00-0:03", "visual": "Close-up, direct eye contact", "audio": "Hook line", "text_overlay": "THIS changes everything" },
    { "timestamp": "0:03-0:08", "visual": "B-roll of product", "audio": "Context/story", "text_overlay": null }
  ],
  "caption": "Full caption text...",
  "hashtags": ["#fitness", "#reels", "#trending"],
  "cta": "Save this for later 📌"
}
```

The `generatedContent` table already stores `generatedHook`, `generatedCaption`, `generatedScript`. Add a `generatedMetadata` jsonb column for the structured shot list + text overlays + hashtags.

### Iterative Refinement

The chat interface supports multi-turn: "make the hook shorter", "change the angle to fear-based", "add a controversy element". Each iteration generates a new version stored as a new `generatedContent` row linked to the same `chatMessage`.

### Content Versioning

Add a `version` integer to `generatedContent` and a `parentId` self-referential FK. When the user iterates:
```
v1 (original) → v2 ("make it punchier") → v3 ("add controversy")
```
The Queue tab shows the latest version by default but can expand to see history.

---

## Phase 3: Audio Production

### Two Audio Types

**A. Text-to-Speech Voiceover**

Convert the script into spoken audio. Options:

| Provider | Quality | Cost | Latency | Notes |
|----------|---------|------|---------|-------|
| OpenAI TTS (`tts-1`) | Good | $15/1M chars | 1-3s | Already have OpenAI key |
| OpenAI TTS HD (`tts-1-hd`) | Better | $30/1M chars | 2-5s | Higher quality |
| ElevenLabs | Best | $5/mo starter | 1-2s | Most natural, cloning support |
| Google Cloud TTS | Good | $4/1M chars | <1s | Cheapest at scale |

**Recommendation for MVP:** OpenAI `tts-1` — already have the API key, good quality, simple integration. Upgrade to ElevenLabs for production quality later.

**Implementation:**
- New endpoint: `POST /api/audio/tts` → `{ text, voice, speed }` → returns audio URL
- Store in R2: `audio/tts/<generatedContentId>.mp3`
- Add `ttsAudioR2Key` column to `generatedContent`
- Voice selection: OpenAI offers alloy, echo, fable, onyx, nova, shimmer

**Cost:** Average reel script ~200 chars. At $15/1M chars = $0.003/voiceover. At 1,000 users × 5/day = $15/month.

**B. Music Track / Background Audio**

This is the "source popular audio songs" requirement. Two approaches:

**Approach 1: Audio library integration**

License a royalty-free music library and let users browse/search:
- **Epidemic Sound API** — $15/mo creator plan, API access, 40k tracks
- **Artlist API** — $10/mo, good for social content
- **Pixabay Music** — free, CC0, limited but zero cost
- **Uppbeat** — free tier with attribution, paid without

The AI can recommend tracks based on the reel's energy/mood from the analysis.

**Approach 2: Trending audio sourcing**

Track which audio IDs are trending on Instagram and surface them:
- The existing scraper already captures `audioName` and `audioId` from reels
- Build a `trendingAudio` table that aggregates `audioId` counts across scraped reels
- Show "Trending Audio" in the UI sorted by frequency in the last 7 days
- **Cannot provide the actual audio file** (copyright) — provide the audio name + ID so users can find/use it on Instagram directly

**Recommendation:** Both. Approach 2 for discovery ("what's trending"), Approach 1 for the actual audio track in generated reels. For MVP, start with Approach 2 (trending audio sourcing) since it uses existing data.

### Trending Audio Implementation

**New table:**
```sql
trendingAudio
  id          serial PK
  audioId     text NOT NULL UNIQUE    -- Instagram audio ID
  audioName   text NOT NULL
  artistName  text
  useCount    integer DEFAULT 0       -- how many scraped reels use this audio
  firstSeen   timestamp DEFAULT now()
  lastSeen    timestamp DEFAULT now()
  trending7d  integer DEFAULT 0       -- use count in last 7 days
```

**Population:** During reel scraping in `scraping.service.ts`, after `saveReels()`, upsert into `trendingAudio`:
```sql
INSERT INTO trendingAudio (audioId, audioName, artistName, useCount, lastSeen)
VALUES ($1, $2, $3, 1, now())
ON CONFLICT (audioId) DO UPDATE SET
  useCount = trendingAudio.useCount + 1,
  lastSeen = now()
```

**Endpoint:** `GET /api/audio/trending?days=7&limit=20` — returns top audio sorted by `useCount` in the last N days.

---

## Phase 4: Video Production

### Two Paths

**Path A: User-Provided Video**

User uploads their own video clips. The platform:
1. Stores clips in R2 (`video/uploads/<userId>/<filename>`)
2. Displays them in the editing suite timeline
3. AI can suggest edits ("add a text overlay at 0:03", "cut the first 2 seconds")

**Implementation:**
- New endpoint: `POST /api/media/upload` — multipart upload → R2
- Max file size: 100MB (configurable)
- Accepted formats: MP4, MOV, WebM
- Add `mediaUploads` table: `id, userId, projectId, r2Key, filename, mimeType, durationSeconds, createdAt`

**Path B: AI-Generated Video**

Use text-to-video or image-to-video AI to generate clips from the script.

| Provider | Type | Cost | Quality | Notes |
|----------|------|------|---------|-------|
| RunwayML Gen-3 | Text/Image → Video | $0.25/5s clip | High | Best quality, expensive |
| Stability AI (Stable Video) | Image → Video | $0.02/generation | Medium | Cheaper, needs input image |
| Pika Labs | Text → Video | $0.10/clip | Medium | Good for short clips |
| Luma Dream Machine | Text → Video | $0.10/clip | Good | Fast generation |
| OpenAI (future) | TBD | TBD | TBD | Not yet available |

**Recommendation for MVP:** Start with **image-to-video** using Stability AI or a cheap model. The flow:
1. AI generates scene descriptions from the script
2. Generate still images per scene (DALL-E 3 at $0.04/image or a cheaper model)
3. Animate each image into a 3-5 second clip
4. Stitch clips together

This is significantly cheaper than pure text-to-video ($0.06/scene vs $0.25/scene) and more controllable.

**Cost estimate:** A 30-second reel with 6 scenes: ~$0.36/reel (images) + ~$0.12/reel (animation) = ~$0.48/reel. At 1,000 users × 2 reels/day = $960/month. This is the most expensive component — must be gated by subscription tier.

**Implementation:**
- New service: `backend/src/services/video/video-generator.ts`
- Job queue: Video generation is async (30s-2min). Use the existing queue pattern but for video jobs.
- Store output in R2: `video/generated/<generatedContentId>/<scene>.mp4`
- New endpoint: `POST /api/video/generate` → `{ generatedContentId, scenes }` → returns job ID
- Poll endpoint: `GET /api/video/generate/:jobId` → status + output URLs

### Video Assembly

After all scenes (user-provided or AI-generated) exist, assemble them into a final reel:

**Server-side option: FFmpeg**
- FFmpeg via Bun subprocess (`Bun.spawn(["ffmpeg", ...])`)
- Concat clips, overlay text, mix audio tracks, add transitions
- Output: single MP4 at 1080x1920 (9:16 reel format)
- Requires FFmpeg installed in the Docker image

**Implementation:**
- New service: `backend/src/services/video/video-assembler.ts`
- Input: array of clip R2 keys + text overlay specs + audio track R2 key
- Output: final MP4 uploaded to R2
- This is CPU-intensive — should run in a separate worker service, not the main Hono process

---

## Phase 5: Editing Suite (In-Browser)

### Scope

A lightweight in-browser video editor for fine-tuning the assembled reel. Not a full NLE (no After Effects) — more like CapCut's editor.

### Core Features (MVP)

- **Timeline view:** Visual track with clips laid out
- **Trim/split:** Drag clip edges to trim, split at playhead
- **Text overlays:** Add/edit/position text with timing
- **Audio mixing:** Adjust voiceover vs music volume
- **Preview:** Real-time playback of the assembled reel
- **Export:** Send edits back to server for FFmpeg re-render

### Technology Options

| Library | Type | Notes |
|---------|------|-------|
| **Remotion** | React video framework | Renders video programmatically in React. Great for template-based reels. Can render server-side via Lambda/serverless. |
| **FFmpeg.wasm** | In-browser FFmpeg | Full FFmpeg in WebAssembly. Heavy (25MB), but handles everything. |
| **Canvas/WebGL** | Custom | Most control, most work. Use for real-time preview only, server-side FFmpeg for final render. |
| **Editly** | Node.js library | Wraps FFmpeg with a declarative API. Good for server-side assembly. |

**Recommendation:**
- **Preview:** Custom Canvas/WebGL renderer in the browser (lightweight, real-time)
- **Final render:** Server-side FFmpeg via `video-assembler.ts`
- **Text overlays:** React components positioned over the video preview, exported as FFmpeg drawtext commands

### "Tell the AI What to Change" Flow

In the chat interface, users can describe edits in natural language:
- "Add a text overlay saying 'WAIT FOR IT' at the 3-second mark"
- "Make the cuts faster in the first 5 seconds"
- "Lower the music volume during the voiceover"

The AI translates these into edit commands (JSON) that the editing suite applies. This is the bridge between the chat interface and the editor — the AI operates on the same edit spec that the visual editor produces.

**Edit spec format:**
```json
{
  "clips": [
    { "id": "clip1", "r2Key": "...", "startTime": 0, "endTime": 5.2, "trimStart": 0.5 }
  ],
  "textOverlays": [
    { "text": "WAIT FOR IT", "startTime": 3.0, "endTime": 5.0, "position": "center", "style": "bold-white" }
  ],
  "audio": {
    "voiceover": { "r2Key": "...", "volume": 1.0 },
    "music": { "r2Key": "...", "volume": 0.3 }
  },
  "transitions": [
    { "type": "cut", "at": 5.2 }
  ]
}
```

### Priority

The editing suite is the most complex UI component. Priority order:
1. **P0 (MVP):** Server-side FFmpeg assembly with AI-described edits via chat (no visual editor)
2. **P1:** In-browser preview player with text overlay positioning
3. **P2:** Full timeline editor with trim/split
4. **P3:** Real-time effects and transitions

---

## Phase 6: Metadata & Export

### Hashtag Generation

The AI generates hashtags as part of script generation. Additional enrichment:

- **Trending hashtags:** Cross-reference with scraped reel data — which hashtags appear most in viral reels within the user's niche
- **Hashtag strategy:** Mix of high-volume (discoverability) + niche-specific (targeting) + branded
- **Count:** Instagram optimal is 3-5 hashtags (2025+ algorithm)

**Implementation:** The AI prompt includes trending hashtag data from the `trendingAudio`-style aggregation, but for hashtags. Add a `trendingHashtags` table populated during scraping.

### Thumbnail Generation

- Auto-extract the "hook frame" (the most visually compelling frame in the first 3 seconds)
- Or generate a custom thumbnail via image AI (DALL-E / Stability)
- Store in R2: `thumbnails/generated/<generatedContentId>.jpg`

### Export Options

1. **Download MP4** — direct download from R2 presigned URL
2. **Copy script** — clipboard copy of hook + caption + hashtags
3. **Send to Queue** — moves to Queue tab for scheduling (existing `POST /api/generation/:id/queue`)
4. **Publish to Instagram** — future integration via Instagram Graph API (requires Business account connection, already have `instagramPages` table)

---

## Architecture Summary

### New Database Tables

| Table | Purpose |
|-------|---------|
| `trendingAudio` | Aggregated trending audio from scraped reels |
| `trendingHashtags` | Aggregated trending hashtags from scraped reels |
| `mediaUploads` | User-uploaded video/image clips |
| `videoJobs` | Async video generation/assembly job tracking |

(Plus the 3 tables from `generate-tab-ai-chat-interface.md`: `projects`, `chatSessions`, `chatMessages`)

### New Services

| Service | Location | Purpose |
|---------|----------|---------|
| `chat-generator.ts` | `backend/src/services/chat/` | Chat-based content generation |
| `tts.ts` | `backend/src/services/audio/` | Text-to-speech via OpenAI TTS |
| `video-generator.ts` | `backend/src/services/video/` | AI video generation (image→video) |
| `video-assembler.ts` | `backend/src/services/video/` | FFmpeg-based video assembly |
| `trending.ts` | `backend/src/services/analytics/` | Trending audio/hashtag aggregation |

### New Endpoints

```
POST /api/audio/tts              — generate voiceover
GET  /api/audio/trending         — trending audio list
POST /api/media/upload           — upload user video/image
POST /api/video/generate         — start AI video generation job
GET  /api/video/generate/:jobId  — poll job status
POST /api/video/assemble         — assemble final reel from edit spec
GET  /api/hashtags/trending      — trending hashtags by niche
```

### Cost Summary (Monthly at 1,000 Users)

| Component | Estimated Cost |
|-----------|---------------|
| AI Analysis (GPT-4o-mini) | ~$5 |
| Script Generation (GPT-4o-mini) | ~$38 |
| TTS Voiceover (OpenAI tts-1) | ~$15 |
| Image Generation (cheap model) | ~$240 |
| Video Animation (Stability AI) | ~$720 |
| **Total** | **~$1,018/month** |

Video generation is by far the most expensive. This must be gated by subscription tier (see `usage-limits-and-cost-tracking.md`).

---

## Implementation Priority

```
P0 (MVP — Chat + Script):
  - AI analysis (enhanced prompt, new fields)
  - Script generation via chat (hook, caption, shot list, hashtags)
  - Content versioning (version + parentId on generatedContent)

P1 (Audio):
  - TTS voiceover integration (OpenAI tts-1)
  - Trending audio sourcing from scraped data
  - Audio library integration (Pixabay free tier or similar)

P2 (Video — User-Provided):
  - Media upload endpoint + R2 storage
  - Server-side FFmpeg assembly (clips + text overlays + audio)
  - AI-described edits via chat ("add text at 3s")

P3 (Video — AI-Generated):
  - Image generation per scene
  - Image-to-video animation
  - Full assembly pipeline

P4 (Editing Suite):
  - In-browser preview player
  - Text overlay visual editor
  - Timeline with trim/split
  - Real-time preview
```
