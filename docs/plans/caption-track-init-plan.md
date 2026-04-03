# Plan: Wire Caption Track into Editor Init / AI-Assemble Flow

*Date: 2026-04-02*
*Source: `docs/TODO.md` — "Caption Track Empty on Editor Sync"*
*Scope: Backend only — `ai-assembly-tracks.ts`, `build-initial-timeline.ts`, `merge-new-assets.ts`*

---

## Problem

The `"text"` track is always initialized with `clips: []`. Voiceover assets are correctly placed on the audio track, but captions are never generated or attached — neither during `POST /editor/projects` (init) nor `POST /:id/ai-assemble`.

Caption infrastructure is complete: `CaptionsService.transcribeAsset()` hits Whisper, stores a `CaptionDoc`, and returns `captionDocId`. The missing piece is calling it at the right time and using the result to build a `CaptionClip`.

The TODO explicitly says: **transcription trigger belongs in the sync/init layer, not the track-builder**. `ai-assembly-tracks.ts` should not call the service — the callers (`buildInitialTimeline`, the ai-assemble route handler, `mergeNewAssetsIntoProject`) should handle it and pass a pre-built `CaptionClip` (or `captionDocId`) down into the track builder.

---

## Design

### Principle

Keep `ai-assembly-tracks.ts` as a pure transformer. It takes structured data in, returns `Track[]` out. Side effects (Whisper API call) happen one level up — in the route handler or service — before the track builder is called.

### Caption Clip Shape

```typescript
// CaptionClip (already defined in backend/src/types/timeline.types.ts)
{
  id: generateId(),
  type: "caption",
  startMs: 0,                          // starts at timeline position 0
  durationMs: voiceover.durationMs,    // full voiceover length
  originVoiceoverClipId: voiceoverClipId | null,
  captionDocId: string,                // returned by transcribeAsset()
  sourceStartMs: 0,
  sourceEndMs: voiceover.durationMs,
  stylePresetId: "hormozi",            // safe default
  styleOverrides: {},
  groupingMs: 800,                     // default from preset (can hardcode for now)
}
```

`trimStartMs`, `trimEndMs`, `sourceMaxDurationMs` follow the clip trim convention:
- `trimStartMs: 0`
- `trimEndMs: 0` (no unused tail)
- `sourceMaxDurationMs: voiceover.durationMs`

---

## Implementation Steps

### Step 1 — Add `captionClip` parameter to track builders

**File:** `backend/src/domain/editor/timeline/ai-assembly-tracks.ts`

Both `convertAIResponseToTracks()` and `buildStandardPresetTracks()` accept an optional `captionClip: CaptionClip | null` parameter. When non-null, push it into the `"text"` track clips array instead of leaving it empty.

```typescript
// before
export function convertAIResponseToTracks(
  aiResponse: AIAssemblyResponse,
  shotAssets: ShotAsset[],
  auxPack: AuxAssetPack,
): Track[]

// after
export function convertAIResponseToTracks(
  aiResponse: AIAssemblyResponse,
  shotAssets: ShotAsset[],
  auxPack: AuxAssetPack,
  captionClip: CaptionClip | null,
): Track[]
```

Same change for `buildStandardPresetTracks()`. Internal implementation: replace the hardcoded `{ id: "text", type: "text", clips: [] }` with `{ id: "text", type: "text", clips: captionClip ? [captionClip] : [] }`.

No other changes to this file.

---

### Step 2 — Wire transcription into the AI-assemble route

**File:** `backend/src/routes/editor/editor-ai-assembly.router.ts`

After `auxPack` is assembled and the voiceover asset is known, call `captionsService.transcribeAsset()` before building tracks. Transcription is best-effort — if it fails (Whisper error, no audio), fall through with `captionClip = null` and log a warning. Never block assembly on transcription failure.

```typescript
// locate the voiceover from auxPack
const voiceoverAsset = auxPack.voiceover ?? null;

let captionClip: CaptionClip | null = null;
if (voiceoverAsset) {
  try {
    const { captionDocId } = await captionsService.transcribeAsset(
      userId,
      voiceoverAsset.id,
    );
    captionClip = buildCaptionClip({
      captionDocId,
      voiceoverAsset,
      voiceoverClipId: null, // resolved below after track build, or pass through
    });
  } catch (err) {
    logger.warn({ err }, "Caption transcription failed during ai-assemble; continuing without captions");
  }
}

// then pass captionClip into both the AI path and the fallback path
const tracks = convertAIResponseToTracks(aiResponse, shotAssets, auxPack, captionClip);
// fallback:
const tracks = buildStandardPresetTracks(shotAssets, auxPack, captionClip);
```

`buildCaptionClip()` is a small helper in this file (or a shared util in `timeline/`). It accepts `{captionDocId, voiceoverAsset, voiceoverClipId}` and returns a fully-shaped `CaptionClip` following the trim convention above.

The `originVoiceoverClipId` can be set to `null` for now — it's a convenience link and not required for caption rendering.

---

### Step 3 — Wire transcription into `buildInitialTimeline`

**File:** `backend/src/domain/editor/build-initial-timeline.ts`

`buildInitialTimeline()` currently has no dependency on `CaptionsService`. Add it as a parameter (or inject via the service layer — match the existing pattern used in `editor.service.ts`).

After the voiceover asset is identified (already happens when building the audio track), call `transcribeAsset()` with the same best-effort try/catch pattern from Step 2.

```typescript
// after voiceover is found during asset sorting
let captionClip: CaptionClip | null = null;
if (voiceoverAsset) {
  try {
    const { captionDocId } = await captionsService.transcribeAsset(
      userId,
      voiceoverAsset.id,
    );
    captionClip = buildCaptionClip({ captionDocId, voiceoverAsset, voiceoverClipId: null });
  } catch (err) {
    logger.warn({ err }, "Caption transcription failed during buildInitialTimeline");
  }
}
```

Pass `captionClip` into `mergePlaceholdersWithRealClips()` (or wherever the `"text"` track is constructed) the same way as Step 1 — the text track clips array gets `[captionClip]` or `[]`.

If `mergePlaceholdersWithRealClips` doesn't currently accept a caption clip, add it as an optional parameter (same pattern as Step 1).

---

### Step 4 — Wire transcription into `mergeNewAssetsIntoProject`

**File:** `backend/src/domain/editor/merge-new-assets.ts`

When a new voiceover asset is detected as a "new asset" and merged into the project:

1. Call `captionsService.transcribeAsset()` (best-effort, same pattern).
2. If successful, either:
   - Create a new `CaptionClip` and add it to the `"text"` track, OR
   - Update the existing `CaptionClip` in the `"text"` track (replace `captionDocId`) if one already exists.

The existing `"text"` track clips should be inspected: if there's already a `CaptionClip` linked to a previous voiceover, replace it (delete old caption doc? — no, leave cleanup to the user). If the `"text"` track is empty, push the new `CaptionClip`.

---

### Step 5 — Extract `buildCaptionClip` helper

**File:** `backend/src/domain/editor/timeline/build-caption-clip.ts` (new file)

This avoids duplicating clip construction logic across Steps 2, 3, and 4.

```typescript
import { generateId } from "../../utils/id";
import type { CaptionClip } from "../../../types/timeline.types";
import type { AssetRow } from "../../../infrastructure/database/drizzle/schema";

export function buildCaptionClip({
  captionDocId,
  voiceoverAsset,
  voiceoverClipId,
}: {
  captionDocId: string;
  voiceoverAsset: Pick<AssetRow, "id" | "durationMs">;
  voiceoverClipId: string | null;
}): CaptionClip {
  const durationMs = voiceoverAsset.durationMs ?? 0;
  return {
    id: generateId(),
    type: "caption",
    startMs: 0,
    durationMs,
    trimStartMs: 0,
    trimEndMs: 0,
    sourceMaxDurationMs: durationMs,
    originVoiceoverClipId: voiceoverClipId,
    captionDocId,
    sourceStartMs: 0,
    sourceEndMs: durationMs,
    stylePresetId: "hormozi",
    styleOverrides: {},
    groupingMs: 800,
  };
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/domain/editor/timeline/ai-assembly-tracks.ts` | Add `captionClip: CaptionClip \| null` param to both exported functions; populate text track |
| `backend/src/domain/editor/timeline/build-caption-clip.ts` | **New** — `buildCaptionClip()` helper |
| `backend/src/routes/editor/editor-ai-assembly.router.ts` | Call `transcribeAsset()` before track build; pass clip into both AI and fallback paths |
| `backend/src/domain/editor/build-initial-timeline.ts` | Inject `captionsService`; call `transcribeAsset()`; pass clip into text track construction |
| `backend/src/domain/editor/merge-new-assets.ts` | Detect new voiceover; call `transcribeAsset()`; update text track |

No schema changes. No frontend changes. No new repositories or services.

---

## Error Handling

- Transcription failures are **non-fatal** everywhere. Caption track stays empty (`clips: []`) on Whisper errors.
- If `voiceoverAsset.durationMs` is null/0, skip transcription and leave the text track empty.
- `transcribeAsset()` already handles the "already exists" case (returns cached result), so calling it at init and again at ai-assemble is safe — second call is a cache hit.

---

## Not In Scope

- Frontend changes (caption track population is already rendered when clips exist).
- Choosing a different default `stylePresetId` — `"hormozi"` is hardcoded per the TODO.
- Setting `originVoiceoverClipId` accurately — deferred, not required for rendering.
- Deleting orphaned `CaptionDoc` rows when a voiceover is replaced.
