# 05 -- Assembly System: Shot Assembly and AI Assembly

**Priority:** Phase 4 (after Captions)
**Effort:** Large (4-5 weeks)
**Dependencies:** Project Model (Phase 1), Editor Core (Phase 2)

---

## User Problem

ContentAI has two separate systems for turning shots into a final reel:

1. **Pipeline assembly** (`/api/video/assemble`) -- a backend job that takes all video clips for a generated content, concatenates them with voiceover and music using ffmpeg, and produces an `assembled_video` asset. This is a black box. The user clicks "Assemble" and gets a final video with no control over shot order, timing, or audio mix.

2. **Editor assembly** -- the manual timeline editor where users can arrange clips, trim, and export. This is fully manual. The user starts from scratch.

These two systems do not talk to each other. The pipeline produces a one-shot result with no iteration. The editor produces a custom result but requires rebuilding everything manually. The user wants something in between: the pipeline's convenience with the editor's control.

The Assembly System bridges this gap. It replaces the pipeline's black-box assembly with an editor-integrated workflow where shots land on the timeline in the right order and the user can refine from there.

---

## User Stories

- As a creator, I want my generated video clips to automatically appear on the editor timeline in the correct shot order so that I start with a rough cut instead of a blank canvas.
- As a creator, I want to reorder shots by dragging them on the timeline so that I can change the narrative flow.
- As a creator, I want to swap a single shot (regenerate just one clip) without losing the rest of my edit so that I can fix weak shots.
- As a creator, I want AI to assemble my shots into a polished reel automatically so that I can get a good result without manual editing.

---

## Current Architecture (What Exists)

### Pipeline Assembly (`/api/video/assemble`)

The existing `useAssembleReel` hook calls `POST /api/video/assemble` with:
- `generatedContentId` -- which content to assemble
- `includeCaptions` -- whether to burn in captions (currently uses basic `drawtext`)
- `audioMix` -- volume levels for clip audio, voiceover, music

The backend:
1. Fetches all `video_clip` assets for the content, ordered by `shotIndex`
2. Downloads each clip from R2
3. Runs ffmpeg to concatenate, mix audio, and optionally add text
4. Uploads the result as an `assembled_video` asset

This produces a single, final video. There is no intermediate representation. The "timeline" is implicit (shots in order, no gaps).

### Editor Export (`/api/editor/:id/export`)

The editor export does almost the same thing as pipeline assembly, but from a user-defined timeline:
1. Reads the `tracks` JSONB from the editor project
2. Downloads clips from R2
3. Runs ffmpeg with a filtergraph matching the timeline layout
4. Uploads the result

The two systems share the same tooling (ffmpeg, R2) but have zero shared code.

---

## The Plan: Unified Assembly

### Step 1: Make Pipeline Assembly Create an Editor Project

**Instead of producing a final video, pipeline assembly now creates an editor project with a pre-populated timeline.**

When the user clicks "Assemble" in the queue:
1. Backend receives `POST /api/video/assemble`
2. Instead of immediately running ffmpeg, it creates an editor project (via the same logic as Phase 1's auto-initialize)
3. The editor project's timeline has all shots in order, voiceover on the audio track, music on the music track
4. The user is redirected to the editor where they can review, adjust, and then export

**This eliminates the pipeline assembly's black-box export.** The same ffmpeg pipeline that exists in the editor handles the final render. One rendering system, not two.

**Migration path:** Keep the old `POST /api/video/assemble` endpoint working but change its behavior. Instead of returning a video, it returns an editor project ID. The frontend redirects to the editor.

```typescript
// Old response:
{ jobId: string }  // video assembly job

// New response:
{ editorProjectId: string, redirect: "/studio/editor?contentId=123" }
```

The queue detail sheet updates its "Assemble" button to navigate to the editor instead of polling a job.

### Step 2: Shot Order Management

**The timeline IS the shot order.** Once shots are on the timeline, reordering means dragging clips horizontally on the video track. This already works from Phase 2 (clip dragging with snapping).

**But add a simpler reorder UI for users who do not want to use the timeline:**

Add a "Shot Order" panel (or mode) that shows a vertical list of shot thumbnails that can be drag-reordered:

```
[ Shot 1: Woman walking through city ] [drag handle]
[ Shot 2: Close-up of phone screen  ] [drag handle]
[ Shot 3: Man speaking to camera    ] [drag handle]
[ Shot 4: Product on table          ] [drag handle]
```

Reordering in this panel rearranges the clips on the video track (adjusting `startMs` so clips remain sequential with no gaps).

This is a higher-level abstraction on top of the timeline. It exists alongside the timeline, not instead of it. Users who want fine-grained control use the timeline. Users who just want to reorder shots use this panel.

**Implementation:**
- Add a "Shots" tab to the left panel (alongside Media, Effects, Audio, Text)
- Render each video track clip as a card with a thumbnail (from the asset's R2 URL) and label
- Use a drag-and-drop library (or native DnD) for reordering
- On reorder, recalculate all clip `startMs` values so clips are sequential
- Dispatch an `UPDATE_CLIP` action for each moved clip

### Step 3: Single Shot Regeneration

**Problem:** After reviewing the assembled timeline, the user decides shot 3 is weak. They want to regenerate just that shot without losing the rest of their edit.

**Current limitation:** The video generation pipeline (`POST /api/video/reel`) regenerates all shots for a piece of content. There is no per-shot regeneration.

**Actually, per-shot regeneration already exists:** The `useRegenerateShot` hook calls an endpoint that regenerates a single shot. Let me verify this.

Looking at the frontend features, there is:
- `use-regenerate-shot.ts` -- exists in `frontend/src/features/video/hooks/`

So single-shot regeneration is already supported by the backend. The missing piece is:

**Integration with the editor timeline:**
1. User right-clicks a clip on the video track -> "Regenerate this shot"
2. The editor calls the regenerate endpoint for the corresponding asset
3. When the new shot is ready (polling), the clip on the timeline is updated with the new asset's R2 URL and duration
4. The user's edit (position, trim) is preserved. Only the source media changes.

**Frontend flow:**

```typescript
// In the editor, on "Regenerate shot":
const regenerateShotInEditor = async (clipId: string) => {
  const clip = findClipById(clipId);
  if (!clip?.assetId) return;

  // Call regenerate endpoint
  const { jobId } = await authenticatedFetchJson("/api/video/shot/regenerate", {
    method: "POST",
    body: JSON.stringify({ assetId: clip.assetId }),
  });

  // Poll for completion
  // When done, fetch new asset details
  const newAsset = await pollForNewAsset(jobId);

  // Update the clip with new asset
  store.updateClip(clipId, {
    assetId: newAsset.id,
    r2Url: newAsset.mediaUrl,
    durationMs: newAsset.durationMs ?? clip.durationMs,
  });
};
```

**UI indicator:** While regeneration is in progress, show a loading spinner on the clip in the timeline and a shimmer effect on the preview.

### Step 4: Assembly Presets

Before the user opens the full editor, offer quick assembly presets:

| Preset | Description |
|--------|-------------|
| Standard | Shots in order, voiceover over full duration, music at 30% volume |
| Fast Cut | Shots trimmed to 2-3 seconds each, fast pace |
| Cinematic | 0.5s fade transitions between shots, music at 50% |
| Voiceover Focus | Shots timed to match voiceover sentence breaks |

These presets modify the initial timeline that gets created. They are one-click options shown when the user first opens the editor for a content:

```
Your reel has 5 shots, a voiceover, and background music.

[Standard]  [Fast Cut]  [Cinematic]  [Voiceover Focus]

Or start with a blank timeline.
```

**Implementation:**
- After `buildInitialTimeline()` runs, apply a preset modifier function
- `applyFastCutPreset()` trims each clip to min(clipDuration, 3000ms) and removes gaps
- `applyCinematicPreset()` adds 500ms fade transitions between each clip pair
- `applyVoiceoverFocusPreset()` uses the voiceover's word timestamps (from captions, Phase 3) to align shot cuts with sentence boundaries

The "Voiceover Focus" preset is the most interesting and depends on Phase 3 (Captions) being done. It is the bridge between assembly and AI assembly.

### Step 5: AI Assembly (Advanced)

**This is the big one. It is explicitly post-MVP. Build it only after manual assembly is working perfectly.**

**What AI assembly does:** The user clicks "AI Assemble" and the AI produces a timeline arrangement -- shot order, timing, transitions, caption placement -- that optimizes for engagement based on the content type and platform norms.

**How it works:**

1. The AI receives:
   - The script/copy for the reel
   - Metadata about each shot (duration, description from the generation prompt)
   - The voiceover word timestamps (from transcription)
   - The music BPM and key moments (if analyzable)
   - The target platform (Instagram Reels, TikTok, YouTube Shorts)

2. The AI returns a structured timeline:
```json
{
  "shotOrder": [3, 1, 4, 2, 5],
  "cuts": [
    { "shotIndex": 3, "trimStart": 0, "trimEnd": 2800, "transition": "fade" },
    { "shotIndex": 1, "trimStart": 500, "trimEnd": 3000, "transition": "cut" },
    ...
  ],
  "captionStyle": "bold-outline",
  "captionGroupSize": 3,
  "musicVolume": 0.25,
  "totalDuration": 15000
}
```

3. The system converts this structured output into a timeline (tracks + clips + transitions) and populates the editor.

4. The user reviews the AI's arrangement in the editor and makes manual adjustments.

**The AI is a starting point, not the final product.** The user always has the option to adjust everything the AI did. The editor is the correction layer.

**Why this requires manual assembly to be perfect first:**
- If the timeline rendering has bugs, the AI's output will look broken and users will blame the AI
- If clip manipulation is clunky, users cannot correct the AI's mistakes
- If export quality is poor, the AI's good arrangement still produces a bad video
- The AI assembly is only as good as the pipeline it outputs to

**Implementation approach:**

Use Claude Sonnet (the same model used for content generation) with a purpose-built prompt:

```
You are a professional short-form video editor. Given the following shots, voiceover transcript, and music, create an optimal timeline arrangement for a [platform] reel.

Rules:
- Total duration should be 15-60 seconds
- Hook the viewer in the first 1.5 seconds (strongest visual first)
- Cut on voiceover sentence boundaries when possible
- Vary shot duration (2-5 seconds) to maintain visual interest
- Place the call-to-action shot last
- Use transitions sparingly (1-2 fades max, rest are hard cuts)
- Sync dramatic moments with music beats if BPM data is available

Output a JSON object with the exact structure shown below.
```

**Endpoint:**

```
POST /api/editor/:id/ai-assemble
Body: { platform: "instagram" | "tiktok" | "youtube-shorts" }
Response: { timeline: TrackData[] }
```

The backend:
1. Loads the editor project and its assets
2. Gathers shot descriptions, voiceover transcript, music metadata
3. Sends to Claude Sonnet
4. Parses the structured response
5. Converts to the `Track[]` format
6. Returns to frontend
7. Frontend dispatches `LOAD_PROJECT` with the AI-generated tracks

**Cost:** One Claude Sonnet call per AI assembly. At ~2000 tokens input + ~500 tokens output, approximately $0.02 per assembly. Include in the subscription with a daily limit (e.g., 10/day Pro, 50/day Business).

---

## Limitations and Honest Assessment

**Pipeline assembly elimination:** Removing the old `POST /api/video/assemble` pipeline is a breaking change. Users who have automated flows (unlikely but possible) will be affected. Keep the old endpoint working for 30 days with a deprecation notice in the response headers.

**Shot metadata quality:** AI assembly quality depends on having good descriptions for each shot. If the generation pipeline only stores "shot 1", "shot 2" without descriptions, the AI has nothing to work with. The generation pipeline should be updated to store shot descriptions (e.g., "aerial shot of cityscape at sunset") alongside the video assets. This is a prerequisite.

**Music beat detection:** The "sync to beat" feature requires BPM analysis of the background music. This is doable with libraries like `essentia.js` or by calling an API, but it adds complexity. For MVP AI assembly, skip beat sync and just use even spacing. Add beat detection as a later enhancement.

**AI reliability:** Claude may occasionally produce invalid JSON or timelines that do not make sense (e.g., referencing shot indices that do not exist). The backend must validate the AI response strictly and fall back to the standard assembly preset if the AI output is invalid.

**Preview delay after AI assembly:** After the AI generates a timeline, the frontend needs to resolve R2 URLs for all clips before the preview works. This should be fast (the assets are already known) but there may be a brief loading moment.

---

## Out of Scope (Defer)

- **Music beat detection and sync** -- requires audio analysis pipeline. Defer to post-AI-assembly.
- **AI-generated transitions** (AI decides which transitions to use) -- keep transitions manual for now. AI should only decide shot order and timing.
- **AI re-editing** (user says "make this punchier" and AI adjusts the existing timeline) -- conversational editing is a long-term vision, not MVP.
- **A/B testing** (AI generates two assembly variants for comparison) -- interesting but adds UI complexity. Defer.
- **Template-based assembly** (reusable assembly patterns) -- overlaps with presets. Templates are a post-launch feature.
- **Collaborative review** (share an assembled reel for feedback before publishing) -- separate feature.

---

## Technical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Eliminating pipeline assembly breaks the queue's progress tracking | High | Update the queue's "Assembly" stage to track "editor project created" instead of "assembled_video asset created." The stage is done when an editor project exists for the content. |
| AI assembly produces unusable timelines | Medium | Strict JSON schema validation. Fall back to "Standard" preset on failure. Show the user "AI assembly could not produce a good result, using standard layout" with an option to retry. |
| Shot descriptions missing from generation pipeline | High | This is a prerequisite. Before building AI assembly, verify the generation pipeline stores meaningful shot descriptions. If not, add them. |
| Performance with many shots (10+) on the timeline | Low | 10 shots is typical. The current timeline handles this fine. At 50+ clips, consider virtualization, but that is unlikely for reels. |
| Removing the separate assembly pipeline simplifies but removes a safety net | Medium | Keep the old endpoint operational behind a feature flag for 30 days. If the editor-based assembly has issues, users can fall back. |

---

## Implementation Sequence

### Manual Assembly (Phase 4a)

1. Modify `POST /api/video/assemble` to create editor project instead of running ffmpeg directly -- 2 days
2. Update queue detail sheet with "Open in Editor" button (replaces "Assemble") -- 1 day
3. Shot Order panel (drag-reorder UI in editor left panel) -- 3 days
4. Single shot regeneration integration in editor -- 2 days
5. Assembly presets (Standard, Fast Cut, Cinematic) -- 2 days
6. Update queue progress tracking for new assembly model -- 1 day
7. Testing -- 2 days

**Phase 4a total:** ~13 working days

### AI Assembly (Phase 4b -- post-MVP)

8. Shot description storage in generation pipeline (prerequisite) -- 1 day
9. AI assembly endpoint (`POST /api/editor/:id/ai-assemble`) -- 2 days
10. AI prompt engineering and response validation -- 2 days
11. "AI Assemble" button in editor + loading state -- 1 day
12. Voiceover Focus preset (using caption timestamps) -- 2 days
13. Testing and prompt iteration -- 3 days

**Phase 4b total:** ~11 working days

**Combined total:** ~24 working days (split across two releases)
