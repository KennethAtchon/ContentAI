# Chat-Guided Reel Creation

**Status:** Implementation in progress
**Scope:** Chat AI tools for voiceover, music, and guided reel workflow

---

## Problem

The chat AI can write scripts and captions but stops there. The user has to leave the chat panel, figure out what to do next, manually trigger voiceover from a separate tab, browse the music library themselves, then navigate to the video workspace to generate the reel. There is no guidance, no continuity, and no AI involvement in the media layer.

**Result:** Users don't know what step to do next. The product feels like a script generator, not a reel creation tool.

---

## What We're Building

Make the chat AI a full reel creation guide. It knows the pipeline, it holds the user's hand through every step, and it can perform the audio operations itself (voiceover + music) — not just talk about them.

### The Reel Pipeline (ordered)

```
1. CONTENT      → hook, script, clean script, caption, hashtags, CTA
2. VOICEOVER    → pick a voice, generate TTS from the clean script
3. MUSIC        → search library, attach a track by mood/genre
4. VIDEO        → user opens Video tab, clicks Generate (AI cannot trigger this directly)
5. ASSEMBLE     → mix voiceover + music + clips, choose volumes (Video tab)
6. PUBLISH      → schedule in the queue
```

Steps 1–3 are fully AI-executable from chat. Steps 4–5 require the user to be in the Video workspace. Step 6 the AI can trigger via `update_content_status`.

---

## New Chat Tools

### `list_voices`
Returns all available TTS voices so the AI can recommend one by name.

```
Input:  none
Output: [{ id, name, description, gender }]
```

**When to call:** Before `generate_voiceover`, or when the user asks "what voices do you have?" / "which voice should I use?"

---

### `generate_voiceover`
Generates a TTS voiceover from the content's clean script and attaches it to the draft.

```
Input:
  contentId:  number   — the draft to generate audio for
  voiceId:    string   — one of the IDs from list_voices
  speed:      "slow" | "normal" | "fast"

Output:
  { success: true, assetId, durationMs }
  { success: false, reason: "no_clean_script" | "voice_not_found" | "tts_error" }
```

**Internals:** Calls the ElevenLabs TTS service, uploads MP3 to R2, writes a `reelAsset` row (type = "voiceover"), denormalizes `voiceoverUrl` onto `generatedContent`.

**When to call:** After content is written and the user confirms they want a voiceover (or when the AI has completed content and is guiding through the pipeline).

---

### `search_music`
Searches the music library by mood or keyword, returning tracks the AI can recommend.

```
Input:
  mood?:     "energetic" | "calm" | "dramatic" | "funny" | "inspiring"
  search?:   string   — keyword in track name or artist
  limit?:    number   — default 5, max 20

Output:
  { tracks: [{ id, name, artistName, durationSeconds, mood, genre }] }
```

**When to call:** When the user asks about music, or after voiceover is done and the AI is guiding to the next step.

---

### `attach_music`
Attaches a music track from the library to a draft. Replaces any existing music.

```
Input:
  contentId:    number   — the draft
  musicTrackId: string   — track ID from search_music

Output:
  { success: true, trackName, artistName }
  { success: false, reason: "track_not_found" | "content_not_found" | "db_error" }
```

**When to call:** After the user selects or approves a music track recommendation.

---

## Guided Workflow Behaviour

### After `save_content`
The AI must not just say "done!" It should ask a leading question to move the pipeline forward:

> "Script is saved. Do you want me to generate the voiceover now? I can pick a voice based on your content style, or you can choose one. Just say go and I'll handle it."

### After `generate_voiceover`
The AI should immediately pivot to music:

> "Voiceover is done — sounds great for this style of content. Want me to find some background music? I'm thinking something [energetic/calm/dramatic] to match the energy of the script."

### After `attach_music`
The AI should guide to the video tab:

> "Music attached. You're ready to generate the reel — head to the **Video** tab and hit **Generate Reel**. The AI will create shot-by-shot clips from your scene description. Come back here if you want to regenerate any shots or adjust the mix."

### Leading Questions (cold start / new user)
When a user sends a vague first message ("help me make a reel", "I want to go viral"), the AI should ask a scoped set of questions before generating anything:

1. **Niche:** "What's the topic — fitness, finance, cooking, something else?"
2. **Format:** "Do you have a reel you want to remix, or should I generate something from scratch?"
3. **Voice:** "Will this be a talking-head (you on camera) or voiceover only?"
4. **Length:** "How long — 15, 30, or 60 seconds?"
5. **Goal:** "What do you want viewers to do after watching — follow, comment, save, visit a link?"

Don't ask all five at once. Ask 1–2, get an answer, then ask the next.

---

## System Prompt Changes

The `chat-generate.txt` system prompt is updated to include:

1. **Pipeline awareness** — the AI knows all 6 pipeline steps and where each tool fits
2. **Tool rules** for the 4 new tools (list_voices, generate_voiceover, search_music, attach_music)
3. **Guidance behaviour** — the AI is instructed to always offer the next step after completing any stage
4. **Leading questions** — the AI is instructed to gather context before generating (but keep it conversational, not an interrogation)
5. **Video tab handoff** — the AI explicitly tells the user to go to the Video tab for generation and assembly, since those are long-running jobs the frontend manages

---

## What the AI Cannot Do (Frontend Only)

| Operation | Why |
|---|---|
| Trigger video generation (`POST /api/video/reel`) | Long-running async job, managed by Video workspace UI |
| Regenerate individual shots | Requires visual storyboard interaction |
| Adjust voiceover/music volume mix | Numeric sliders in Video workspace |
| Assemble final reel | Requires selecting which shots to keep |
| Schedule to Instagram | Requires account connection + date picker |

The AI's job is to complete steps 1–3 (content + voiceover + music) and then hand off clearly to the Video tab for steps 4–5.

---

## Implementation Notes

- **`generate_voiceover` is synchronous** — TTS takes 2–8s. The AI call blocks until complete. This is acceptable since the user expects to wait for audio.
- **Music search queries the DB directly** — no HTTP round-trip needed; the music library is in the same DB.
- **`list_voices` is a static return** — reads from `VOICES` config array, no DB call.
- **Voice recommendation heuristic** — the AI should look at `outputType` and content tone to suggest a voice. Lifestyle/wellness → Jessica. Education/business → Marcus or James. Motivational/fitness → Laura. Storytelling → Nova.
