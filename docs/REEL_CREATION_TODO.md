# Reel Creation Pipeline — Focused Roadmap

**Last updated:** 2026-03-14
**Mandate:** Everything below serves one goal — a user goes from script to finished reel inside ContentAI. Nothing else gets built until this is fully shipped.

---

## What Already Exists

These are done and not revisited:

- Phase 1 (Analysis): AI reel breakdown — hook patterns, emotional triggers, format patterns, engagement drivers, replicability score. Complete.
- Phase 2 (Script Generation): AI chat with streaming, project/session management, reel referencing, script/hook/caption generation, content versioning, export to queue. Complete.
- R2 storage service: Upload, delete, signed URLs, upload-from-URL. Works for files and buffers. Ready to use for audio/video assets.
- Database: `generated_content` table has `videoR2Url`, `thumbnailR2Key`, `generatedMetadata` (JSONB) fields already. These are empty but wired.
- Trending audio data: `trending_audio` table populated by scraping. Audio metadata (name, artist, use count) exists. No playback or selection UI.

---

## Phase 3: Audio Production

**User problem:** User has a script but no audio. They need a voiceover track and optionally a background music track to make a reel. Without audio, there is no reel.

**This is the hardest infrastructure phase.** It introduces external AI services (TTS, music generation) and binary asset management for the first time.

### Prerequisites (build first)

- [ ] **Asset storage schema migration** — Add `reel_asset` table to track individual assets per generated content:
  ```
  reel_asset { id, generatedContentId, userId, type ("voiceover" | "music" | "video_clip" | "image"),
               r2Key, r2Url, durationMs, metadata (jsonb), createdAt }
  ```
  This replaces jamming everything into `generated_content` columns. Every audio/video artifact gets its own row. The editing suite in Phase 5 needs this structure.
- [ ] **Asset upload/download API** — `POST /api/assets/upload`, `GET /api/assets/:id/url` (signed URL), `DELETE /api/assets/:id`. Scoped to user. Uses existing R2 service.
- [ ] **TTS provider integration** — Pick ONE provider. Recommendation: ElevenLabs (best quality-to-latency ratio for short-form). Alternatives: OpenAI TTS, Play.ht. Decision: ElevenLabs for v1, abstract behind a provider interface so we can swap later.
- [ ] **Cost tracking for audio generation** — Extend `ai_cost_ledger` to track TTS and music generation costs per user. Add `featureType: "tts" | "music_gen"`.

### Core Features

- [ ] **TTS voiceover generation**
  - User selects a script (from chat or queue) and triggers "Generate Voiceover"
  - Voice selection: 3-5 preset voices to start (name + short preview). No custom voice cloning in v1.
  - Speed/tone controls: normal, slow, fast. That is it. No pitch sliders.
  - Backend: `POST /api/audio/tts` accepts `{ text, voiceId, speed }`, calls ElevenLabs, uploads result to R2, creates `reel_asset` row, returns signed URL.
  - Frontend: inline audio player in the chat/generation panel. Play, pause, download.
  - **Acceptance criteria:** User generates a voiceover from script text, hears it, and it is saved as an asset linked to their generated content.

- [ ] **Music track selection (system library)**
  - Admin uploads curated royalty-free music tracks via admin portal
  - Tracks categorized by: mood (energetic, calm, dramatic, funny), duration bucket (15s, 30s, 60s), genre
  - User browses library, previews tracks, selects one
  - Selected track saved as asset reference (not duplicated per user)
  - **Acceptance criteria:** User can browse, preview, and attach a music track to their content.

- [ ] **AI music generation (stretch — build AFTER library)**
  - Integration with Suno or Udio API for custom background tracks
  - User provides mood/genre prompt, AI generates a 15-30s track
  - **This is a stretch goal for Phase 3.** The system library is sufficient for MVP. Only build this if the library feels limiting in user testing.

- [ ] **Audio preview and management UI**
  - Within the Generate workspace: an "Audio" panel/tab showing attached voiceover + music
  - Play/pause for each track
  - Replace or remove tracks
  - Volume balance slider (voiceover vs music relative volume) — stored as metadata, applied during assembly in Phase 4
  - **Acceptance criteria:** User can see, play, and manage all audio assets for a piece of content before moving to video.

### Out of Scope for Phase 3

- Audio waveform editing (that is Phase 5)
- Audio effects/filters
- Custom voice cloning
- Audio-to-text transcription
- Syncing audio to video (that is Phase 4)

---

## Phase 4: Video Production

**User problem:** User has script + audio but no visuals. They need video clips (AI-generated or uploaded) assembled into a reel with their audio track.

**Depends on:** Phase 3 complete (audio assets exist and are manageable).

### Prerequisites

- [ ] **Video generation provider integration** — Pick ONE for AI video. Recommendation: Runway Gen-3 or Kling for short clips (3-5s each). Abstract behind provider interface. These are expensive — usage limits matter here.
- [ ] **User file upload flow** — `POST /api/assets/upload` must handle video files (mp4, mov) and images (jpg, png) up to a size limit (100MB for video, 10MB for images). Validate file type server-side. Upload to R2 with progress indication on frontend.
- [ ] **FFmpeg or Remotion backend service** — For server-side video assembly. Recommendation: Remotion (React-based, runs on server, produces mp4). Alternative: FFmpeg via subprocess. Decision: Remotion for v1 because it gives us programmatic composition and we are already a React shop. If latency is unacceptable, fall back to FFmpeg.
- [ ] **Assembly job queue** — Video rendering is slow (30s-2min). Needs async job processing. Extend the existing `QueueService` pattern or use a dedicated worker. Job states: queued, rendering, completed, failed. User polls for status.

### Core Features

- [ ] **AI video clip generation**
  - From the script's shot list (Phase 2 already generates shot breakdowns), user can generate a 3-5s video clip per shot
  - Prompt is pre-filled from the shot description. User can edit before generating.
  - Result saved as `reel_asset` with type "video_clip"
  - Preview inline in the workspace
  - **Acceptance criteria:** User generates an AI video clip from a shot description and sees it in their asset panel.

- [ ] **User video/image upload**
  - Drag-and-drop or file picker in the workspace
  - Upload progress bar
  - Uploaded files saved as `reel_asset`
  - Image uploads auto-converted to 3-5s video clips (Ken Burns effect or static) during assembly
  - **Acceptance criteria:** User uploads their own footage and it appears as a usable clip in their asset panel.

- [ ] **Storyboard/shot list UI**
  - Visual representation of the reel as a sequence of shots
  - Each shot shows: thumbnail, duration, description, assigned clip (AI-generated or uploaded)
  - Drag to reorder shots
  - Add/remove shots
  - This is NOT the full timeline editor (Phase 5). This is a simplified card-based sequence view.
  - **Acceptance criteria:** User can see their reel as an ordered sequence of shots, assign clips to each, and reorder them.

- [ ] **One-click assembly (rough cut)**
  - "Assemble Reel" button takes all shots + audio and renders a single mp4
  - Backend stitches clips in sequence, overlays voiceover, mixes in music track at the volume ratio from Phase 3
  - Output saved as `reel_asset` with type "assembled_video" and linked to `generated_content.videoR2Url`
  - Renders asynchronously. User sees progress and gets notified when done.
  - Result plays in an inline video player
  - **Acceptance criteria:** User clicks assemble and gets back a watchable mp4 reel that combines their clips and audio.

### Out of Scope for Phase 4

- Transitions between clips (Phase 5)
- Text overlays / captions on video (Phase 5)
- Color grading
- Green screen / background removal
- Multi-track video compositing

---

## Phase 5: In-Browser Editing Suite

**User problem:** The rough cut from Phase 4 is close but not right. User needs to trim clips, adjust timing, add text overlays, and fine-tune without leaving the browser. Two modes: quick fixes for most users, precision control for power users.

**Depends on:** Phase 4 complete (assembled video exists, individual clips exist as assets).

**This is the most complex frontend phase.** It requires a canvas/timeline rendering system. Build it incrementally.

### Prerequisites

- [ ] **Client-side video rendering library** — Recommendation: Remotion Player for preview (already using Remotion on backend), or custom canvas-based renderer. The preview must be frame-accurate and responsive. Evaluate: Remotion Player vs custom HTML5 Canvas + Web Audio API.
- [ ] **Project composition data model** — A JSON structure stored in `generated_content.generatedMetadata` (or a new `reel_composition` table) that describes the full timeline: clips, their start/end times, audio tracks, text overlays, transitions. This is the "project file" that the editor reads and writes.
  ```
  reel_composition { id, generatedContentId, userId,
                     timeline (jsonb), version, createdAt, updatedAt }
  ```
  The timeline JSONB holds: tracks (video, audio, text), each with ordered items referencing asset IDs, start/end times, and properties.

### 5A: Quick Edit Mode (build first)

This is what 80% of users need. Ship this before precision editing.

- [ ] **Clip trimmer** — Select a clip, drag handles to trim start/end. Updates the composition. Preview updates in real time.
- [ ] **Clip reorder** — Drag clips in sequence to rearrange. Same as storyboard but with trim-aware durations.
- [ ] **Text overlay editor** — Add text to any point in the reel. Font selection (5-8 fonts), size, color, position (top/center/bottom), animation (fade in, pop, none). Duration (start/end time). This is critical for reels — most viral reels have on-screen text.
- [ ] **Auto-captions** — Generate word-by-word captions from the voiceover (using Whisper or similar). Style presets (TikTok-style highlight, minimal, bold). Toggle on/off.
- [ ] **Transition presets** — Between clips: cut (default), crossfade, swipe. Three options only. No custom transitions.
- [ ] **Preview playback** — Full preview of the composed reel with all layers (video + audio + text + captions). Play, pause, scrub. Must be snappy — no waiting for server render during preview.
- [ ] **Re-render** — After edits, user clicks "Render Final" to produce updated mp4 server-side. Same async flow as Phase 4 assembly.
- [ ] **Acceptance criteria:** User can trim clips, add text overlays, apply transitions, preview the result, and render a polished reel — all without leaving the browser.

### 5B: Precision Editing Tab (build second)

This is for power users who want frame-level control. Separate tab within the editor.

- [ ] **Multi-track timeline** — Visual timeline with separate tracks for: video clips, voiceover audio, music audio, text overlays, captions. Zoomable. Scrollable. Time ruler with frame markers.
- [ ] **Frame-accurate scrubbing** — Drag the playhead to any frame. Preview updates instantly. Show current timecode.
- [ ] **Split/cut tool** — Click on a clip at the playhead position to split it into two segments. Delete either segment. This is the "precision cutting" the user asked for.
- [ ] **Bring-in tool** — Import additional clips or audio into the timeline at a specific point. Drag from asset panel into a track at the desired position.
- [ ] **Per-track volume/opacity** — Adjust volume for voiceover and music tracks independently at any point (keyframe-based). Adjust opacity for video clips (for transitions).
- [ ] **Snap-to-grid / snap-to-beat** — Clips snap to beat markers if music track is present. Snap to other clip edges. Makes timing easier.
- [ ] **Keyboard shortcuts** — Space (play/pause), J/K/L (shuttle), I/O (mark in/out), S (split at playhead), Delete (remove selected), Cmd+Z (undo). Non-negotiable for a precision editor.
- [ ] **Undo/redo** — Full undo stack for all timeline operations. At least 50 levels.
- [ ] **Acceptance criteria:** User can perform frame-accurate edits, split clips, adjust per-track volume, and navigate the timeline with keyboard shortcuts — at the level of a basic NLE (non-linear editor).

### Out of Scope for Phase 5

- Multi-camera editing
- Color correction / LUTs
- Audio effects (reverb, EQ)
- Motion tracking
- Chroma key
- Plugin system

---

## Phase 6: Metadata and Export

**User problem:** Reel is edited and ready. User needs hashtags, a description, a thumbnail, and a way to get the file out — either download or direct post.

**Depends on:** Phase 5A at minimum (rendered final video exists). Phase 5B is NOT required for Phase 6.

### Core Features

- [ ] **AI hashtag generation**
  - Based on script content, niche, and trending audio data
  - Generate 20-30 hashtags, user selects/deselects
  - Mix of high-volume and niche-specific tags
  - Backend: `POST /api/metadata/hashtags` accepts content context, returns ranked list
  - **Acceptance criteria:** User gets relevant hashtag suggestions and can customize the set.

- [ ] **AI description generation**
  - Based on script + hook + caption from Phase 2
  - Instagram-optimized: hook line, value body, CTA, line breaks, emoji usage
  - User can edit the generated description inline
  - **Acceptance criteria:** User gets a ready-to-post description they can tweak.

- [ ] **Thumbnail generation**
  - Option 1: Auto-extract best frame from the rendered video (detect highest visual interest frame)
  - Option 2: AI-generated thumbnail from prompt (using same video gen provider)
  - Option 3: User uploads custom thumbnail
  - Thumbnail saved to R2, linked via `generated_content.thumbnailR2Key`
  - **Acceptance criteria:** User has a thumbnail attached to their reel before export.

- [ ] **Export: Download**
  - Download final mp4 to device
  - Download thumbnail separately
  - Copy hashtags + description to clipboard
  - **Acceptance criteria:** User can download everything they need to post manually on Instagram.

- [ ] **Export: Direct to Queue**
  - One-click "Send to Queue" packages: video file, thumbnail, description, hashtags into a queue item
  - Queue item displays video preview (not just text cards like today)
  - Scheduling flow uses the existing queue infrastructure
  - **Acceptance criteria:** User's finished reel appears in the Queue tab with video preview, description, and hashtags — ready to schedule.

- [ ] **Export: Direct Instagram Post (stretch)**
  - Uses Instagram Graph API via connected `instagram_page`
  - Posts reel with description + hashtags
  - Updates queue item status to "posted"
  - **This is stretch.** Instagram API approval is a separate process. Build the queue flow first.

### Out of Scope for Phase 6

- Cross-platform posting (TikTok, YouTube Shorts)
- Analytics on posted content
- A/B testing thumbnails
- SEO optimization beyond hashtags

---

## Build Order (What Ships When)

This is the critical path. Each item unblocks the next.

### Sprint 1: Asset Infrastructure
1. `reel_asset` table migration + asset CRUD API
2. User file upload endpoint (video + image + audio)
3. Cost tracking extension for TTS/music/video gen

**Why first:** Every subsequent phase depends on storing and retrieving binary assets. Without this, nothing works.

### Sprint 2: TTS Voiceover
4. ElevenLabs integration (provider abstraction + API call)
5. Voice selection UI (presets only)
6. "Generate Voiceover" flow from script
7. Inline audio player in Generate workspace

**Why second:** Audio is the minimum viable addition to text-only output. A script + voiceover is already more useful than a script alone.

### Sprint 3: Music Library
8. Admin audio upload + categorization UI
9. User-facing music browser with preview
10. Attach music track to content

**Why third:** Background music completes the audio layer. Without it, Phase 4 assembly produces a voiceover-only reel, which feels incomplete.

### Sprint 4: Video Clips + Storyboard
11. AI video clip generation (Runway/Kling integration)
12. User video/image upload with drag-and-drop
13. Storyboard UI (shot sequence, clip assignment, reorder)

**Why fourth:** Visual assets need audio to exist first so the storyboard can show the full picture.

### Sprint 5: Assembly
14. Server-side Remotion/FFmpeg assembly service
15. Async render job queue
16. "Assemble Reel" one-click flow
17. Assembled video preview player

**Why fifth:** This is the first moment the user sees a real reel. It is the "magic moment" of the product. Everything before this is preparation.

### Sprint 6: Quick Edit
18. Clip trimmer
19. Text overlay editor
20. Transition presets
21. Client-side preview playback
22. Re-render flow

**Why sixth:** The rough cut needs polish. Most users will stop here and be satisfied.

### Sprint 7: Precision Editing
23. Multi-track timeline
24. Split/cut tool
25. Frame-accurate scrubbing
26. Keyboard shortcuts + undo/redo

**Why seventh:** Power users need this, but it is not a blocker for the majority. Ship quick edit first, learn from usage, then build precision.

### Sprint 8: Metadata + Export
27. AI hashtag generation
28. AI description generation
29. Thumbnail selection (auto-frame + upload)
30. Download flow
31. Queue integration with video preview

**Why last:** Metadata is the final step before publishing. It has zero value without a finished video.

---

## Key Technical Decisions Needed Before Building

| Decision | Options | Recommendation | Why |
|----------|---------|---------------|-----|
| TTS provider | ElevenLabs, OpenAI TTS, Play.ht | ElevenLabs | Best short-form voice quality, reasonable API, good latency |
| Video generation provider | Kling via fal.ai (default), Runway Gen-3 (premium), Image+Ken Burns (budget) | **Tiered — see below** | Provider abstraction built-in; swap without backend changes |
| Server-side rendering | Remotion, FFmpeg subprocess, cloud render service | Remotion | React-based (team knows React), programmatic composition, runs on server |
| Client-side preview | Remotion Player, custom Canvas + Web Audio | Remotion Player | Consistent with server render engine, less custom code |
| Music generation (stretch) | Suno, Udio, skip it | Skip for now | System library is sufficient. Music gen APIs are unstable and expensive. Revisit after launch. |
| Composition data model | Extend `generatedMetadata` JSONB, new `reel_composition` table | New table | Compositions will be large and versioned. Separate table keeps `generated_content` clean. |

---

## Video Generation Provider Tiers

All three providers are implemented behind a single `VideoGenerationProvider` interface. The active provider is set via `VIDEO_GENERATION_PROVIDER` env var. Users can be offered a tier choice in-product.

### Cost Comparison (per 5-second clip, 12 clips = 60s reel)

| Provider | Config | Cost/sec | Cost per clip (5s) | Full reel (12 clips) |
|----------|--------|----------|--------------------|----------------------|
| **Image + Ken Burns** | `image-ken-burns` | ~$0.001/sec | **~$0.006** (1 FLUX image) | **~$0.07** |
| **Kling 3.0 via fal.ai** | `kling-fal` | ~$0.029/sec | **~$0.15** | **~$1.74** |
| **Runway Gen-3 Turbo** | `runway` | ~$0.05/sec | **~$0.25** | **~$3.00** |
| **Runway Gen-3 Alpha** | `runway-alpha` | ~$0.10/sec | **~$0.50** | **~$6.00** |

### Provider Descriptions

**`image-ken-burns` (Budget — default for free tier)**
- Generates a static image via FLUX Schnell (fal.ai), then animates it with a Ken Burns (slow zoom/pan) effect using FFmpeg
- No AI video generation cost — just image gen ($0.003–0.006/image)
- Looks great for text-heavy content, quotes, talking heads over backgrounds
- Not suitable for motion-heavy scenes

**`kling-fal` (Standard — default for paid tier)**
- Kling 3.0 via fal.ai gateway. Best price-to-quality ratio for short-form clips.
- 42% cheaper than Runway Turbo with comparable quality for 3-5s clips
- fal.ai provides queuing, retries, and CDN delivery out of the box

**`runway` (Premium — upgrade path)**
- Runway Gen-3 Alpha Turbo. Best motion quality, most photorealistic.
- Use this as an optional upgrade when users want higher visual fidelity
- All API calls go through the same interface — zero code changes to enable

### Environment Variables Added

```
VIDEO_GENERATION_PROVIDER=kling-fal   # kling-fal | runway | image-ken-burns
FAL_API_KEY=...                        # Used by kling-fal and image-ken-burns
RUNWAY_API_KEY=...                     # Used by runway
FLUX_MODEL=fal-ai/flux/schnell        # Image model for image-ken-burns mode
KLING_MODEL=fal-ai/kling-video/v2.1/standard/text-to-video  # Kling model endpoint
```

### Implementation

The provider abstraction lives at:
`backend/src/services/media/video-generation/`

```
├── types.ts           # VideoGenerationProvider interface + shared types
├── index.ts           # Factory: getVideoGenerationProvider(), default export
└── providers/
    ├── kling-fal.ts   # Kling 3.0 via fal.ai
    ├── runway.ts      # Runway Gen-3 Alpha / Turbo
    └── image-ken-burns.ts  # FLUX image + FFmpeg Ken Burns animation
```

Cost tracking reuses `aiCostLedger` table via a new `recordMediaCost()` helper that accepts a flat USD amount instead of token counts.

---

## What is Explicitly Cut

These items from the main TODO.md do NOT get worked on until the above is fully shipped:

- Multiple reel selection in single message
- AI model selection (per-request model choice)
- Visual grid layout with thumbnail previews in queue (replaced by video preview in Phase 6)
- Inline editing in queue
- Calendar view for scheduled content
- Batch scheduling
- Advanced union-based trending in Discover
- Audio library integration (Epidemic Sound) — we build our own library instead
- Audio-based recommendation system
- Content moderation tools
- A/B testing framework
- Scraping analytics
- Database optimization for large datasets
- Search indexing
- TypeScript strict mode
- Code documentation
- CI/CD pipeline

None of these move the needle on reel creation. They are maintenance or polish tasks that can wait.
