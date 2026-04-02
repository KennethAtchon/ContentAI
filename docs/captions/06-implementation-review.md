# Caption Implementation — Red Team Review

**Date:** 2026-04-01  
**Reviewer:** Red Team (automated + manual code inspection)  
**Scope:** All caption-related code across backend and frontend

---

## Summary

The caption implementation is largely functional but has several real bugs, security gaps, and architectural issues that will cause visible problems in production. Issues are grouped by severity.

---

## Critical Bugs (P0)

### 1. `textTransform` Not Applied in Canvas Renderer

**File:** `frontend/src/features/editor/caption/renderer.ts`

The `preset.typography.textTransform` field is stored and seeded (e.g., `"uppercase"` in the "hormozi" preset) but is never applied when drawing text to the canvas. The renderer passes `token.text` directly to `ctx.fillText()` without transformation.

```typescript
ctx.fillText(token.text, token.x, token.y); // ← never uppercased
```

**Impact:** Preview shows lowercase text for presets that define `textTransform: "uppercase"`. If the ASS exporter applies the transform separately, there's a visible preview/export mismatch.

**Fix:** Apply `token.text.toUpperCase()` (or the relevant transform) before calling `fillText`.

---

### 2. Hardcoded Preset ID Default

**File:** `frontend/src/features/editor/model/editor-reducer-clip-ops.ts`

```typescript
stylePresetId: action.presetId ?? "hormozi",
```

This hardcodes `"hormozi"` as the fallback preset ID. If the preset is renamed, deleted, or the seed changes, every new caption clip created without an explicit preset ID will silently reference a nonexistent preset. The export job will skip it without error.

**Fix:** Remove the hardcoded fallback. Require `presetId` at the call site, or load the first available preset from the store.

---

### 3. Caption Doc Silently Skipped on Export

**File:** `backend/src/domain/editor/run-export-job.ts`

```typescript
const doc = await deps.findCaptionDocByIdForUser(userId, clip.captionDocId);
if (!doc) continue; // ← silently skips
```

If a caption doc is deleted after a clip references it, the export completes successfully but the captions are absent from the output. The user receives no error.

**Fix:** Treat a missing caption doc as an export error. Return a failure response or, at minimum, emit a warning that surfaces in the job status.

---

### 4. `#RGB` Shorthand Hex Crashes ASS Exporter

**File:** `backend/src/domain/editor/export/ass-exporter.ts`

The `parseCssColor()` function only matches 6-digit hex (`#RRGGBB`):

```typescript
const hex = normalized.match(/^#([0-9a-f]{6})$/i);
```

If any preset layer color uses the 3-digit shorthand (`#FFF`, `#ABC`), the function throws:

```typescript
throw new Error(`Unsupported CSS color: ${input}`);
```

Current seed presets use full-form hex, so this is latent — but one wrong preset color crashes the entire export job.

**Fix:** Expand the regex to match `#RGB` and expand it to `#RRGGBB` before parsing.

---

## High Priority (P1)

### 5. No Rate Limiting Specific to Transcription Cost

**File:** `backend/src/routes/editor/captions.ts`

The `/transcribe` endpoint uses a generic `rateLimiter("customer")`. Whisper API calls are billed per minute of audio, so repeated calls with `force: true` on long audio files expose unbounded cost. A user could hammer this endpoint.

**Fix:** Add a stricter per-user rate limit on the transcription endpoint (e.g., 2 requests/minute, 20/hour).

---

### 6. `CaptionPresetDefinition` Type Is Too Loose

**File:** `backend/src/infrastructure/database/drizzle/schema.ts`

```typescript
export type CaptionPresetDefinition = Record<string, unknown>;
```

This type is used for preset definitions stored in the database. It eliminates all type safety when reading or writing presets — any shape will pass. Any structural change to `TextPreset` will not be caught at compile time for the DB layer.

**Fix:** Import and use `TextPreset` from the domain types file directly.

---

### 7. Missing i18n for Caption UI Strings

**Files:** `frontend/src/features/editor/caption/components/CaptionPresetPicker.tsx`, related panel components

User-visible strings are hardcoded in English:

```typescript
<div>{preset.exportMode} export, {preset.groupingMs}ms grouping</div>
<div>Some visual effects in this caption style are simplified in the exported video.</div>
```

**Fix:** Run all user-visible strings through `t('key')` and add entries to `frontend/src/translations/en.json`.

---

### 8. Preset Cache `invalidateCache()` Is Never Called

**File:** `backend/src/domain/editor/captions/preset.repository.ts`

The repository has an `invalidateCache()` method that clears the in-memory preset list cache, but it is never called anywhere in the codebase. For now presets are read-only seed data, so this doesn't bite — but if presets ever become admin-editable at runtime, cached stale data will be served indefinitely.

**Fix:** Either remove the method (acknowledging presets are static), or call it from the admin preset-update path.

---

## Medium Priority (P2)

### 9. No Caption Clip Time Range Validation in Reducer

**File:** `frontend/src/features/editor/model/editor-reducer-clip-ops.ts`

When building a `CaptionClip`, neither `sourceStartMs < sourceEndMs` nor `durationMs > 0` is checked. Zod validation catches this at the server PATCH boundary, but invalid local state can exist in the editor until autosave fires, potentially causing rendering anomalies.

**Fix:** Add a guard in the reducer before pushing the clip.

---

### 10. No Orphaned Caption Doc Cleanup

If a caption clip is removed from the timeline, its backing `caption_doc` row is not deleted. Orphaned rows accumulate indefinitely with no cleanup path.

**Fix:** Either cascade-delete on clip removal, or add a periodic cleanup job that removes caption docs not referenced by any composition.

---

### 11. No Retry or Manual Fallback for Failed Transcriptions

**File:** `frontend/src/features/editor/caption/hooks/useTranscription.ts`

When transcription fails, the raw error is surfaced with no retry mechanism and no way to manually provide or edit caption tokens. For users with non-standard audio, this is a dead end.

**Fix:** Provide a retry action in the error state, and consider a manual text-entry fallback.

---

## Test Coverage Gaps (P2)

The following are untested or undertested:

| Area | Gap |
|------|-----|
| `applyCaptionStyleOverrides()` | No unit test file exists |
| `ADD_CAPTION_CLIP` / `UPDATE_CAPTION_STYLE` reducer actions | Not covered by reducer tests |
| Caption validation schemas in `editor.schemas.ts` | No schema validation tests |
| ASS exporter end-to-end | No tests for color conversion, page slicing, or style override application |
| Export job caption path | No test for missing caption doc behavior |
| Font load failure path | No test or log for canvas fallback |

---

## Low Priority / Cosmetic (P3)

### 12. No Warning on Font Load Failure

**File:** `frontend/src/features/editor/caption/renderer.ts`

If the custom font fails to load, the canvas silently falls back to the system default font with no log or visual indicator. Should emit a `console.warn` at minimum.

---

### 13. Missing Query Invalidation for Presets After Transcription

**File:** `frontend/src/features/editor/caption/hooks/useTranscription.ts`

The `onSuccess` handler invalidates caption doc queries but not the preset list. Low risk today (presets don't change), but inconsistent.

---

## Verified as Correct (No Action Needed)

These were suspected during review but confirmed to be correct:

- Shadow layer canvas state is fully reset after drawing (color, offsets, blur all cleared)
- Animation timing clamp math is correct (`Math.max(0, Math.min(1, ...))`)
- `useCaptionCanvas` dependency array is complete
- `CaptionClip` shape in `timeline.types.ts` matches `CaptionClipData` in `run-export-job.ts`
- `groupingMs` fallback chain is correct in both renderer and export job
- Layout engine `index` field is correctly preserved across line-breaking
- `/presets` endpoint is properly auth-guarded

---

## Fix Priority Order

1. `textTransform` not applied in renderer (visible user-facing bug)
2. Hardcoded `"hormozi"` preset default (silent breakage risk)
3. Silent caption skip in export (export correctness)
4. `#RGB` shorthand crash in ASS exporter (export stability)
5. `CaptionPresetDefinition` type looseness (architecture)
6. Transcription rate limiting (cost/security)
7. i18n missing strings (localization)
8. Preset cache never invalidated (future-proofing)
9. Test coverage gaps (correctness confidence)
10. Everything else
