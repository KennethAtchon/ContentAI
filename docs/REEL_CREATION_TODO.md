# Reel Creation Pipeline — Focused Roadmap

**Last updated:** 2026-03-15
**Mandate:** Everything below serves one goal — a user goes from script to finished reel inside ContentAI. Nothing else gets built until this is fully shipped.

**Design philosophy:** The AI does everything by default. A user can go from script to exported, publishable reel without touching a single editing control. Every editing surface in Phase 5 is an optional override for users who want control — not a required step. Build AI-native first. Add editing like CapCut does second.

---

## What Already Exists

These are done and not revisited:

- Phase 1 (Analysis): AI reel breakdown — hook patterns, emotional triggers, format patterns, engagement drivers, replicability score. Complete.
- Phase 2 (Script Generation): AI chat with streaming, project/session management, reel referencing, script/hook/caption generation, content versioning, export to queue. Complete.
- Phase 3 (Audio Production) — **Complete**: TTS voiceover generation, music library + attach, reel_asset schema; final product = voiceover + optional background URL attached to generated content. Full implementation shipped with all UI components, API endpoints, and database schema. Full spec: `docs/specs/PHASE3_AUDIO_PRODUCTION.md`.
- R2 storage service: Upload, delete, signed URLs, upload-from-URL. Works for files and buffers. Ready to use for audio/video assets.
- Database: `generated_content` table has `videoR2Url`, `thumbnailR2Key`, `generatedMetadata` (JSONB) fields already. These are empty but wired.
- Trending audio data: `trending_audio` table populated by scraping. Audio metadata (name, artist, use count) exists. No playback or selection UI.
- **Video production system (partial, actively implemented)** — Implemented: `backend/src/services/media/video-generation/` (Kling fal, Runway, image-ken-burns), Phase 4 video routes (`POST /api/video/reel`, shot regenerate, assemble, job status/retry), Redis-backed render jobs, `POST /api/assets/upload` for video/image, and FFmpeg baseline assembly (concat + audio mix + script-based caption burn + R2 output). **Still pending:** storyboard-rich frontend, advanced retry UX, and advanced caption pipeline parity (Whisper word-level timing + CapCut-style controls). See `docs/PHASE4_IMPLEMENTATION_TODO.md` for current checklist status.

---

## Phase 3: Audio Production — ✅ Complete

**User problem:** User has a script but no audio. They need a voiceover track and optionally a background music track to make a reel. Without audio, there is no reel.

**Final product of Phase 3:** Voiceover(s) and optionally a background music track are attached to the generated content as `reel_asset` rows (with `r2Key` and resolvable playback URLs). Phase 4 consumes these for assembly. Full spec: `docs/specs/PHASE3_AUDIO_PRODUCTION.md`.

**This is the hardest infrastructure phase.** It introduces external AI services (TTS, music generation) and binary asset management for the first time.

### Prerequisites (build first)

- [x] **Asset storage schema migration** — Add `reel_asset` table to track individual assets per generated content:
  ```
  reel_asset { id, generatedContentId, userId, type ("voiceover" | "music" | "video_clip" | "image"),
               r2Key, r2Url, durationMs, metadata (jsonb), createdAt }
  ```
  This replaces jamming everything into `generated_content` columns. Every audio/video artifact gets its own row. The editing suite in Phase 5 needs this structure.
- [x] **Asset upload/download API** — `POST /api/assets/upload`, `GET /api/assets/:id/url` (signed URL), `DELETE /api/assets/:id`. Scoped to user. Uses existing R2 service.
- [x] **TTS provider integration** — ElevenLabs integrated with provider abstraction interface for future swapping.
- [x] **Cost tracking for audio generation** — Extended `ai_cost_ledger` to track TTS and music generation costs per user. Added `featureType: "tts" | "music_gen"`.

### Core Features

- [x] **TTS voiceover generation**
  - User selects a script (from chat or queue) and triggers "Generate Voiceover"
  - Voice selection: 3-5 preset voices to start (name + short preview). No custom voice cloning in v1.
  - Speed/tone controls: normal, slow, fast. That is it. No pitch sliders.
  - Backend: `POST /api/audio/tts` accepts `{ generatedContentId, text, voiceId, speed }`, calls ElevenLabs, uploads result to R2, creates `reel_asset` row linked to that content, returns signed URL.
  - Frontend: inline audio player in the chat/generation panel. Play, pause, download.
  - **Acceptance criteria:** User generates a voiceover from script text, hears it, and it is saved as an asset linked to their generated content.

- [x] **Music track selection (system library)**
  - Admin uploads curated royalty-free music tracks via admin portal
  - Tracks categorized by: mood (energetic, calm, dramatic, funny), duration bucket (15s, 30s, 60s), genre
  - User browses library, previews tracks, selects one
  - Selected track saved as asset reference (not duplicated per user)
  - **Acceptance criteria:** User can browse, preview, and attach a music track to their content.

- [x] **AI music generation (stretch — build AFTER library)**
  - Integration with Suno or Udio API for custom background tracks
  - User provides mood/genre prompt, AI generates a 15-30s track
  - **This is a stretch goal for Phase 3.** The system library is sufficient for MVP. Only build this if the library feels limiting in user testing.

- [x] **Audio preview and management UI**
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

**Current status:** MVP baseline complete (core generation, storyboard, assembly, and preview/export loops are implemented).  
Use `docs/PHASE4_IMPLEMENTATION_TODO.md` for remaining post-MVP hardening items and `docs/PHASE4_MVP_WORKING_GUIDE.md` for day-to-day operation guidance.

**User problem:** User has script + audio but no visuals. They need video clips (AI-generated or uploaded) assembled into a reel with their audio track.

**Depends on:** Phase 3 complete (audio assets exist and are manageable).

**Detailed implementation package (Phase 4):**

- `docs/specs/PHASE4_VIDEO_PRODUCTION_MVP.md`
- `docs/specs/PHASE4_TECHNICAL_DESIGN.md`
- `docs/specs/PHASE4_API_AND_FLOW_CONTRACTS.md`
- `docs/specs/PHASE4_TEST_AND_RELEASE_CRITERIA.md`
- **Implementation checklist:** `docs/PHASE4_IMPLEMENTATION_TODO.md`

### Prerequisites

- [ ] **Video generation provider integration** — Pick ONE for AI video. Recommendation: Runway Gen-3 or Kling for short clips (3-5s each). Abstract behind provider interface. These are expensive — usage limits matter here.
- [ ] **User file upload flow** — `POST /api/assets/upload` must handle video files (mp4, mov) and images (jpg, png) up to a size limit (100MB for video, 10MB for images). Validate file type server-side. Upload to R2 with progress indication on frontend.
- [ ] **FFmpeg or Remotion backend service** — For server-side video assembly. Recommendation: Remotion (React-based, runs on server, produces mp4). Alternative: FFmpeg via subprocess. Decision: Remotion for v1 because it gives us programmatic composition and we are already a React shop. If latency is unacceptable, fall back to FFmpeg.
- [ ] **Assembly job queue** — Video rendering is slow (30s-2min). Needs async job processing. Extend the existing `QueueService` pattern or use a dedicated worker. Job states: queued, rendering, completed, failed. User polls for status.

### Core Features

- [ ] **AI full-reel auto-generation (primary path)**
  - "Generate Reel" is the primary CTA. The AI takes the script's shot list (Phase 2 already generates shot breakdowns), generates a video clip for every shot using the active provider, and queues them all in parallel.
  - No user action required between "Generate Reel" and seeing the assembled output — the AI handles clip generation, ordering, audio overlay, captions, and assembly end-to-end.
  - User is shown a progress screen (e.g. "Generating clip 3 of 8…") while the job runs.
  - **Acceptance criteria:** User clicks "Generate Reel" and receives a complete, watchable mp4 without touching any other control.

- [ ] **AI video clip generation (per-shot override)**
  - From the storyboard view, user can regenerate a single shot's clip if they dislike the AI-chosen one.
  - Prompt is pre-filled from the shot description. User can edit before regenerating.
  - Result replaces the existing clip and triggers a re-assemble.
  - **Acceptance criteria:** User can swap out one AI clip without re-generating the whole reel.

- [ ] **User video/image upload (manual override)**
  - Drag-and-drop or file picker on any individual shot in the storyboard
  - Upload progress bar
  - Uploaded files saved as `reel_asset`, replace the AI-generated clip for that shot
  - Image uploads auto-converted to 3-5s video clips (Ken Burns effect or static) during assembly
  - **Acceptance criteria:** User can substitute their own footage for any AI clip.

- [ ] **Storyboard/shot list UI (escape hatch for manual control)**
  - Visual representation of the reel as a sequence of shots, shown after AI auto-generation completes
  - Each shot shows: thumbnail, duration, description, assigned clip
  - Drag to reorder shots; add/remove shots
  - This is NOT the full timeline editor (Phase 5). This is a simplified card-based sequence view for users who want to adjust the AI's choices.
  - **Acceptance criteria:** User can inspect the AI-assembled shot sequence and make per-shot adjustments if desired.

- [ ] **AI auto-captions (generated during assembly)**
  - During assembly, the AI generates word-by-word captions from the voiceover using Whisper or equivalent
  - Default style applied automatically (TikTok-style highlight). Toggle on/off before assembly; style tweak available in Phase 5.
  - Stored in the composition as a text track; burned into the video during render
  - **Acceptance criteria:** Assembled reel has on-screen captions by default with no user action required.
- [ ] **Automatic caption tool (variable sizes, CapCut-style)**
  - Automatic caption tool that places captions on the video in various sizes (word-by-word or phrase-level). We will research how editors like CapCut implement caption placement and sizing and align our behavior with that pattern.
  - **Acceptance criteria:** User gets auto-generated captions with size/placement that feel familiar from tools like CapCut; no manual positioning required for default output.

- [ ] **One-click assembly**
  - "Assemble Reel" (also triggered automatically at end of AI auto-generation) stitches clips in sequence, overlays voiceover, mixes music at the volume ratio from Phase 3, and burns in captions
  - Output saved as `reel_asset` with type "assembled_video" and linked to `generated_content.videoR2Url`
  - Renders asynchronously. User sees progress and gets notified when done.
  - Result plays in an inline video player with a direct download/export option visible immediately
  - **Acceptance criteria:** User gets a watchable, downloadable mp4 reel with audio and captions. No editing required to proceed to export.

### Out of Scope for Phase 4

- Clip trimming / cut points (Phase 5)
- Custom text overlays beyond auto-captions (Phase 5)
- Caption style editing (Phase 5)
- Color grading
- Green screen / background removal
- Multi-track video compositing

---

## Phase 5: In-Browser Editing Suite

**User problem:** The AI-assembled reel from Phase 4 is publishable as-is. Phase 5 is for users who want manual control — trimming clips, adjusting timing, adding custom text overlays, and fine-tuning without leaving the browser. Two modes: quick fixes for most users, precision control for power users.

**This phase is optional from the user's perspective.** The assembled reel can go straight to export. Phase 5 is an editing layer on top of an already-complete product — not a required step between assembly and publishing.

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
- [ ] **Text overlay editor** — Add custom text to any point in the reel. Font selection (5-8 fonts), size, color, position (top/center/bottom), animation (fade in, pop, none). Duration (start/end time).
- [ ] **Caption style editor** — AI already generated captions in Phase 4. This lets users edit the text, adjust style presets (TikTok-style highlight, minimal, bold), reposition, or turn them off. No re-transcription needed.
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

**User problem:** Reel is assembled and ready. User needs hashtags, a description, a thumbnail, and a way to get the file out — either download or direct post. This can happen immediately after Phase 4 assembly; Phase 5 editing is not required.

**Depends on:** Phase 4 complete (assembled video exists). Phase 5 is NOT required for export.

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

### Sprint 5: Assembly + AI Auto-Generation
14. Server-side Remotion/FFmpeg assembly service
15. Async render job queue
16. AI full-reel auto-generation flow (all shots in parallel → auto-assemble)
17. AI auto-captions via Whisper during assembly
18. Assembled video preview player with immediate download option

**Why fifth:** This is the first moment the user sees a complete, AI-built reel. It is the "magic moment" of the product and the point where the AI-native value is proven. Everything before this is preparation.

### Sprint 6: Metadata + Export
19. AI hashtag generation
20. AI description generation
21. Thumbnail selection (auto-frame + upload)
22. Download flow
23. Queue integration with video preview

**Why sixth:** Export must ship immediately after assembly. A user who gets a finished AI reel should be able to download and post it without waiting for the editing suite. This also validates the end-to-end flow before investing in complex editing infrastructure.

### Sprint 7: Quick Edit
24. Clip trimmer
25. Caption style editor
26. Custom text overlay editor
27. Transition presets
28. Client-side preview playback
29. Re-render flow

**Why seventh:** The AI reel is already publishable. Quick edit is an optional enhancement for users who want to refine. Ship and learn from usage before investing in precision editing.

### Sprint 8: Precision Editing
30. Multi-track timeline
31. Split/cut tool
32. Frame-accurate scrubbing
33. Keyboard shortcuts + undo/redo

**Why last:** Power users need this, but it is not a blocker for the majority or for export. Ship everything else first.

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
