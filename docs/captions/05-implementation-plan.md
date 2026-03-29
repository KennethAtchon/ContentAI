# Implementation Plan: Caption Engine v2

This is the execution guide. Follow this order exactly. Skipping phases or building out of order will create a broken intermediate state that is harder to reason about than the current broken system.

---

## Phase 0: Read Before Deleting

Before touching any file, you must have read and understood:

- [ ] `frontend/src/features/editor/types/editor.ts` — full `Clip` type
- [ ] `frontend/src/features/editor/constants/caption-presets.ts`
- [ ] `frontend/src/features/editor/hooks/useCaptionPreview.ts`
- [ ] `frontend/src/features/editor/hooks/useCaptions.ts`
- [ ] `frontend/src/features/editor/components/Inspector.tsx`
- [ ] `frontend/src/features/editor/components/PreviewArea.tsx`
- [ ] `frontend/src/features/editor/model/editor-reducer-clip-ops.ts`
- [ ] `backend/src/routes/editor/captions.ts`
- [ ] `backend/src/routes/editor/export/ass-generator.ts`
- [ ] `backend/src/routes/editor/export-worker.ts`
- [ ] `backend/src/infrastructure/database/drizzle/schema.ts` (caption table)

---

## Blast Radius: Complete Deletion Checklist

### Files to Delete Entirely

| File | Replacement |
|------|-------------|
| `frontend/src/features/editor/constants/caption-presets.ts` | `frontend/src/features/editor/caption/presets.ts` |
| `frontend/src/features/editor/hooks/useCaptionPreview.ts` | `frontend/src/features/editor/caption/renderer.ts` |
| `frontend/src/features/editor/hooks/useCaptions.ts` | `frontend/src/features/editor/caption/hooks/useTranscription.ts` + `useCaptionDoc.ts` |
| `frontend/src/features/editor/components/CaptionPresetTile.tsx` | Part of new `CaptionPresetPicker.tsx` |
| `backend/src/routes/editor/export/ass-generator.ts` | `backend/src/domain/captions/ass-exporter.ts` |

### Files to Heavily Modify (Not Delete)

| File | Changes |
|------|---------|
| `frontend/src/features/editor/types/editor.ts` | Remove 6 `caption*` fields from `Clip`. Add `CaptionClip` type. Add `UPDATE_CAPTION_STYLE` action. Change `ADD_CAPTION_CLIP` payload. |
| `frontend/src/features/editor/model/editor-reducer-clip-ops.ts` | Rewrite `ADD_CAPTION_CLIP` handler. Add `UPDATE_CAPTION_STYLE` handler. |
| `frontend/src/features/editor/components/Inspector.tsx` | Remove `useAutoCaption`, `addCaptionClip` old flow. Mount new `CaptionStylePanel`. |
| `frontend/src/features/editor/components/inspector/InspectorClipMetaPanel.tsx` | Remove caption generation button (auto-transcription replaces it). |
| `frontend/src/features/editor/components/inspector/InspectorTextAndCaptionPanels.tsx` | Remove caption style section (replaced by `CaptionStylePanel`). |
| `frontend/src/features/editor/components/PreviewArea.tsx` | Replace `useCaptionPreview`/`drawCaptionsOnCanvas` call with `useCaptionCanvas` hook. |
| `frontend/src/shared/lib/query-keys.ts` | Rename `captionsByAsset` → `captionDoc`. |
| `frontend/src/translations/en.json` | Remove old keys, add new keys (see LLD). |
| `backend/src/routes/editor/captions.ts` | Change response field `captionId` → `captionDocId`. Add `POST /manual` route. |
| `backend/src/routes/editor/export-worker.ts` | Update caption clip detection (check `clip.type === "caption"`). Update ASS generation call to use new `generateASS` from `ass-exporter.ts`. |
| `backend/src/routes/editor/editor-ai.router.ts` | Update `ADD_CAPTION_CLIP` construction to new shape. |
| `backend/src/routes/editor/services/build-initial-timeline.ts` | Update `buildCaptionClip()` to produce new `CaptionClip` shape. |
| `backend/src/infrastructure/database/drizzle/schema.ts` | Rename `captions` → `captionDocs`. Add `source` column. Make `assetId` nullable. |
| `backend/src/types/timeline.types.ts` | Remove `CaptionWord` and 6 `caption*` fields from backend `Clip`. Add `CaptionClip` type. |
| `backend/src/types/index.ts` | Update re-exports. |

### Tests to Delete

| Test File | Reason |
|-----------|--------|
| `backend/__tests__/unit/routes/editor/build-initial-timeline-caption-compose.test.ts` | Tests old `composeOverlayText` which no longer exists |
| `backend/__tests__/unit/routes/video-timeline-validation.test.ts` (caption-specific cases) | `CAPTION_INVALID_TIME_RANGE` etc. validation changes |
| `backend/__tests__/unit/routes/video-route-utils.test.ts` (`extractCaptionSourceText` test) | Only if this function is removed |

### New Tests to Write

| File | Tests |
|------|-------|
| `frontend/__tests__/unit/features/editor/caption/page-builder.test.ts` | `buildPages()` grouping, gap detection, edge cases (empty, single word, gap > threshold) |
| `frontend/__tests__/unit/features/editor/caption/easing.test.ts` | `evaluate()` for each easing type, spring boundary conditions |
| `frontend/__tests__/unit/features/editor/caption/layout-engine.test.ts` | `computeLayout()` word wrap, single line, overflow, positionY calc |
| `backend/__tests__/unit/domain/captions/page-builder.test.ts` | Same tests as frontend (identical function) |
| `backend/__tests__/unit/domain/captions/ass-exporter.test.ts` | `generateASS()` for each export mode, legacy ID resolution, `cssToASS()` |
| `backend/__tests__/unit/routes/editor/captions.test.ts` | `POST /manual` validation, `captionDocId` response field |

---

## Build Order

### Phase 1: DB Migration (Backend)

1. Write migration: rename `caption` → `caption_doc`, add `source` column, make `assetId` nullable.
2. Update Drizzle schema: rename `captions` export → `captionDocs`, update type.
3. Update all DB queries that reference `captions` table.
4. Run `bun run db:generate && bun run db:migrate`.
5. Update `backend/src/types/index.ts` exports.

**At this point:** Backend compiles. Old routes still work (the table is renamed, column names unchanged except `source` addition).

---

### Phase 2: Backend Type System

1. In `backend/src/types/timeline.types.ts`:
   - Remove `CaptionWord` (it's now `Word` and lives in schema types).
   - Remove 6 `caption*` fields from `Clip`.
   - Add `CaptionClip` interface (from LLD).
   - Export `Word` from schema types.

2. In `backend/src/types/index.ts`: update exports.

**At this point:** Backend will have type errors in `export-worker.ts`, `editor-ai.router.ts`, `build-initial-timeline.ts`. That's expected — proceed.

---

### Phase 3: Backend Domain Layer (New Files)

Create `backend/src/domain/captions/`:

1. `page-builder.ts` — implement `buildPages()`.
2. `preset-registry.ts` — mirror of frontend presets (same 10 presets, same IDs, TypeScript objects). This file is verbose but necessary (no shared code rule).
3. `ass-exporter.ts` — implement `generateASS(pages, preset, resolution, clipStartMs)`. Derives style from `TextPreset` objects in preset-registry. Includes `cssToASS()` and `msToASSTime()` utilities.

Write tests for Phase 3 now (`page-builder.test.ts`, `ass-exporter.test.ts`).

---

### Phase 4: Backend Routes Update

1. `backend/src/routes/editor/captions.ts`:
   - Rename `captionId` → `captionDocId` in all responses.
   - Add `POST /manual` route.
   - Update DB table reference from `captions` → `captionDocs`.

2. `backend/src/routes/editor/export-worker.ts`:
   - Delete `generateASS` import from old path.
   - Import from `../../domain/captions/ass-exporter`.
   - Update caption clip detection: `clip.type === "caption"` instead of `clip.captionWords?.length`.
   - Update ASS call: pass `CaptionPage[]` instead of raw `words[]`.

3. `backend/src/routes/editor/editor-ai.router.ts`:
   - Update `ADD_CAPTION_CLIP` clip construction to new `CaptionClip` shape.
   - Remove `captionWords: []` field (words come from caption_doc).

4. `backend/src/routes/editor/services/build-initial-timeline.ts`:
   - Update `buildCaptionClip()` to return new `CaptionClip` shape.

5. **Delete** `backend/src/routes/editor/export/ass-generator.ts`.

**At this point:** Backend compiles cleanly. All tests pass.

---

### Phase 5: Frontend Type System

1. In `frontend/src/features/editor/types/editor.ts`:
   - Remove `CaptionWord` type (it was defined here, now lives in caption/types.ts).
   - Remove 6 `caption*` fields from `Clip`.
   - Import and re-export `CaptionClip` from `../caption/types`.
   - Update `ADD_CAPTION_CLIP` action payload (remove `captionWords`, add `captionDocId`).
   - Add `UPDATE_CAPTION_STYLE` action.

2. In `frontend/src/shared/lib/query-keys.ts`:
   - Rename `captionsByAsset` → `captionDoc`.

**At this point:** Frontend has many type errors. That's correct. Do not fix them yet — proceed to Phase 6.

---

### Phase 6: Frontend Caption Module (New Files)

Create `frontend/src/features/editor/caption/`:

1. `types.ts` — all types from LLD.
2. `easing.ts` — `evaluate()`, `springValue()`.
3. `page-builder.ts` — `buildPages()`.
4. `layout-engine.ts` — `computeLayout()`.
5. `renderer.ts` — `renderFrame()`.
6. `font-loader.ts` — `FontLoader` class.
7. `presets.ts` — 10 presets from `04-presets.md`.
8. `hooks/useTranscription.ts` — mutation hook.
9. `hooks/useCaptionDoc.ts` — query hook.
10. `hooks/useCaptionCanvas.ts` — canvas orchestration hook.
11. `components/CaptionPresetPicker.tsx`.
12. `components/CaptionStylePanel.tsx`.

Write tests for Phase 6 (`page-builder.test.ts`, `easing.test.ts`, `layout-engine.test.ts`).

**Delete** these files now (their replacements are built):
- `frontend/src/features/editor/constants/caption-presets.ts`
- `frontend/src/features/editor/hooks/useCaptionPreview.ts`
- `frontend/src/features/editor/hooks/useCaptions.ts`
- `frontend/src/features/editor/components/CaptionPresetTile.tsx`

---

### Phase 7: Frontend Reducer Update

In `frontend/src/features/editor/model/editor-reducer-clip-ops.ts`:

1. Remove old `ADD_CAPTION_CLIP` handler.
2. Write new `ADD_CAPTION_CLIP` handler: creates a `CaptionClip` (no embedded words).
3. Add `UPDATE_CAPTION_STYLE` handler: updates `stylePresetId`, `styleOverrides`, or `groupingMs` on a `CaptionClip`.

In `frontend/src/features/editor/hooks/useEditorStore.ts`:
1. Remove old `addCaptionClip` export.
2. Add new `addCaptionClip` (updated payload).
3. Add `updateCaptionStyle`.

---

### Phase 8: Frontend Component Update

1. `PreviewArea.tsx`:
   - Remove `captionCanvasRef`, `drawCaptionsOnCanvas` call.
   - Mount `useCaptionCanvas` hook.
   - Attach returned canvas ref to the overlay canvas element.

2. `Inspector.tsx`:
   - Remove `useAutoCaption()`.
   - Remove old `addCaptionClip()` call.
   - Add auto-transcription trigger on voiceover clip selection (detect new voiceover, call `useTranscription` mutation automatically).
   - Mount `CaptionPresetPicker` and `CaptionStylePanel` when selected clip is `type: "caption"`.

3. `InspectorClipMetaPanel.tsx`:
   - Remove `AutoCaptionUi` props and the "Generate Text for Clip" button.
   - (Auto-transcription flow replaces manual trigger.)

4. `InspectorTextAndCaptionPanels.tsx`:
   - Remove caption style section entirely.
   - (`CaptionStylePanel` is mounted directly by `Inspector.tsx` now.)

---

### Phase 9: Translation Update

In `frontend/src/translations/en.json`:
1. Remove all `editor_captions_*` keys.
2. Remove `inspector_prop_caption_*` keys.
3. Add new keys from LLD.

---

### Phase 10: Completeness Verification

Run these checks before declaring done:

1. **grep for old names** — these should return zero results:
   ```bash
   grep -r "captionWords" frontend/src backend/src
   grep -r "captionPresetId" frontend/src backend/src
   grep -r "captionGroupSize" frontend/src backend/src
   grep -r "captionPositionY" frontend/src backend/src
   grep -r "captionFontSizeOverride" frontend/src backend/src
   grep -r "useCaptionPreview" frontend/src
   grep -r "drawCaptionsOnCanvas" frontend/src
   grep -r "CaptionPreset" frontend/src backend/src  # old flat type
   grep -r "ass-generator" backend/src
   grep -r "captionsByAsset" frontend/src
   ```

2. **Build both packages:**
   ```bash
   cd frontend && bun run type-check
   cd backend && bun run build
   ```

3. **Run tests:**
   ```bash
   cd frontend && bun test
   cd backend && bun test
   ```

4. **Check for dead imports** — no file should import from a deleted path.

5. **Verify export pipeline** — run a test export with a voiceover asset and confirm ASS file is generated and video is exported correctly.

---

## Migration Note for Existing Compositions

Compositions in the DB saved before v2 will have clips with old `caption*` fields. These must be handled during load:

```typescript
// In build-initial-timeline.ts or a migration utility:
function migrateLegacyCaptionClip(oldClip: LegacyClip): CaptionClip | null {
  if (!oldClip.captionId) return null;
  return {
    id: oldClip.id,
    type: "caption",
    startMs: oldClip.startMs,
    durationMs: oldClip.durationMs,
    captionDocId: oldClip.captionId,   // captionId was the caption_doc ID
    stylePresetId: oldClip.captionPresetId ?? "hormozi",
    styleOverrides: {
      positionY: oldClip.captionPositionY,
      fontSize: oldClip.captionFontSizeOverride,
    },
    groupingMs: oldClip.captionGroupSize
      ? oldClip.captionGroupSize * 400   // rough conversion: groupSize 3 ≈ 1200ms
      : 0,
  };
}
```

This migration function runs when loading a composition that contains a text track clip with `captionId` set. It is a one-way conversion — old compositions are read and converted on load. They are re-saved in the new format on the next autosave.

---

## Risk Register

| Risk | Mitigation |
|------|-----------|
| The `caption` → `caption_doc` table rename breaks existing API clients | The rename is internal to the backend only. External API shape changes only at `captionId` → `captionDocId` in responses. Old clients that ignore unknown fields are unaffected. |
| Legacy compositions stored in DB with old `captionWords` embedded in the clip JSON | The migration function above handles on-read conversion. The words are already in `caption_doc` — the embedded copy is simply ignored. |
| Backend and frontend preset registries drift out of sync | A test in each package compares preset IDs. CI fails if they diverge. |
| `buildPages()` logic diverges between frontend and backend copies | Same test suite run in both packages validates identical output for identical input. |
| Font loading fails in certain browser environments | `FontLoader` catches rejection and falls back to system sans-serif. Caption renders correctly (at wrong font) rather than failing to render. |
| OffscreenCanvas transfer breaks the existing canvas ref pattern | The new `useCaptionCanvas` hook does not use OffscreenCanvas yet — it uses a regular canvas ref. OffscreenCanvas is a future optimization (Phase X). No risk in v2. |
