# TODO

## Caption Track Empty on Editor Sync

**Status:** Not started  
**Area:** Backend — editor init / draft sync flow  
**Files:** `backend/src/domain/editor/timeline/ai-assembly-tracks.ts`

### Problem

When a generated draft is sent to the editor (via `POST /:id/ai-assemble` or the standard preset fallback), the `"text"` (caption) track is always initialized with `clips: []`. The voiceover asset is correctly placed on the audio track, but no captions are generated or attached.

The current pattern dumps raw AI-generated script text (hook, scriptNotes) into the `generated_content` table — that text has no timing data and cannot be used as subtitle captions. The caption system requires word-level `startMs`/`endMs` tokens (from Whisper) to function.

### Correct Fix

All infrastructure is already built. The sync flow just needs to wire it together:

1. **Transcribe the voiceover asset** — after the voiceover asset is ready, call `CaptionsService.transcribeAsset(userId, voiceoverAssetId)`. This hits the OpenAI Whisper API and creates a `CaptionDoc` row with word-level tokens.

2. **Add a `CaptionClip` to the text track** — using the returned `captionDocId`, construct a `CaptionClip` spanning the full voiceover duration (`startMs: 0`, `sourceStartMs: 0`, `sourceEndMs: voiceover.durationMs`) with a default `stylePresetId` (e.g. `"hormozi"`) and push it into the `"text"` track clips array.

### What Already Exists (no new infra needed)

| Piece | Location |
|-------|---------|
| Whisper transcription | `CaptionsService.transcribeAsset()` in `backend/src/domain/editor/captions.service.ts` |
| CaptionDoc storage | `caption_doc` table via `CaptionsRepository` |
| CaptionClip type | `CaptionClip` in `backend/src/types/timeline.types.ts` |
| Caption presets | `caption_preset` table — `"hormozi"` is a safe default |
| Text track slot | `"text"` track already created in both `convertAIResponseToTracks()` and `buildStandardPresetTracks()` |

### Deferred Until

Implement as part of the verbose draft→editor sync system. Do not patch `ai-assembly-tracks.ts` in isolation — the transcription trigger belongs in the sync/init layer, not the track-builder.
